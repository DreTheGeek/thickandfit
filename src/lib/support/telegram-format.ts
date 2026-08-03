// Pure formatting for the Telegram ticket alert. No DB, no network, no `@/` imports, so it is
// unit-testable on its own (see .qa-visual/telegram-alert-test.mjs).
//
// Split from telegram.ts for more than testability. THE SECURITY PROPERTY of this relay is that the
// raw reported text cannot reach a chat, and the cleanest way to guarantee that is a message builder
// with no access to anything: it receives a small explicit struct, so there is no `body` in scope for
// a future edit to reach for.
const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

/**
 * Action buttons attached to a ticket alert. Callback data is `act:<status>:<ticketId>`.
 *
 * The taps are HANDLED in the Supabase edge function (supabase/functions/ops-bot/), which is where
 * the bot now lives. Only the button definition stays here, because the alert that carries it is
 * sent by the app the moment a ticket is submitted. Keep the callback_data format in step with
 * handleCallback() over there: this side writes it, that side parses it.
 */
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

/** urgent reads louder than "urgent". The mark is the point: this list is scanned, not read. */
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '🔴 Urgent',
  high: '🟠 High',
  normal: 'Normal',
  low: 'Low',
};

/** TKT-00000006. Stable width so the numbers line up in a chat transcript. */
export function formatTicketNumber(n: number | bigint | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 'TKT-00000000';
  return `TKT-${String(Math.floor(v)).padStart(8, '0')}`;
}

/** Telegram HTML mode: escape the five characters it treats as markup. */
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export type TicketAlert = {
  id: string;
  ticketNumber: number;
  repName: string | null;
  companyName: string | null;
  category: string | null;
  email: string | null;
  /** The generated summary. PII-free by construction; never the raw body. */
  summary: string | null;
  /** low | normal | high | urgent. The first thing that decides whether to stop what you are doing. */
  priority: string | null;
  /**
   * Who this member is to the business, in system fields only: role, whether they are paying, how
   * long they have been here, how many tickets they have filed before.
   *
   * Deliberately NOT free text she wrote. The rule that the raw body never reaches a chat holds for
   * everything derived from it too, so this is assembled from columns, not from her words.
   */
  memberContext: string | null;
  piiFlagged: boolean;
  hasAttachment: boolean;
  videoUrl: string | null;
  /** Optional inline keyboard (Telegram reply_markup). Built by ticketKeyboard() above. */
  keyboard?: unknown;
};

/**
 * Compose the alert. PURE and exported so the format is unit-testable without a bot token, and so a
 * test can assert that a raw body cannot appear in it.
 */
export function buildTicketMessage(t: TicketAlert): string {
  const who = [t.repName?.trim(), t.companyName?.trim()].filter(Boolean).join(' from ');
  const lines = [
    `<b>New Support Ticket Opened: ${esc(formatTicketNumber(t.ticketNumber))}</b>`,
    '',
    who ? `${esc(who)} just submitted a ticket.` : 'A new ticket was submitted.',
    '',
    `<b>Category:</b> ${esc(t.category ?? 'Uncategorized')}`,
    // Priority decides whether this interrupts the day. It was computed and stored from the first
    // ticket onward and simply never made it into the message.
    `<b>Priority:</b> ${esc(PRIORITY_LABEL[t.priority ?? ''] ?? t.priority ?? 'normal')}`,
    `<b>POC Email:</b> ${esc(t.email ?? 'not given')}`,
    '',
    `<b>Summary:</b> ${esc(t.summary?.trim() || 'Not summarized yet.')}`,
    '',
    // The link is the payload. Anything sensitive lives behind it, not in this message.
    `<b>Ticket:</b> ${APP_URL}/admin/support/${t.id}`,
    '',
    `<b>PII Flagged:</b> ${t.piiFlagged ? 'True' : 'False'}`,
    `<b>Attachment:</b> ${t.hasAttachment ? 'True' : 'False'}`,
  ];
  // "Who is this" sits at the bottom, because it changes HOW you reply rather than WHETHER you do.
  // A paying member of eight months on her fourth ticket is a different conversation from a free
  // account that signed up an hour ago.
  if (t.memberContext?.trim()) lines.push('', `<b>Member:</b> ${esc(t.memberContext.trim())}`);
  if (t.videoUrl) lines.push(`<b>Video:</b> ${esc(t.videoUrl)}`);
  if (t.piiFlagged) {
    lines.push('', '<i>The reported text contained sensitive details. They were kept out of this message; open the ticket to see them.</i>');
  }
  return lines.join('\n');
}

