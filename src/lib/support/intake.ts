import 'server-only';
// One way in for every support ticket: the public form, inbound email, and the operator's manual
// log all land here. Single path so dedupe, triage and the GitHub hand-off cannot drift between
// sources, which is exactly how "we fixed it for the form but not for email" happens.
import { createHash } from 'crypto';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { triageTicket } from '@/lib/support/triage';
import { openIssueForTicket } from '@/lib/support/github';
import { scanForPii } from '@/lib/support/pii';
import { sendTicketAlert } from '@/lib/support/telegram';
import { ticketKeyboard } from '@/lib/support/telegram-commands';
import { sendTicketEmail } from '@/lib/support/ticket-email';

export type IntakeInput = {
  companyId: string;
  subject: string;
  body: string | null;
  email: string | null;
  // 'app' = a logged-in member using the in-app form; 'web' = the public /support page. Worth
  // distinguishing: an app ticket carries a profile and its account facts, a web one may not.
  source: 'web' | 'app' | 'email' | 'manual';
  /** Stable per-source identity (email Message-ID, or a content hash for the form). */
  dedupeKey?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string | null;
  /** Who actually typed this. A coach can file on behalf of a member. */
  repName?: string | null;
  repPhone?: string | null;
  companyName?: string | null;
  attachmentUrl?: string | null;
  videoUrl?: string | null;
  /** The member who filed it, when they were logged in. Links the ticket to an account. */
  profileId?: string | null;
};

export type IntakeResult = { ok: boolean; ticketId?: string; duplicate?: boolean };

/**
 * Content hash for sources with no natural id. Deliberately includes the body: a member writing a
 * second, different message with the same subject is a NEW ticket, not a duplicate.
 */
export function contentDedupeKey(email: string | null, subject: string, body: string | null): string {
  return createHash('sha256')
    .update(`${(email ?? '').toLowerCase()}|${subject.trim().toLowerCase()}|${(body ?? '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 40);
}

/**
 * Create a ticket, then triage it in the background.
 *
 * Triage runs inside after(): it makes a model call plus several queries, and on Vercel a bare void
 * after the response races the freezing lambda (the funnel lost every GHL contact to exactly that).
 * The ticket is committed BEFORE triage runs, so a triage failure can never cost us the ticket.
 */
export async function createSupportTicket(input: IntakeInput): Promise<IntakeResult> {
  const svc = createServiceClient();
  const subject = input.subject.trim().slice(0, 200) || '(no subject)';
  const body = input.body?.trim().slice(0, 20_000) || null;
  const email = input.email?.trim().toLowerCase() || null;
  const dedupeKey = input.dedupeKey ?? contentDedupeKey(email, subject, body);

  // Scan BEFORE the insert so pii state lands atomically with the body. A ticket that briefly exists
  // flagged=false while a notifier reads it is exactly the race that leaks an SSN into a chat.
  const pii = scanForPii(body);

  const { data, error } = await svc
    .from('support_tickets')
    .insert({
      company_id: input.companyId,
      profile_id: input.profileId ?? null,
      subject,
      body,
      redacted_body: pii.flagged ? pii.redacted : body,
      pii_flagged: pii.flagged,
      pii_kinds: pii.kinds,
      email,
      source: input.source,
      priority: input.priority ?? 'normal',
      category: input.category ?? null,
      dedupe_key: dedupeKey,
      rep_name: input.repName?.trim() || null,
      rep_phone: input.repPhone?.trim() || null,
      company_name: input.companyName?.trim() || null,
      attachment_url: input.attachmentUrl?.trim() || null,
      video_url: input.videoUrl?.trim() || null,
    })
    .select('id, ticket_number')
    .maybeSingle();

  if (error) {
    // 23505 = the partial unique index on (company_id, dedupe_key). A webhook retry or a double-tap
    // on Send is normal traffic, not an error: report success so the caller does not tell a member
    // their message failed and prompt a third copy.
    if (error.code === '23505') return { ok: true, duplicate: true };
    console.error('createSupportTicket:', error.message);
    return { ok: false };
  }

  const row = data as { id: string; ticket_number: number } | null;
  const ticketId = row?.id;
  if (!ticketId) return { ok: false };

  const enrich = async (): Promise<void> => {
    const triage = await triageTicket({ ticketId, companyId: input.companyId, subject, body, email, source: input.source });
    if (!triage) return;
    // Let triage refine priority/category, since the member picking "other/normal" on a form tells us
    // very little. The operator can still override from the board.
    await svc
      .from('support_tickets')
      .update({
        triage,
        triaged_at: new Date().toISOString(),
        priority: triage.priority,
        category: triage.category,
      })
      .eq('id', ticketId);
    await openIssueForTicket({ ticketId, companyId: input.companyId, subject, body, email, triage });
  };

  // Telegram alert. Scheduled SEPARATELY from triage on purpose: triage makes a model call and can be
  // slow or fail, and an operator finding out a ticket exists must not depend on that succeeding.
  // The summary is best-effort, so the alert waits briefly for triage and sends regardless.
  const notify = async (): Promise<void> => {
    const { data: fresh } = await svc
      .from('support_tickets')
      .select('id, ticket_number, rep_name, company_name, category, email, triage, pii_flagged, attachment_url, video_url')
      .eq('id', ticketId)
      .maybeSingle();
    const t = fresh as {
      id: string; ticket_number: number; rep_name: string | null; company_name: string | null;
      category: string | null; email: string | null; triage: { summary?: string } | null;
      pii_flagged: boolean; attachment_url: string | null; video_url: string | null;
    } | null;
    if (!t) return;
    await sendTicketAlert({
      id: t.id,
      ticketNumber: t.ticket_number,
      repName: t.rep_name,
      companyName: t.company_name,
      category: t.category,
      email: t.email,
      // The generated summary, never the body. See telegram.ts for why that line is load-bearing.
      summary: t.triage?.summary ?? null,
      piiFlagged: t.pii_flagged,
      hasAttachment: Boolean(t.attachment_url),
      videoUrl: t.video_url,
      // Action buttons on the alert itself: an operator can move a ticket without leaving the chat,
      // which is the difference between a notification feed and something that does work.
      keyboard: ticketKeyboard(t.id),
    });

    // Email twin, to the ops address. Same content and order as the app view, but carrying the
    // REDACTED body: email forwards and syncs to phones, so it is the easiest place for a member's
    // SSN to escape. The unredacted text stays reachable in exactly one place.
    const opsEmail = process.env.SUPPORT_OPS_EMAIL?.trim();
    if (opsEmail) {
      const { data: full } = await svc
        .from('support_tickets')
        .select('id, ticket_number, subject, status, category, priority, email, rep_name, rep_phone, company_name, created_at, triage, body, redacted_body, pii_flagged, pii_kinds, attachment_url, video_url')
        .eq('id', ticketId)
        .maybeSingle();
      const f = full as Record<string, unknown> | null;
      if (f) {
        await sendTicketEmail(opsEmail, {
          id: String(f.id),
          ticketNumber: Number(f.ticket_number),
          subject: String(f.subject ?? ''),
          status: String(f.status ?? 'open'),
          category: (f.category as string | null) ?? null,
          priority: String(f.priority ?? 'normal'),
          email: (f.email as string | null) ?? null,
          repName: (f.rep_name as string | null) ?? null,
          repPhone: (f.rep_phone as string | null) ?? null,
          companyName: (f.company_name as string | null) ?? null,
          createdAt: String(f.created_at),
          summary: ((f.triage as { summary?: string } | null)?.summary) ?? null,
          // redacted_body when flagged, plain body otherwise. NEVER f.body on a flagged ticket.
          bodyForEmail: (f.pii_flagged as boolean)
            ? ((f.redacted_body as string | null) ?? null)
            : ((f.body as string | null) ?? null),
          piiFlagged: Boolean(f.pii_flagged),
          piiKinds: (f.pii_kinds as string[] | null) ?? [],
          attachmentUrl: (f.attachment_url as string | null) ?? null,
          videoUrl: (f.video_url as string | null) ?? null,
        });
      }
    }
  };

  // Triage first, then notify: the alert reads back the summary triage just wrote, and awaiting them
  // in order inside one background unit is what lets the message carry it.
  const background = async (): Promise<void> => {
    await enrich().catch((e: unknown) => console.error('support enrich:', e));
    await notify().catch((e: unknown) => console.error('support notify:', e));
  };
  try {
    after(background);
  } catch {
    // Outside a request scope (a script or a test): run it inline rather than dropping it.
    void background();
  }

  return { ok: true, ticketId };
}
