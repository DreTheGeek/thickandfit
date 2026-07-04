// Branded transactional email for coach -> client messages (Resend, no SDK). Returns false when the
// key is unconfigured so the caller degrades to "recorded only" without throwing. The body is the
// coach's actual message; the CTA links the client into the app to reply.
import 'server-only';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <hello@teamthickandfit.com>';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendCoachEmail(
  to: string,
  subject: string,
  message: string,
  ctaUrl: string,
  firstName?: string | null,
): Promise<boolean> {
  if (!apiKey) return false;
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi,';
  const bodyHtml = esc(message).replace(/\n/g, '<br>');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#16140F">
    <p style="font-size:15px">${hi}</p>
    <div style="background:#F5F2EA;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.55;white-space:pre-wrap">${bodyHtml}</div>
    <p style="margin:20px 0"><a href="${esc(ctaUrl)}" style="background:#16140F;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">Open the app to reply</a></p>
    <p style="font-size:12px;color:#6F6A5F">Thick &amp; Fit &middot; You are receiving this because you are a coaching client.</p>
  </div>`;
  const text = `${hi}\n\n${message}\n\nOpen the app to reply: ${ctaUrl}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
