// Lazy Resend client. No SDK, no build-time crash without a key. Returns false if unconfigured.
import 'server-only';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? 'Thick & Fit <hello@teamthickandfit.com>';
const magnetUrl = process.env.LEAD_MAGNET_URL ?? '';

export async function sendLeadMagnet(to: string, locale: 'en' | 'es'): Promise<boolean> {
  if (!apiKey) return false; // not configured yet; lead is still captured
  const subject = locale === 'es' ? 'Tu guía gratuita de Thick & Fit' : 'Your free Thick & Fit guide';
  const text =
    locale === 'es'
      ? `Gracias por unirte a la lista. Descarga tu guía: ${magnetUrl}`
      : `Thanks for joining the waitlist. Download your guide: ${magnetUrl}`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
