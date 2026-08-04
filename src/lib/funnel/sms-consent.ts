import 'server-only';
// The evidence side of the SMS disclosure on the waitlist form.
//
// The form renders funnel.phoneConsent next to the phone field. That rendering is what PERMITS a
// text under TCPA. This module builds what DEFENDS one: the exact words she was shown, plus when
// and from where. Migration 0114 stores it on the lead.
//
// The disclosure is resolved HERE, on the server, from the same message catalog the form renders,
// rather than being posted up by the browser. A client-supplied consent string is a string the
// claimant's own script could have written, which is the opposite of proof.
import { z } from 'zod';
import { headers } from 'next/headers';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import { getUiLocale } from '@/lib/i18n/locale';
import { isEsPath, type Locale } from '@/i18n/request';

// Typed off the catalogs, so deleting or renaming the key fails the typecheck instead of silently
// recording an empty disclosure. The two must stay the literal strings the form paints.
const DISCLOSURE: Record<Locale, string> = {
  en: en.funnel.phoneConsent,
  es: es.funnel.phoneConsent,
};

/** What we can prove about a single act of consent. */
export type SmsConsentContext = {
  /** The disclosure exactly as rendered to her, in the language she was reading. */
  disclosure: string;
  /** Client IP, from the caller's existing reader. Never re-derived here. */
  ip: string;
  /** Browser user agent, or null when the request carried none. */
  userAgent: string | null;
};

// Same Zod discipline as every other field crossing this boundary. Bounds are generous because a
// weird-but-real user agent must never cost a real member her consent record; the caller truncates
// rather than letting an odd header fail the parse.
export const smsConsentContextSchema = z.object({
  disclosure: z.string().trim().min(1).max(4000),
  ip: z.string().trim().min(1).max(64),
  userAgent: z.string().trim().min(1).max(500).nullable(),
});

/**
 * Which language was actually on screen when she read the disclosure.
 *
 * Not the same question as "which language does she want the drip in". The form has a language
 * toggle that sets the drip preference and does NOT re-render the page, so the submitted `locale`
 * can disagree with the words she just read. Recording the Spanish text for a woman who saw the
 * English one is precisely the fabrication this whole record exists to avoid.
 *
 * Resolution mirrors src/i18n/request.ts, in its order: the /es/* routes render Spanish for anyone
 * with or without a cookie, so the page path wins when the Referer gives us one; otherwise the
 * ui_locale cookie decides, exactly as it did for the page. Referrer-Policy is
 * strict-origin-when-cross-origin (next.config.ts), so a same-origin POST carries the full path.
 */
async function resolveRenderedLocale(referer: string | null): Promise<Locale> {
  if (referer) {
    try {
      if (isEsPath(new URL(referer).pathname)) return 'es';
    } catch {
      // Not a parseable URL. Fall through to the cookie rather than guessing.
    }
  }
  return getUiLocale();
}

/**
 * Build the consent context for the current request. Says nothing about whether consent was GIVEN:
 * that turns on her having actually typed a phone number, and is decided by the writer in
 * funnel/service.ts. This only answers "what was on screen, from where, right now".
 *
 * @param ip the caller's already-resolved client IP, so there is one reader of that header and not two.
 */
export async function buildSmsConsentContext(ip: string): Promise<SmsConsentContext> {
  const h = await headers();
  const locale = await resolveRenderedLocale(h.get('referer'));
  return smsConsentContextSchema.parse({
    disclosure: DISCLOSURE[locale],
    ip: ip.slice(0, 64),
    userAgent: h.get('user-agent')?.slice(0, 500) || null,
  });
}
