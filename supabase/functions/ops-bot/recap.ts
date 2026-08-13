// The 9pm ET daily recap: everything happening in the software, in one message.
//
// The part worth preserving from the original is the ENDING. A digest of pure metrics trains you to
// skim past it. This one closes with "needs you", derived from the same numbers, so the message is
// only long when something is actually wrong. On a quiet day it says so in two lines.
//
// Every section is best-effort and independent: one failing query must not cost the whole recap, so
// counts resolve to 0 rather than throwing and the message still sends.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatTicketNumber, reply, APP_URL } from './telegram.ts';

/**
 * The ET offset at a given instant, in milliseconds (negative: ET is behind UTC).
 *
 * MEASURED rather than hardcoded, so this is correct on both sides of the DST boundary without a
 * table of rules. Getting it wrong is invisible in July and silently shifts every recap by an hour
 * from November, which is the sort of bug that only surfaces months later.
 *
 * The Vercel original measured the offset by round-tripping through `toLocaleString` and re-parsing
 * the result with `new Date()`. That works but leans on a runtime parsing its own localized output,
 * which is exactly the kind of assumption not worth carrying into a different JS runtime. This reads
 * the fields directly instead. `.qa-visual/et-bounds-parity-test.mjs` asserts the two agree on every
 * hour across a full year, including both 2026 DST transitions.
 */
function etOffsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  // '24' is how en-CA renders hour 0 with hour12:false.
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return asIfUtc - at.getTime();
}

/**
 * Midnight of an ET calendar date, as a UTC instant.
 *
 * Solved by one fixed-point step: the offset depends on the instant, and the instant depends on the
 * offset. Measuring at the naive guess and again at the corrected instant converges everywhere
 * except exactly on a transition, which midnight never is in US rules (they move at 2am).
 */
function etMidnightAsUtc(etDate: string): Date {
  const guess = new Date(`${etDate}T00:00:00Z`).getTime();
  const once = guess - etOffsetMs(new Date(guess));
  return new Date(guess - etOffsetMs(new Date(once)));
}

/**
 * "Since midnight ET" as a UTC instant, plus today's ET date and the current ET hour.
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
  const etHour = Number(parts.hour) % 24;
  return { sinceIso: etMidnightAsUtc(etDate).toISOString(), etDate, etHour };
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

export async function buildDailyRecap(
  svc: SupabaseClient,
  companyId: string,
  now = new Date(),
): Promise<Recap> {
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

  // ---- the four client queues ----------------------------------------------------------------
  //
  // WHY THESE ARE HERE. This recap is the only thing that reports when nobody opens the console,
  // and it reported tickets and crons while saying nothing about the four queues that decay in
  // exactly that situation. A member who finished onboarding and is waiting on a program is the
  // day-one failure of the whole product, and it was invisible here. Someone away for a week saw a
  // clean recap every night while four queues filled.
  //
  // DRIFT HAZARD, read this before editing. These definitions are RESTATED rather than imported,
  // because this function deliberately does not share Vercel's failure domain (see the module
  // header: a monitor must not depend on the thing it monitors) and therefore cannot import from
  // src/. src/lib/coach/attention.ts warns about precisely this: a hand-written copy of the at-risk
  // rule once counted 9 where the tile beside it read 39. The sources of truth are:
  //   awaiting            src/lib/coach/awaiting-program.ts   (OVERDUE_DAYS, oldest-first)
  //   unanswered, intake  src/lib/coach/attention.ts          (14-day window)
  //   at risk             src/lib/coach/overview.ts           (isAtRisk)
  // Change a rule there and change it here, or the beach report and the console disagree.
  const AT_RISK_STATUS = ['past_due', 'unpaid'];
  const AT_RISK_HEALTH = ['lapsed', 'due-soon/late'];
  const MSG_WINDOW_DAYS = 14;
  const OVERDUE_DAYS = 3;

  const [{ data: onbRows }, { data: assignedRows }, { data: msgRows }, intakeReview, { data: subRows }] =
    await Promise.all([
      svc
        .from('onboarding_responses')
        .select('profile_id, completed_at, profiles(role)')
        .eq('company_id', companyId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true })
        .limit(500),
      svc.from('plan_assignments').select('profile_id').eq('company_id', companyId).limit(5000),
      svc
        .from('client_messages')
        .select('contact_id, sent_at, is_from_coach')
        .eq('company_id', companyId)
        .gte('sent_at', new Date(now.getTime() - MSG_WINDOW_DAYS * 86_400_000).toISOString())
        .order('sent_at', { ascending: false })
        .limit(2000),
      count(
        svc
          .from('client_intake')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('needs_coach_review', true),
      ),
      svc.from('client_subscriptions').select('status, billing_health').eq('company_id', companyId).limit(20000),
    ]);

  // Staff onboard too while testing, and they are not waiting on a program from anyone.
  const hasProgram = new Set(((assignedRows ?? []) as { profile_id: string }[]).map((r) => r.profile_id));
  type OnbRow = { profile_id: string; completed_at: string; profiles: { role: string | null } | { role: string | null }[] | null };
  const awaiting = ((onbRows ?? []) as OnbRow[]).filter((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return (p?.role === 'subscriber' || p?.role === 'free') && !hasProgram.has(r.profile_id);
  });
  // Ordered oldest-first above, so [0] is the person who has waited longest. Days since she
  // FINISHED ONBOARDING, which is when the promise was made to her, not since she signed up.
  const awaitingOldestDays = awaiting.length
    ? Math.floor((now.getTime() - new Date(awaiting[0].completed_at).getTime()) / 86_400_000)
    : 0;

  // Newest message per contact wins: if it is hers, nobody has replied.
  const latestMsg = new Map<string, { fromCoach: boolean; at: string }>();
  for (const m of (msgRows ?? []) as { contact_id: string | null; sent_at: string; is_from_coach: boolean | null }[]) {
    if (!m.contact_id || latestMsg.has(m.contact_id)) continue;
    latestMsg.set(m.contact_id, { fromCoach: Boolean(m.is_from_coach), at: m.sent_at });
  }
  const unansweredList = [...latestMsg.values()].filter((v) => !v.fromCoach);
  const unanswered = unansweredList.length;
  const unansweredOldestH = unanswered
    ? Math.round((now.getTime() - Math.min(...unansweredList.map((v) => new Date(v.at).getTime()))) / 3_600_000)
    : 0;

  const atRiskClients = ((subRows ?? []) as { status: string | null; billing_health: string | null }[]).filter(
    (r) => AT_RISK_STATUS.includes(r.status ?? '') || AT_RISK_HEALTH.includes(r.billing_health ?? ''),
  ).length;

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
    '<b>Clients</b>',
    `• Waiting on a program: ${awaiting.length}${awaiting.length ? `, oldest ${awaitingOldestDays}d` : ''}`,
    `• Unanswered messages: ${unanswered}`,
    `• Intake to review: ${intakeReview}`,
    `• At risk: ${atRiskClients}`,
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
  //
  // Client queues come FIRST and tickets after, because the order here is the order someone reads
  // it on a phone, and a member who has been waiting four days for the program she paid for
  // outranks an infrastructure note.
  const todo: string[] = [];
  if (awaiting.length > 0) {
    // OVERDUE_DAYS is the line between a backlog and a broken promise, so the wording changes at it.
    const overdue = awaitingOldestDays >= OVERDUE_DAYS;
    todo.push(
      `${overdue ? '⚠️ ' : ''}${awaiting.length} member${awaiting.length === 1 ? '' : 's'} waiting on a program` +
        `, oldest ${awaitingOldestDays}d${overdue ? ` (over the ${OVERDUE_DAYS}d line)` : ''} → /coach/awaiting`,
    );
  }
  if (unanswered > 0) {
    todo.push(
      `${unanswered} unanswered client message${unanswered === 1 ? '' : 's'}` +
        `, oldest ${unansweredOldestH}h → /coach/inbox`,
    );
  }
  if (intakeReview > 0) todo.push(`${intakeReview} intake${intakeReview === 1 ? '' : 's'} to review → /coach/intake`);
  if (atRiskClients > 0) todo.push(`${atRiskClients} client${atRiskClients === 1 ? '' : 's'} at risk (billing) → /coach/billing`);
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
export async function sendDailyRecap(
  svc: SupabaseClient,
  companyId: string,
  now = new Date(),
): Promise<{ ok: boolean; etDate: string; sent: boolean }> {
  try {
    const { text, etDate } = await buildDailyRecap(svc, companyId, now);
    const sent = await reply(text);
    return { ok: true, etDate, sent };
  } catch (e) {
    console.error('sendDailyRecap:', e instanceof Error ? e.message : e);
    return { ok: false, etDate: '', sent: false };
  }
}
