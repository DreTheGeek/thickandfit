import 'server-only';
// The ticket, as an email. Same information and same ORDER as /admin/support/[id], so a ticket reads
// identically whether it arrives in Telegram, in an inbox, or in the app.
//
// PII RULE, and this is where it differs from the app. The detail page shows the original text
// because it sits behind an operator login. Email does not: it forwards, it syncs to phones, it
// lands in whatever client the recipient uses, and it is the single easiest place for a member's SSN
// to escape. So the email carries the REDACTED body when anything was flagged, plus a link. The
// unredacted text is reachable in exactly one place, which is the whole point of the design.
import { emailShell, emailButton } from '@/lib/email/shell';
import { formatTicketNumber } from '@/lib/support/telegram-format';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <noreply@teamthickandfit.com>';
const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type TicketEmail = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  category: string | null;
  priority: string;
  email: string | null;
  repName: string | null;
  repPhone: string | null;
  companyName: string | null;
  createdAt: string;
  summary: string | null;
  /** Already-redacted when piiFlagged. Callers must not pass the raw body. */
  bodyForEmail: string | null;
  piiFlagged: boolean;
  piiKinds: string[];
  attachmentUrl: string | null;
  videoUrl: string | null;
};

const PII_LABEL: Record<string, string> = {
  ssn: 'a social security number',
  card: 'a payment card',
  dob: 'a date of birth',
  passport: 'an ID number',
  bank: 'an account number',
};

/** Small uppercase label above a value, matching the app's detail layout. */
function field(label: string, value: string | null): string {
  if (!value) return '';
  return [
    '<tr><td style="padding:0 0 14px 0;">',
    `<div style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#8a8a8a;">${esc(label)}</div>`,
    `<div style="font-size:14px;color:#0f0f0f;margin-top:2px;">${esc(value)}</div>`,
    '</td></tr>',
  ].join('');
}

function section(title: string, inner: string): string {
  return [
    `<div style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#8a8a8a;margin:22px 0 6px 0;">${esc(title)}</div>`,
    inner,
  ].join('');
}

export function buildTicketEmailHtml(t: TicketEmail): string {
  const when = new Date(t.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const kinds = t.piiKinds.map((k) => PII_LABEL[k] ?? k).join(', ');

  const parts: string[] = [
    `<div style="font-size:22px;font-weight:700;color:#0f0f0f;">${esc(formatTicketNumber(t.ticketNumber))}</div>`,
    `<div style="font-size:13px;color:#8a8a8a;margin-top:2px;">Submitted ${esc(when)} · ${esc(t.status.replace('_', ' '))} · ${esc(t.priority)}</div>`,
    `<div style="font-size:16px;font-weight:600;color:#0f0f0f;margin-top:14px;">${esc(t.subject)}</div>`,
  ];

  if (t.piiFlagged) {
    // Table-based, inline-styled: Gmail and Outlook strip <style> blocks and flexbox.
    parts.push(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">',
      '<tr><td style="background:#fdecec;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.55;color:#8a1f1f;">',
      `The reporter included ${esc(kinds || 'sensitive details')}. It has been removed from this email. `,
      'Open the ticket in the app to see the original.',
      '</td></tr></table>',
    );
  }

  if (t.summary) parts.push(section('Summary', `<div style="font-size:14px;line-height:1.6;color:#0f0f0f;">${esc(t.summary)}</div>`));

  parts.push(
    section(
      t.piiFlagged ? 'Original description (redacted)' : 'Original description',
      `<div style="font-size:14px;line-height:1.6;color:#0f0f0f;white-space:pre-wrap;">${esc(t.bodyForEmail || 'No description was provided.')}</div>`,
    ),
  );

  const rows = [
    field('Company', t.companyName),
    field('Category', t.category),
    field('Rep name', t.repName),
    field('Rep email', t.email),
    field('Rep phone', t.repPhone),
  ].join('');
  if (rows) parts.push(section('Reporter', `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:4px;">${rows}</table>`));

  if (t.attachmentUrl) {
    parts.push(
      section(
        'Attachment',
        `<img src="${esc(t.attachmentUrl)}" alt="Ticket attachment" style="display:block;max-width:100%;border:1px solid #e6e3dc;border-radius:10px;" />`,
      ),
    );
  }
  if (t.videoUrl) parts.push(`<div style="margin-top:12px;font-size:14px;"><a href="${esc(t.videoUrl)}" style="color:#0f0f0f;">Watch the video</a></div>`);

  // emailButton(href, label). Both params are strings, so a swapped call type-checks fine and ships
  // a button labelled with a URL; the only guard is reading the signature.
  parts.push(emailButton(`${APP_URL}/admin/support/${t.id}`, 'Open ticket'));

  return emailShell({
    bodyHtml: parts.join(''),
    preheader: t.summary?.slice(0, 120) || t.subject,
  });
}

/** Plain-text twin. Some clients show only this, and a blank text part hurts deliverability. */
export function buildTicketEmailText(t: TicketEmail): string {
  return [
    `${formatTicketNumber(t.ticketNumber)} · ${t.status} · ${t.priority}`,
    t.subject,
    '',
    t.summary ? `Summary: ${t.summary}` : '',
    '',
    t.piiFlagged ? 'The reporter included sensitive details; they were removed from this email.' : '',
    t.bodyForEmail || '',
    '',
    `Open: ${APP_URL}/admin/support/${t.id}`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** Send it. No-ops without a Resend key; never throws. */
export async function sendTicketEmail(to: string, t: TicketEmail): Promise<boolean> {
  if (!apiKey || !to.trim()) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `${formatTicketNumber(t.ticketNumber)} · ${t.subject.slice(0, 90)}`,
        html: buildTicketEmailHtml(t),
        text: buildTicketEmailText(t),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('sendTicketEmail:', res.status, (await res.text()).slice(0, 160));
    return res.ok;
  } catch (e) {
    console.error('sendTicketEmail:', e instanceof Error ? e.message : e);
    return false;
  }
}
