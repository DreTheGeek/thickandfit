// Lazy Resend client. No SDK, no build-time crash without a key. Returns false if unconfigured.
// All HTML goes through the branded shell (her logo, monochrome brand) in her voice; see
// .planning/STEPHANIE-VOICE-BIBLE.md.
import 'server-only';
import { emailShell, emailButton } from '@/lib/email/shell';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <hello@teamthickandfit.com>';
const magnetUrl = process.env.LEAD_MAGNET_URL ?? '';

/**
 * Waitlist double-opt-in confirmation email. kb-funnels doctrine: confirmations gate DELIVERABILITY
 * (drip suppression for unconfirmed), never the thank-you page — the thanks page loads instantly
 * regardless. This email arrives moments after signup, one big Confirm button, bilingual + Stephanie
 * voice. Absent RESEND_API_KEY the whole call is a no-op (lead is still captured on signup).
 */
export async function sendWaitlistConfirmation(
  to: string,
  locale: 'en' | 'es',
  confirmUrl: string,
): Promise<boolean> {
  if (!apiKey) return false; // not configured yet; signup already succeeded
  const es = locale === 'es';
  const subject = es
    ? 'Confirma tu correo · Thick & Fit'
    : 'Confirm your email · Thick & Fit';
  const body = es
    ? [
        '<p>Hola,</p>',
        '<p>Estás en la lista. Un último paso para que reciba mis mensajes: confirma que este correo es tuyo.</p>',
        emailButton(confirmUrl, 'Confirmar mi correo'),
        '<p>Si no fuiste tú, ignora este correo.</p>',
        '<p>Nos vemos pronto. 🤍<br/>Steph</p>',
      ].join('')
    : [
        '<p>Hey,</p>',
        "<p>You're on the list. One last step so my emails actually reach your inbox: confirm this email is yours.</p>",
        emailButton(confirmUrl, 'Confirm my email'),
        '<p>If this was not you, ignore this email.</p>',
        '<p>See you soon. 🤍<br/>Steph</p>',
      ].join('');
  const html = emailShell({
    bodyHtml: body,
    preheader: es ? 'Un último paso: confirma tu correo' : 'One last step: confirm your email',
  });
  const text = es
    ? `Confirma tu correo abriendo este enlace: ${confirmUrl}`
    : `Confirm your email by opening this link: ${confirmUrl}`;
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
