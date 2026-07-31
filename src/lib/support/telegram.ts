import 'server-only';
// Telegram relay for new support tickets.
//
// THE SECURITY PROPERTY, stated once so it is not eroded later: this module may send the generated
// SUMMARY, the ticket metadata, and a LINK. It must never send `body`. A Telegram chat is a
// third-party server, a phone lock screen, and everyone who gets added to the group next year. The
// database is behind an operator login; the chat is not, so the chat gets a pointer and the operator
// clicks through for anything sensitive.
//
// That is also why a PII-flagged ticket still sends: the alert is how anyone finds out a ticket
// exists. It just says PII was found rather than repeating it.
//
// Fully optional. With no TELEGRAM_BOT_TOKEN the module no-ops, so support works without it and no
// build or test needs the credential.
import { createServiceClient } from '@/lib/supabase/service';
import { buildTicketMessage, type TicketAlert } from '@/lib/support/telegram-format';

export { buildTicketMessage, formatTicketNumber } from '@/lib/support/telegram-format';
export type { TicketAlert } from '@/lib/support/telegram-format';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function telegramConfigured(): boolean {
  return Boolean(TOKEN && CHAT_ID);
}

/**
 * Send the alert and stamp notified_at on success.
 *
 * Never throws and never blocks: a ticket that exists but was not announced is recoverable (the
 * board still shows it, and notified_at being null makes it findable). A ticket lost because the
 * relay threw is not.
 */
export async function sendTicketAlert(t: TicketAlert): Promise<{ sent: boolean }> {
  if (!telegramConfigured()) return { sent: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: buildTicketMessage(t),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('sendTicketAlert:', res.status, (await res.text()).slice(0, 200));
      return { sent: false };
    }
    await createServiceClient()
      .from('support_tickets')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', t.id);
    return { sent: true };
  } catch (e) {
    console.error('sendTicketAlert:', e instanceof Error ? e.message : e);
    return { sent: false };
  }
}
