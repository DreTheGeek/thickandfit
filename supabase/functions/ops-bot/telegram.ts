// Telegram transport for the ops bot, running in Deno on Supabase.
//
// WHY THIS LIVES HERE AND NOT ON VERCEL. On 2026-08-01 the Vercel project was soft-blocked for a
// fluid-compute overage. pg_cron kept firing on schedule (60 successful jobs) and every one of them
// got a 402 back, so the 9pm recap never sent, `cron_job_log` recorded nothing (it is written by the
// route that never ran), and the bot went completely silent. The outage was found by opening the site
// by hand the next morning.
//
// A monitor that shares a failure domain with the thing it monitors reports "all clear" by being
// silent, which is the worst property a monitor can have. Everything the bot needs is in Postgres and
// on api.telegram.org, so nothing here has any reason to route through the app.
//
// The 15 lines duplicated from src/lib/support/telegram-format.ts (esc + formatTicketNumber) are
// deliberate: that module stays on Vercel because ticket alerts fire in the request path of a ticket
// submission, which is correctly in the app's failure domain. Duplicating two pure string helpers is
// cheaper than a shared build step between a Next app and a Deno function.
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const CHAT_ID = (Deno.env.get('TELEGRAM_CHAT_ID') ?? '').trim();
export const APP_URL = (Deno.env.get('SITE_URL') || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

export function telegramConfigured(): boolean {
  return Boolean(TOKEN && CHAT_ID);
}

/**
 * The one chat this bot serves.
 *
 * @tnfsupportbot has a PUBLIC username, so anyone on Telegram can find it and send it messages and
 * Telegram will faithfully deliver them to us. Every other sender is ignored outright, with no error
 * reply: an error is itself a signal that something here is worth probing. Without this lock,
 * "/ticket 3" from a stranger returns a member's support history.
 */
export function isAuthorizedChat(chatId: string | number | null | undefined): boolean {
  if (!CHAT_ID) return false;
  return String(chatId ?? '') === CHAT_ID;
}

/** Telegram HTML mode: escape the three characters it treats as markup. */
export function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** TKT-00000006. Stable width so the numbers line up in a chat transcript. */
export function formatTicketNumber(n: number | bigint | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 'TKT-00000000';
  return `TKT-${String(Math.floor(v)).padStart(8, '0')}`;
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

/**
 * Constant-time string compare, for the two shared secrets this function checks.
 *
 * Length is compared first and returns early, which does leak length. That is fine here: both
 * secrets are fixed-length values we generated, so length carries no information an attacker could
 * not already guess.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
