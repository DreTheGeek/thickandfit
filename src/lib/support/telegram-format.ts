// Pure formatting for the Telegram ticket alert. No DB, no network, no `@/` imports, so it is
// unit-testable on its own (see .qa-visual/telegram-alert-test.mjs).
//
// Split from telegram.ts for more than testability. THE SECURITY PROPERTY of this relay is that the
// raw reported text cannot reach a chat, and the cleanest way to guarantee that is a message builder
// with no access to anything: it receives a small explicit struct, so there is no `body` in scope for
// a future edit to reach for.
const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

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
  piiFlagged: boolean;
  hasAttachment: boolean;
  videoUrl: string | null;
  /** Optional inline keyboard (Telegram reply_markup). Opaque here; built by telegram-commands. */
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
  if (t.videoUrl) lines.push(`<b>Video:</b> ${esc(t.videoUrl)}`);
  if (t.piiFlagged) {
    lines.push('', '<i>The reported text contained sensitive details. They were kept out of this message; open the ticket to see them.</i>');
  }
  return lines.join('\n');
}

