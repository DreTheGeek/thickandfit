import 'server-only';
// Branded, email-client-safe HTML shell for every Thick & Fit transactional email. Table-based
// layout + inline styles only (Gmail/Outlook strip <style> and flexbox). Monochrome brand per
// .planning/STEPHANIE-VOICE-BIBLE.md: warm cream ground, white card, ink text, ink (not green)
// buttons. Her wordmark sits at the top with a text alt for clients that block images.

// Served from public/brand/. Points at the live app origin; falls back to the known-good host.
//
// PNG, NOT the logo-black.svg this used to load. Two independent reasons, both observed in a real
// Gmail iOS inbox on 2026-07-30:
//   1. Gmail blocks SVG in email outright. Several other clients do too.
//   2. Dark mode. Clients invert CSS colors but never image PIXELS, so the white card below turned
//      dark while the black wordmark stayed black, and the logo vanished into the background.
// logo-email.png is the dark-mode-safe asset built for exactly this: the mark sits on an OPAQUE
// WHITE PLATE, so it stays legible no matter what the client does to the surrounding card.
const LOGO_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '') +
  '/brand/logo-email.png';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Wrap body HTML in the branded shell. `preheader` is the hidden inbox-preview line. */
export function emailShell(opts: { bodyHtml: string; preheader?: string }): string {
  const pre = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
    : '';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width"></head>',
    '<body style="margin:0;padding:0;background:#e7e5df;">',
    pre,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7e5df;padding:32px 0;">',
    '<tr><td align="center">',
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border-radius:16px;overflow:hidden;">',
    '<tr><td style="padding:28px 32px 8px 32px;">',
    // background:#ffffff on the image itself so the plate survives even if a client ever serves a
    // transparent variant; without it a transparent PNG would reintroduce the vanishing-logo bug.
    `<img src="${LOGO_URL}" width="150" alt="Thick &amp; Fit" style="display:block;border:0;width:150px;height:auto;background:#ffffff;">`,
    '</td></tr>',
    `<tr><td style="padding:8px 32px 28px 32px;font-family:${FONT};font-size:16px;line-height:1.6;color:#0f0f0f;">`,
    opts.bodyHtml,
    '</td></tr>',
    '</table>',
    `<div style="font-family:${FONT};font-size:12px;color:#757575;padding:18px 20px 0;max-width:480px;">Thick &amp; Fit by Steph. You are getting this because you are part of the community.</div>`,
    '</td></tr></table>',
    '</body></html>',
  ].join('');
}

/** Branded CTA button. Ink on cream is the brand's emphasis, never green. */
export function emailButton(href: string, label: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">',
    '<tr><td style="border-radius:10px;background:#0f0f0f;">',
    `<a href="${href}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>`,
    '</td></tr></table>',
  ].join('');
}
