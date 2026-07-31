import 'server-only';
// The 9pm ET daily recap: everything happening in the software, in one message.
//
// Structured after the reference Dre shared, and the part worth copying is the ENDING. A digest of
// pure metrics trains you to skim past it. This one closes with "needs you", derived from the same
// numbers, so the message is only long when something is actually wrong. On a quiet day it says so
// in two lines.
//
// Every section is best-effort and independent: one failing query must not cost the whole recap, so
// counts resolve to 0 rather than throwing and the message still sends.
import { createServiceClient } from '@/lib/supabase/service';
import { reply } from '@/lib/support/telegram-commands';
import { formatTicketNumber } from '@/lib/support/telegram-format';

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

/**
 * "Since midnight ET" as a UTC instant, and today's ET date.
 *
 * Deliberately computed from the ET wall clock rather than UTC midnight: a member logging dinner at
 * 8pm ET must land in the same day as the 9pm recap that reports it. Using UTC midnight would push
 * every evening into tomorrow's numbers and make the recap quietly wrong every single night.
 */
export function etDayBounds(now: Date): { sinceIso: string; etDate: string; etHour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const etDate = `${parts.year}-${parts.month}-${parts.day}`;
  // '24' is how en-CA renders hour 0 with hour12:false. Left unmapped it would read as hour 24 and
  // never equal the 21 the cron gate compares against.
  const etHour = Number(parts.hour) % 24;
  return { sinceIso: etMidnightAsUtc(etDate).toISOString(), etDate, etHour };
}

/**
 * Midnight of an ET calendar date, as a UTC instant.
 *
 * The offset is MEASURED at that date rather than hardcoded, so this is correct on both sides of the
 * DST boundary without a table of rules: format the naive instant in both zones and take the
 * difference. Getting this wrong is invisible in July and silently shifts every recap by an hour in
 * November, which is the sort of bug that only surfaces months later.
 */
function etMidnightAsUtc(etDate: string): Date {
  const naive = new Date(`${etDate}T00:00:00Z`);
  const asEt = new Date(naive.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(naive.getTime() + (asUtc.getTime() - asEt.getTime()));
}

async function count(q: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count: c } = await q;
    return c ?? 0;
  } catch {
    return 0;
  }
}

export type Recap = { text: string; etDate: string };

export async function buildDailyRecap(companyId: string, now = new Date()): Promise<Recap> {
  const svc = createServiceClient();
  const { sinceIso, etDate } = etDayBounds(now);
  const day = sinceIso.slice(0, 10);

  const [
    newMembers, totalMembers, newLeads, totalLeads, confirmedLeads,
    scans, scanErrors, foodLogs, corrections,
    newTickets, openTickets, resolvedToday, unnotified,
    posts, reports, weighIns, activeSubs,
  ] = await Promise.all([
    count(svc.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', sinceIso)),
    count(svc.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    count(svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', sinceIso)),
    count(svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    count(svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('confirmed_at', 'is', null)),
    count(svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').gte('created_at', sinceIso)),
    count(svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').eq('status', 'error').gte('created_at', sinceIso)),
    count(svc.from('food_log').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('log_date', day)),
    count(svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').not('correction', 'is', null).gte('created_at', sinceIso)),
    count(svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', sinceIso)),
    count(svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['open', 'in_progress'])),
    count(svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('resolved_at', sinceIso)),
    count(svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('notified_at', null)),
    count(svc.from('community_posts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', sinceIso)),
    count(svc.from('community_reports').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', sinceIso)),
    count(svc.from('weight_entries').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('recorded_on', day)),
    count(svc.from('entitlements').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['active', 'trialing'])),
  ]);

  // Cron failures + AI spend need row data, not counts.
  const [{ data: cronRows }, { data: spendRows }, { data: oldest }] = await Promise.all([
    svc.from('cron_job_log').select('job_name, status').gte('ran_at', sinceIso).limit(500),
    svc.from('ai_usage_log').select('cost_cents').eq('company_id', companyId).gte('created_at', sinceIso).limit(5000),
    svc.from('support_tickets').select('ticket_number, subject, created_at').eq('company_id', companyId).in('status', ['open', 'in_progress']).order('created_at', { ascending: true }).limit(1),
  ]);
  const crons = (cronRows ?? []) as { job_name: string; status: string | null }[];
  const cronFails = crons.filter((c) => c.status && c.status !== 'success' && c.status !== 'succeeded');
  const spendCents = ((spendRows ?? []) as { cost_cents: number | null }[]).reduce((a, r) => a + Number(r.cost_cents ?? 0), 0);
  const oldestOpen = (oldest ?? [])[0] as { ticket_number: number; subject: string; created_at: string } | undefined;

  const pretty = new Date(`${etDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  const L: string[] = [
    '🌙 <b>DAILY RECAP</b>',
    `<i>${pretty} · since midnight ET</i>`,
    '',
    '<b>Members</b>',
    `• New signups: ${newMembers}`,
    `• Total members: ${totalMembers}`,
    `• Paying / entitled: ${activeSubs}`,
    '',
    '<b>Waitlist</b>',
    `• New leads: ${newLeads}`,
    `• Total: ${totalLeads} (${confirmedLeads} confirmed)`,
    '',
    '<b>Nutrition</b>',
    `• Photo scans: ${scans}${scanErrors ? ` (${scanErrors} failed)` : ''}`,
    `• Foods logged: ${foodLogs}`,
    `• Scans corrected: ${corrections}`,
    `• Weigh-ins: ${weighIns}`,
    '',
    '<b>Community</b>',
    `• Posts: ${posts}`,
    `• Reports: ${reports}`,
    '',
    '<b>Support</b>',
    `• New tickets: ${newTickets}`,
    `• Open now: ${openTickets}`,
    `• Resolved today: ${resolvedToday}`,
    '',
    '<b>System</b>',
    `• Cron runs: ${crons.length}${cronFails.length ? `, ${cronFails.length} FAILED` : ''}`,
    `• AI spend today: $${(spendCents / 100).toFixed(2)}`,
  ];

  // The section that makes this worth reading. Only real, actionable items; silence when clean.
  const todo: string[] = [];
  if (openTickets > 0) {
    const age = oldestOpen ? Math.round((now.getTime() - new Date(oldestOpen.created_at).getTime()) / 3_600_000) : 0;
    todo.push(
      `${openTickets} ticket${openTickets === 1 ? '' : 's'} open` +
        (oldestOpen ? `, oldest ${formatTicketNumber(oldestOpen.ticket_number)} (${age}h)` : '') +
        ' → /open',
    );
  }
  if (cronFails.length) todo.push(`${cronFails.length} cron failure${cronFails.length === 1 ? '' : 's'}: ${[...new Set(cronFails.map((c) => c.job_name))].join(', ')} → /health`);
  if (scanErrors > 0) todo.push(`${scanErrors} photo scan${scanErrors === 1 ? '' : 's'} errored today`);
  if (unnotified > 0) todo.push(`${unnotified} ticket${unnotified === 1 ? '' : 's'} never sent an alert`);
  if (reports > 0) todo.push(`${reports} community report${reports === 1 ? '' : 's'} to review`);
  if (totalLeads > 0 && confirmedLeads < totalLeads) {
    todo.push(`${totalLeads - confirmedLeads} waitlist lead${totalLeads - confirmedLeads === 1 ? '' : 's'} never confirmed (no entries, no drip)`);
  }

  L.push('', '<b>Needs you</b>');
  L.push(todo.length ? todo.map((t) => `• ${t}`).join('\n') : '• Nothing. Everything is clean.');
  L.push('', `${APP_URL}/admin`);

  return { text: L.join('\n'), etDate };
}

/** Build and send. Returns what happened so the cron log is useful. */
export async function sendDailyRecap(companyId: string, now = new Date()): Promise<{ ok: boolean; etDate: string; sent: boolean }> {
  try {
    const { text, etDate } = await buildDailyRecap(companyId, now);
    const sent = await reply(text);
    return { ok: true, etDate, sent };
  } catch (e) {
    console.error('sendDailyRecap:', e instanceof Error ? e.message : e);
    return { ok: false, etDate: '', sent: false };
  }
}
