import 'server-only';
// Two-way Telegram: the bot answers commands and button taps, not just fires alerts.
//
// THE ACCESS CONTROL, first because everything else depends on it. @tnfsupportbot has a PUBLIC
// username. Anyone on Telegram can find it and send it messages. This module answers exactly one
// chat id (TELEGRAM_CHAT_ID) and silently ignores every other sender: no error reply, no hint that
// the bot does anything, because an error message is itself a signal worth probing. Without that
// lock, "/ticket 3" from a stranger would return a member's support history.
//
// Everything here is READ or STATUS-ONLY by design. The bot can tell you what is happening and move
// a ticket through its workflow. It cannot delete, refund, email a member, or change a member's
// account: those need an audit trail and a confirmation step that a chat message cannot provide.
import { createServiceClient } from '@/lib/supabase/service';
import { formatTicketNumber } from '@/lib/support/telegram-format';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').trim();
const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

/** The one chat this bot serves. Anything else is ignored outright. */
export function isAuthorizedChat(chatId: string | number | null | undefined): boolean {
  if (!CHAT_ID) return false;
  return String(chatId ?? '') === CHAT_ID;
}

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function api(method: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error(`telegram ${method}:`, r.status, (await r.text()).slice(0, 160));
    return r.ok;
  } catch (e) {
    console.error(`telegram ${method}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export async function reply(text: string, keyboard?: unknown): Promise<boolean> {
  return api('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

/** Acknowledge a button tap so Telegram stops showing the spinner. */
export async function answerCallback(id: string, text: string): Promise<void> {
  await api('answerCallbackQuery', { callback_query_id: id, text });
}

/** Action buttons attached to a ticket. Callback data is `act:<status>:<ticketId>`. */
export function ticketKeyboard(ticketId: string): unknown {
  return {
    inline_keyboard: [
      [
        { text: '▶ In progress', callback_data: `act:in_progress:${ticketId}` },
        { text: '✓ Resolve', callback_data: `act:resolved:${ticketId}` },
      ],
      [{ text: 'Open in app', url: `${APP_URL}/admin/support/${ticketId}` }],
    ],
  };
}

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

async function cmdOpen(companyId: string): Promise<void> {
  const svc = createServiceClient();
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

async function cmdTicket(companyId: string, arg: string): Promise<void> {
  const num = parseTicketNumber(arg);
  if (!num) {
    await reply('Give me a ticket number, like <code>/ticket 3</code>.');
    return;
  }
  const svc = createServiceClient();
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

async function setStatus(companyId: string, arg: string, status: 'in_progress' | 'resolved'): Promise<void> {
  const num = parseTicketNumber(arg);
  if (!num) {
    await reply(`Give me a ticket number, like <code>/${status === 'resolved' ? 'resolve' : 'progress'} 3</code>.`);
    return;
  }
  const svc = createServiceClient();
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

async function cmdToday(companyId: string): Promise<void> {
  const svc = createServiceClient();
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

async function cmdWaitlist(companyId: string): Promise<void> {
  const svc = createServiceClient();
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

async function cmdScan(companyId: string): Promise<void> {
  const svc = createServiceClient();
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

async function cmdHealth(companyId: string): Promise<void> {
  const svc = createServiceClient();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: crons }, unsent, untriaged] = await Promise.all([
    svc.from('cron_job_log').select('job_name, status, ran_at').gte('ran_at', day).order('ran_at', { ascending: false }).limit(200),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('notified_at', null),
    svc.from('support_tickets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('triaged_at', null),
  ]);
  const rows = (crons ?? []) as { job_name: string; status: string | null; ran_at: string }[];
  const failed = rows.filter((r) => r.status && r.status !== 'success' && r.status !== 'succeeded');
  const integrations = [
    ['Stripe', Boolean(process.env.STRIPE_SECRET_KEY)],
    ['OpenRouter', Boolean(process.env.OPENROUTER_API_KEY)],
    ['Resend', Boolean(process.env.RESEND_API_KEY)],
    ['USDA', Boolean(process.env.USDA_API_KEY)],
    ['GoHighLevel', Boolean(process.env.GHL_API_TOKEN || process.env.GHL_API_KEY)],
    ['Telegram', Boolean(TOKEN && CHAT_ID)],
  ] as const;
  const lines = [
    '<b>System health</b>',
    '',
    `Cron runs (24h): <b>${rows.length}</b>, failures: <b>${failed.length}</b>`,
  ];
  if (failed.length) for (const f of failed.slice(0, 5)) lines.push(`  ⚠️ ${esc(f.job_name)} (${esc(f.status ?? '')})`);
  lines.push('', `Tickets never alerted: <b>${unsent.count ?? 0}</b>`, `Tickets not triaged: <b>${untriaged.count ?? 0}</b>`, '', '<b>Integrations</b>');
  for (const [name, on] of integrations) lines.push(`${on ? '✅' : '❌'} ${name}`);
  await reply(lines.join('\n'));
}

/** Route one command. Unknown input gets the help text rather than silence. */
export async function handleCommand(companyId: string, text: string): Promise<void> {
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
      await cmdOpen(companyId);
      return;
    case '/ticket':
      await cmdTicket(companyId, arg);
      return;
    case '/resolve':
      await setStatus(companyId, arg, 'resolved');
      return;
    case '/progress':
      await setStatus(companyId, arg, 'in_progress');
      return;
    case '/today':
    case '/stats':
      await cmdToday(companyId);
      return;
    case '/waitlist':
      await cmdWaitlist(companyId);
      return;
    case '/scan':
      await cmdScan(companyId);
      return;
    case '/health':
      await cmdHealth(companyId);
      return;
    default:
      if (cmd.startsWith('/')) await reply(HELP);
      return;
  }
}

/** Handle a button tap: `act:<status>:<ticketId>`. */
export async function handleCallback(companyId: string, id: string, data: string): Promise<void> {
  const [kind, status, ticketId] = data.split(':');
  if (kind !== 'act' || !ticketId || (status !== 'in_progress' && status !== 'resolved')) {
    await answerCallback(id, 'Unknown action.');
    return;
  }
  const svc = createServiceClient();
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
