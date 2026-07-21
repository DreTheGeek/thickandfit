// Lazy Resend client. No SDK, no build-time crash without a key. Returns false if unconfigured.
// All HTML goes through the branded shell (her logo, monochrome brand) in her voice; see
// .planning/STEPHANIE-VOICE-BIBLE.md.
import 'server-only';
import { emailShell, emailButton } from '@/lib/email/shell';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <hello@teamthickandfit.com>';
const magnetUrl = process.env.LEAD_MAGNET_URL ?? '';

export async function sendLeadMagnet(to: string, locale: 'en' | 'es'): Promise<boolean> {
  if (!apiKey) return false; // not configured yet; lead is still captured
  // Never email a broken "download your guide: <empty>" link. Until LEAD_MAGNET_URL is set the lead
  // is still captured + tagged in GHL; only the magnet email is skipped.
  if (!magnetUrl.trim()) return false;
  const es = locale === 'es';
  const subject = es ? 'Tu guía gratis, de mí para ti' : 'Your free guide, from me to you';
  const body = es
    ? [
        '<p>Hola,</p>',
        '<p>Gracias por unirte. Aquí tienes tu guía gratis, un primer paso conmigo. Sin prisa, un día a la vez.</p>',
        emailButton(magnetUrl, 'Descargar mi guía'),
        '<p>Nos vemos pronto. 🤍<br/>Steph</p>',
      ].join('')
    : [
        '<p>Hey,</p>',
        "<p>Thanks for joining us. Here's your free guide, a first step with me. No rush, one day at a time.</p>",
        emailButton(magnetUrl, 'Download my guide'),
        '<p>See you soon. 🤍<br/>Steph</p>',
      ].join('');
  const html = emailShell({ bodyHtml: body, preheader: es ? 'Tu guía gratis' : 'Your free guide' });
  const text = es
    ? `Gracias por unirte. Descarga tu guía: ${magnetUrl}`
    : `Thanks for joining us. Download your guide: ${magnetUrl}`;
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
