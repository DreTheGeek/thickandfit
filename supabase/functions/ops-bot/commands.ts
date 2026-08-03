// Two-way Telegram: the bot answers commands and button taps, not just fires alerts.
//
// Everything here is READ or STATUS-ONLY by design. The bot can tell you what is happening and move
// a ticket through its workflow. It cannot delete, refund, email a member, or change a member's
// account: those need an audit trail and a confirmation step that a chat message cannot provide.
//
// Sensitive ticket text never reaches this file's output. `/ticket` sends the generated SUMMARY and a
// link; the raw body may hold an SSN and stays behind the operator login.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, formatTicketNumber, reply, answerCallback, ticketKeyboard } from './telegram.ts';

const HELP = [
  '<b>Thick &amp; Fit ops bot</b>',
  '',
  '<b>Support</b>',
  '/open - open + in-progress tickets',
  '/ticket 3 - full detail for TKT-00000003',
  '/resolve 3 - mark it resolved',
  '/progress 3 - mark it in progress',
  '',
  '<b>Business</b>',
  '/today - signups, scans, logs, tickets in the last 24h',
  '/waitlist - waitlist totals and confirmation rate',
  '/scan - photo-scan health and what the engine has learned',
  '/health - integrations, crons, and anything failing',
  '',
  'Sensitive ticket text is never sent here. Use the app link on any ticket.',
].join('\n');

type TicketRow = {
  id: string; ticket_number: number; subject: string; status: string; priority: string;
  category: string | null; email: string | null; created_at: string; pii_flagged: boolean;
  triage: { summary?: string; suggestedReply?: string; memberContext?: string } | null;
  rep_name: string | null; company_name: string | null; attachment_url: string | null; video_url: string | null;
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Resolve "3", "TKT-00000003" or "#3" to a ticket number. */
function parseTicketNumber(arg: string): number | null {
  const m = arg.trim().replace(/^#/, '').match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function cmdOpen(svc: SupabaseClient, companyId: string): Promise<void> {
  const { data } = await svc
    .from('support_tickets')
    .select('id, ticket_number, subject, status, priority, created_at, pii_flagged')
    .eq('company_id', companyId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(15);
  const rows = (data ?? []) as TicketRow[];
  if (rows.length === 0) {
    await reply('<b>No open tickets.</b> Nothing is waiting on you.');
    return;
  }
  const lines = [`<b>${rows.length} open ticket${rows.length === 1 ? '' : 's'}</b>`, ''];
  for (const t of rows) {
    const flags = [t.priority === 'urgent' ? '🔴' : '', t.pii_flagged ? '🔒' : ''].filter(Boolean).join('');
    lines.push(`${esc(formatTicketNumber(t.ticket_number))} ${flags} ${esc(t.subject.slice(0, 60))}`);
    lines.push(`   ${t.status.replace('_', ' ')} · ${ago(t.created_at)} · /ticket ${t.ticket_number}`);
  }
  await reply(lines.join('\n'));
}

async function cmdTicket(svc: SupabaseClient, companyId: string, arg: string): Promise<void> {
  const num = parseTicketNumber(arg);
  if (!num) {
    await reply('Give me a ticket number, like <code>/ticket 3</code>.');
    return;
  }
  const { data } = await svc
    .from('support_tickets')
    .select('id, ticket_number, subject, status, priority, category, email, created_at, pii_flagged, triage, rep_name, company_name, attachment_url, video_url')
    .eq('company_id', companyId)
    .eq('ticket_number', num)
    .maybeSingle();
  const t = data as TicketRow | null;
  if (!t) {
    await reply(`No ticket ${esc(formatTicketNumber(num))}.`);
    return;
  }
  const lines = [
    `<b>${esc(formatTicketNumber(t.ticket_number))}</b> · ${esc(t.status.replace('_', ' '))} · ${esc(t.priority)}`,
    `<b>${esc(t.subject)}</b>`,
    '',
    `<b>From:</b> ${esc([t.rep_name, t.company_name].filter(Boolean).join(' · ') || t.email || 'unknown')}`,
    `<b>Category:</b> ${esc(t.category ?? 'uncategorized')}`,
    `<b>Opened:</b> ${ago(t.created_at)}`,
    '',
    // The SUMMARY only. The original text may hold an SSN and is not sent to a chat, ever.
    `<b>Summary:</b> ${esc(t.triage?.summary ?? 'Not summarized yet.')}`,
  ];
  if (t.triage?.memberContext) lines.push('', `<b>Account:</b> ${esc(t.triage.memberContext)}`);
  if (t.pii_flagged) lines.push('', '🔒 <i>Original text contains sensitive details. Open it in the app.</i>');
  if (t.attachment_url) lines.push('', '📎 Has an attachment.');
  if (t.video_url) lines.push(`🎥 ${esc(t.video_url)}`);
  await reply(lines.join('\n'), ticketKeyboard(t.id));
}

async function setStatus(
  svc: SupabaseClient, companyId: string, arg: string, status: 'in_progress' | 'resolved',
): Promise<void> {
  const num = parseTicketNumber(arg);
  if (!num) {
    await reply(`Give me a ticket number, like <code>/${status === 'resolved' ? 'resolve' : 'progress'} 3</code>.`);
    return;
  }
  const { data } = await svc
    .from('support_tickets')
    .update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })
    .eq('company_id', companyId)
    .eq('ticket_number', num)
    .select('ticket_number')
    .maybeSingle();
  if (!data) {
    await reply(`No ticket ${esc(formatTicketNumber(num))}.`);
    return;
  }
  await reply(`${esc(formatTicketNumber(num))} is now <b>${status.replace('_', ' ')}</b>.`);
}

async function cmdToday(svc: SupabaseClient, companyId: string): Promise<void> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const day = since.slice(0, 10);
  const [signups, scans, logs, tickets, leads] = await Promise.all([
    svc.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', since),
    svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').gte('created_at', since),
    svc.from('food_log').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('log_date', day),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', since),
    svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', since),
  ]);
  await reply(
    [
      '<b>Last 24 hours</b>',
      '',
      `New members: <b>${signups.count ?? 0}</b>`,
      `Waitlist signups: <b>${leads.count ?? 0}</b>`,
      `Photo scans: <b>${scans.count ?? 0}</b>`,
      `Foods logged: <b>${logs.count ?? 0}</b>`,
      `Support tickets: <b>${tickets.count ?? 0}</b>`,
    ].join('\n'),
  );
}

async function cmdWaitlist(svc: SupabaseClient, companyId: string): Promise<void> {
  const [total, confirmed, inGhl, converted] = await Promise.all([
    svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('confirmed_at', 'is', null),
    svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('ghl_contact_id', 'is', null),
    svc.from('waitlist_leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('converted_at', 'is', null),
  ]);
  const t = total.count ?? 0;
  const c = confirmed.count ?? 0;
  await reply(
    [
      '<b>Waitlist</b>',
      '',
      `Total leads: <b>${t}</b>`,
      `Confirmed: <b>${c}</b>${t ? ` (${Math.round((c / t) * 100)}%)` : ''}`,
      `In GoHighLevel: <b>${inGhl.count ?? 0}</b>`,
      `Converted to members: <b>${converted.count ?? 0}</b>`,
      t > 0 && c < t ? '\n<i>Unconfirmed leads earn no entries and get no drip.</i>' : '',
    ].filter(Boolean).join('\n'),
  );
}

async function cmdScan(svc: SupabaseClient, companyId: string): Promise<void> {
  const wk = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [total, week, corrected, priors] = await Promise.all([
    svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan'),
    svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').gte('created_at', wk),
    svc.from('ai_inferences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('feature', 'photo-scan').not('correction', 'is', null),
    svc.from('scan_population_bias').select('food_key, ratio, sample_count').eq('company_id', companyId).limit(5),
  ]);
  const lines = [
    '<b>Photo scan</b>',
    '',
    `Scans all time: <b>${total.count ?? 0}</b>`,
    `This week: <b>${week.count ?? 0}</b>`,
    `Corrected by members: <b>${corrected.count ?? 0}</b>`,
    '',
    '<b>What the engine has learned</b>',
  ];
  const rows = (priors.data ?? []) as { food_key: string; ratio: number; sample_count: number }[];
  if (rows.length === 0) {
    lines.push('<i>Nothing yet. Priors need 3+ members correcting the same food 6+ times.</i>');
  } else {
    for (const r of rows) {
      const pct = Math.round(Math.abs(Number(r.ratio) - 1) * 100);
      lines.push(`${esc(r.food_key)}: ${Number(r.ratio) > 1 ? 'under' : 'over'} by ${pct}% (n=${r.sample_count})`);
    }
  }
  await reply(lines.join('\n'));
}

/**
 * One integration's health, established from traffic it actually produced.
 *
 * WHY NOT AN ENV-VAR CHECK. The Vercel version reported `Boolean(process.env.STRIPE_SECRET_KEY)` and
 * friends. Ported literally into Deno that becomes six red crosses, because those variables live in
 * Vercel and this function cannot see them: a monitor confidently reporting a healthy system as
 * broken. But the env-var check was never good either. A key being present says nothing about
 * whether the integration works, and this project already took that position explicitly when it
 * audited Supabase auth "by observed behaviour, not by the flag reading true".
 *
 * So: three distinguishable states, because they need different reactions.
 *   ✅ traffic in the window, no errors
 *   ⚠️ traffic in the window, some of it failed  <- the only one that is actually a problem
 *   ○  quiet, but it has worked before           <- normal on a pre-launch day, NOT a failure
 *   ❌ never seen at all                          <- never wired up, or wired up wrong
 */
type Health = { label: string; recent: number; failed: number; lastIso: string | null };

/** Both mean the scan did not work. `notConfigured` is a broken key, which is a failure, not a skip. */
const SCAN_FAIL = ['error', 'notConfigured'];
/** email_send_log has no rows yet, so this is unexercised. Listed explicitly so it is not a guess. */
const EMAIL_FAIL = ['failed', 'bounced', 'complained'];

function healthLine(h: Health): string {
  if (h.lastIso === null) return `❌ ${h.label}: never seen`;
  if (h.recent === 0) return `○ ${h.label}: quiet, last ${ago(h.lastIso)}`;
  if (h.failed > 0) return `⚠️ ${h.label}: ${h.recent} in 24h, <b>${h.failed} failed</b>`;
  return `✅ ${h.label}: ${h.recent} in 24h`;
}

/** Counts and last-seen are best-effort: a probe that throws must not take down the whole report. */
async function counted(q: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function lastAt(q: PromiseLike<{ data: Record<string, string>[] | null }>, col: string): Promise<string | null> {
  try {
    const { data } = await q;
    return (data ?? [])[0]?.[col] ?? null;
  } catch {
    return null;
  }
}

/**
 * Assemble one integration's health from three queries: how much happened in the window, how much of
 * it failed, and when it last happened at all. Callers pass the queries explicitly rather than a
 * table name plus filter callbacks: every integration narrows differently, and a generic builder
 * here bought nothing but casts.
 */
async function health(
  label: string,
  recentQ: PromiseLike<{ count: number | null }>,
  failedQ: PromiseLike<{ count: number | null }> | null,
  lastQ: PromiseLike<{ data: Record<string, string>[] | null }>,
  col = 'created_at',
): Promise<Health> {
  const [recent, failed, lastIso] = await Promise.all([
    counted(recentQ),
    failedQ ? counted(failedQ) : Promise.resolve(0),
    lastAt(lastQ, col),
  ]);
  return { label, recent, failed, lastIso };
}

async function cmdHealth(svc: SupabaseClient, companyId: string): Promise<void> {
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: crons }, unsent, untriaged] = await Promise.all([
    svc.from('cron_job_log').select('job_name, status, ran_at').gte('ran_at', day).order('ran_at', { ascending: false }).limit(200),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('notified_at', null),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('triaged_at', null),
  ]);
  const rows = (crons ?? []) as { job_name: string; status: string | null; ran_at: string }[];
  const failed = rows.filter((r) => r.status && r.status !== 'success' && r.status !== 'succeeded');

  const head = { count: 'exact' as const, head: true };
  const integrations = await Promise.all([
    health(
      'OpenRouter',
      svc.from('ai_usage_log').select('id', head).eq('company_id', companyId).gte('created_at', day),
      null,
      svc.from('ai_usage_log').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1),
    ),
    health(
      'Photo scan',
      svc.from('ai_inferences').select('id', head).eq('company_id', companyId).eq('feature', 'photo-scan').gte('created_at', day),
      svc.from('ai_inferences').select('id', head).eq('company_id', companyId).eq('feature', 'photo-scan').in('status', SCAN_FAIL).gte('created_at', day),
      svc.from('ai_inferences').select('created_at').eq('company_id', companyId).eq('feature', 'photo-scan').order('created_at', { ascending: false }).limit(1),
    ),
    health(
      // NOT "Resend". Auth email (signup, reset, invite) goes Supabase SMTP -> Resend and never
      // touches this table, so a red mark here would not mean auth email is down. This measures only
      // the transactional email the APP sends, which so far is none.
      'App email',
      svc.from('email_send_log').select('id', head).eq('company_id', companyId).gte('created_at', day),
      svc.from('email_send_log').select('id', head).eq('company_id', companyId).in('status', EMAIL_FAIL).gte('created_at', day),
      svc.from('email_send_log').select('created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1),
    ),
    health(
      // No company_id on webhook_events: Stripe events arrive before we know whose they are.
      'Stripe',
      svc.from('webhook_events').select('id', head).gte('created_at', day),
      svc.from('webhook_events').select('id', head).not('error', 'is', null).gte('created_at', day),
      svc.from('webhook_events').select('created_at').order('created_at', { ascending: false }).limit(1),
    ),
    health(
      // A lead carrying a GHL contact id is proof the sync ran, which is the only part of GHL that
      // touches this database at all.
      'GoHighLevel',
      svc.from('waitlist_leads').select('id', head).eq('company_id', companyId).not('ghl_contact_id', 'is', null).gte('created_at', day),
      null,
      svc.from('waitlist_leads').select('created_at').eq('company_id', companyId).not('ghl_contact_id', 'is', null).order('created_at', { ascending: false }).limit(1),
    ),
  ]);

  const lines = [
    '<b>System health</b>',
    '',
    `Cron runs (24h): <b>${rows.length}</b>, failures: <b>${failed.length}</b>`,
  ];
  if (failed.length) for (const f of failed.slice(0, 5)) lines.push(`  ⚠️ ${esc(f.job_name)} (${esc(f.status ?? '')})`);
  // A recap that fired would have written a row. Nothing at all in 24h means the scheduler itself is
  // not reaching anything, which is precisely the condition the old Vercel-hosted check could not see.
  if (rows.length === 0) lines.push('  ⚠️ <b>No cron ran at all in 24h.</b> The scheduler is firing but nothing is answering.');
  lines.push(
    '',
    `Tickets never alerted: <b>${unsent.count ?? 0}</b>`,
    `Tickets not triaged: <b>${untriaged.count ?? 0}</b>`,
    '',
    '<b>Integrations</b> <i>(from real traffic, not config)</i>',
  );
  for (const h of integrations) lines.push(healthLine(h));
  lines.push('✅ Telegram: answering you now');
  await reply(lines.join('\n'));
}

/** Route one command. Unknown input gets the help text rather than silence. */
export async function handleCommand(svc: SupabaseClient, companyId: string, text: string): Promise<void> {
  const raw = text.trim();
  // Telegram appends @botname to commands sent in a group.
  const [cmdRaw, ...rest] = raw.split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@[\w_]+$/, '');
  const arg = rest.join(' ');

  switch (cmd) {
    case '/start':
    case '/help':
      await reply(HELP);
      return;
    case '/open':
    case '/tickets':
      await cmdOpen(svc, companyId);
      return;
    case '/ticket':
      await cmdTicket(svc, companyId, arg);
      return;
    case '/resolve':
      await setStatus(svc, companyId, arg, 'resolved');
      return;
    case '/progress':
      await setStatus(svc, companyId, arg, 'in_progress');
      return;
    case '/today':
    case '/stats':
      await cmdToday(svc, companyId);
      return;
    case '/waitlist':
      await cmdWaitlist(svc, companyId);
      return;
    case '/scan':
      await cmdScan(svc, companyId);
      return;
    case '/health':
      await cmdHealth(svc, companyId);
      return;
    default:
      if (cmd.startsWith('/')) await reply(HELP);
      return;
  }
}

/** Handle a button tap: `act:<status>:<ticketId>`. */
export async function handleCallback(
  svc: SupabaseClient, companyId: string, id: string, data: string,
): Promise<void> {
  const [kind, status, ticketId] = data.split(':');
  if (kind !== 'act' || !ticketId || (status !== 'in_progress' && status !== 'resolved')) {
    await answerCallback(id, 'Unknown action.');
    return;
  }
  const { data: row } = await svc
    .from('support_tickets')
    .update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })
    .eq('company_id', companyId)
    .eq('id', ticketId)
    .select('ticket_number')
    .maybeSingle();
  const n = (row as { ticket_number: number } | null)?.ticket_number;
  if (!n) {
    await answerCallback(id, 'Ticket not found.');
    return;
  }
  await answerCallback(id, `${formatTicketNumber(n)} → ${status.replace('_', ' ')}`);
  await reply(`${esc(formatTicketNumber(n))} is now <b>${status.replace('_', ' ')}</b>.`);
}
