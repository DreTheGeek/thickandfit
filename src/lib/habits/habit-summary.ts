import 'server-only';
// "Share habit summary in chat" (coach settings, Client App Experience).
//
// After a client submits a check-in, post her habit tally for the stretch since her PREVIOUS check-in
// into the coach thread, as a message from the coach. It is the one row on that screen that turns a
// preference into something the client actually receives, so it has to behave like a real message:
// archived to the CRM thread and announced with a notification, not quietly inserted where only a
// realtime subscriber would notice it.
//
// Never throws. It runs inside submitResponse, after the response row is already written. A failure
// here must cost a chat message, never a check-in.
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import { createServiceClient } from '@/lib/supabase/service';
import { readCoachSettings } from '@/lib/coach/settings';
import { notifyClientMessage } from '@/lib/notifications/triggers';

type Locale = 'en' | 'es';

/**
 * Direct catalog read rather than the per-request next-intl context.
 *
 * Same reason src/lib/notifications/i18n.ts does it: the message is rendered in the CLIENT's
 * language, and the request context here belongs to whoever submitted the form, which is the same
 * person only by coincidence of this particular call path.
 */
function chatText(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const catalogs = { en, es: es as typeof en };
  const table = (catalogs[locale]?.app?.coachSettings?.habitChat ?? {}) as Record<string, string>;
  const fallback = (en.app.coachSettings.habitChat ?? {}) as Record<string, string>;
  let out = table[key] ?? fallback[key] ?? key;
  for (const [name, value] of Object.entries(vars)) out = out.replaceAll(`{${name}}`, String(value));
  return out;
}

/** Days back to look when there is no previous check-in to measure from. */
const FIRST_CHECKIN_WINDOW_DAYS = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function sendHabitSummaryToChat(args: {
  companyId: string;
  profileId: string;
  /** The check-in that just landed. Excluded when looking for the previous one. */
  responseId: string;
}): Promise<void> {
  const { companyId, profileId, responseId } = args;
  try {
    const settings = await readCoachSettings(companyId);
    if (!settings.isHabitSummaryShared) return;

    const svc = createServiceClient();

    // Window start: the check-in before this one. Filtering by form type keeps an onboarding form
    // from being mistaken for a check-in and collapsing the window to nothing.
    const { data: prev } = await svc
      .from('form_responses')
      .select('submitted_at, forms!inner(type)')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .eq('forms.type', 'check_in')
      .neq('id', responseId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevAt = (prev as { submitted_at: string } | null)?.submitted_at ?? null;
    const fromDate = prevAt
      ? isoDate(new Date(prevAt))
      : isoDate(new Date(Date.now() - FIRST_CHECKIN_WINDOW_DAYS * 86_400_000));
    const toDate = isoDate(new Date());

    const [{ data: habitRows }, { data: profileRow }] = await Promise.all([
      svc
        .from('habits')
        .select('id, title')
        .eq('company_id', companyId)
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      svc.from('profiles').select('ui_locale, content_locale').eq('id', profileId).maybeSingle(),
    ]);

    const habits = (habitRows ?? []) as { id: string; title: string }[];
    // No habits assigned means there is nothing to summarize. Sending "0 of nothing" reads as a
    // reprimand for a plan she was never given.
    if (habits.length === 0) return;

    const { data: logRows } = await svc
      .from('habit_logs')
      .select('habit_id')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .eq('done', true)
      .gte('logged_date', fromDate)
      .lte('logged_date', toDate);

    const counts = new Map<string, number>();
    for (const row of (logRows ?? []) as { habit_id: string }[]) {
      counts.set(row.habit_id, (counts.get(row.habit_id) ?? 0) + 1);
    }

    const p = (profileRow ?? null) as { ui_locale: string | null; content_locale: string | null } | null;
    const locale: Locale = (p?.content_locale ?? p?.ui_locale) === 'es' ? 'es' : 'en';

    const lines = habits.map((h) => {
      const count = counts.get(h.id) ?? 0;
      const key = count === 1 ? 'lineOne' : 'lineOther';
      return `- ${chatText(locale, key, { habit: h.title, count })}`;
    });
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const body = [
      chatText(locale, 'intro'),
      lines.join('\n'),
      total === 0 ? chatText(locale, 'closingNone') : chatText(locale, 'closing'),
    ].join('\n\n');

    // Sender: the coach account, so the message lands in the thread looking like it came from her,
    // which it did, by her instruction. Prefer the coach over an assistant or an operator.
    const { data: senders } = await svc
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('company_id', companyId)
      .in('role', ['coach', 'assistant_coach', 'operator'])
      .order('created_at', { ascending: true });
    const senderRows = (senders ?? []) as { id: string; full_name: string | null; email: string | null; role: string }[];
    const sender = senderRows.find((s) => s.role === 'coach') ?? senderRows[0] ?? null;
    if (!sender) return;

    const { error: msgErr } = await svc.from('messages').insert({
      company_id: companyId,
      client_id: profileId,
      sender_id: sender.id,
      body,
    });
    if (msgErr) {
      console.error('sendHabitSummaryToChat insert:', msgErr.message);
      return;
    }

    const senderName = (sender.full_name || sender.email || '').trim();

    // Archive into the contact-keyed thread the coach's CRM page reads, matching sendMessageAction.
    // limit(1) + take, not maybeSingle: a duplicated contact row would otherwise error the archive.
    const { data: contactRows } = await svc
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
      .limit(1);
    const contact = ((contactRows ?? []) as { id: string }[])[0] ?? null;
    if (contact) {
      const { error: archErr } = await svc.from('client_messages').insert({
        company_id: companyId,
        contact_id: contact.id,
        profile_id: profileId,
        is_from_coach: true,
        sender_name: senderName,
        body,
        msg_type: 'coach',
        sent_at: new Date().toISOString(),
        source: 'app',
      });
      if (archErr) console.error('sendHabitSummaryToChat archive:', archErr.message);
    }

    await notifyClientMessage({ companyId, clientProfileId: profileId, senderName });
  } catch (e) {
    console.error('sendHabitSummaryToChat:', e instanceof Error ? e.message : e);
  }
}
