// First-visit UI locale. Pure: no imports beyond the Locale type, so it is unit-testable
// (see .qa-visual/locale-default-test.mjs).
//
// PRECEDENCE, and the ordering is the whole fix: the BROWSER's stated language beats the IP country.
//
// This module used to consult the IP country alone. Dre signed in from an English browser and got a
// Spanish app (2026-07-31). Accept-Language said en-US and nothing looked at it, because geolocation
// was treated as the only signal. That is backwards. Accept-Language is a preference a person (or
// their OS) actually SET; an IP country is an inference about where a packet entered the network,
// and it is wrong for travellers, VPNs, phone carriers that route through another country, and
// anyone on a corporate egress.
//
// So: an explicit signal beats an inferred one. Geolocation stays as the tiebreaker for the case it
// is genuinely good at, a visitor whose browser states no preference at all.
export type Locale = 'en' | 'es';
export const defaultLocale: Locale = 'en';

const SPANISH_DEFAULT = new Set([
  'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO',
  'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'ES',
]);

export function localeForCountry(country?: string | null): Locale {
  return country && SPANISH_DEFAULT.has(country.toUpperCase()) ? 'es' : defaultLocale;
}

/**
 * Read Accept-Language and return the preferred supported locale, or null when it states no opinion
 * between the two we serve.
 *
 * Honours q-weights, because "es;q=0.9, en;q=1.0" means English and a naive first-match would answer
 * Spanish. Returns null rather than a default when neither language appears, so the caller can fall
 * through to geolocation instead of this function silently deciding.
 */
export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  const raw = (header ?? '').trim();
  if (!raw) return null;

  let best: { locale: Locale; q: number } | null = null;
  for (const part of raw.split(',')) {
    const [tagRaw, ...params] = part.trim().split(';');
    const tag = tagRaw.trim().toLowerCase();
    if (!tag) continue;

    // Match the primary subtag: en, en-US, en-GB all mean English.
    const primary = tag.split('-')[0];
    const locale: Locale | null = primary === 'en' ? 'en' : primary === 'es' ? 'es' : null;
    // '*' is "anything", which is not a preference between en and es.
    if (!locale) continue;

    let q = 1;
    for (const p of params) {
      const m = /^\s*q=([0-9.]+)\s*$/i.exec(p);
      if (m) {
        const parsed = Number(m[1]);
        if (Number.isFinite(parsed)) q = parsed;
      }
    }
    if (q <= 0) continue; // q=0 explicitly REJECTS that language
    // Strictly greater, so an earlier entry wins a tie, matching header ordering semantics.
    if (!best || q > best.q) best = { locale, q };
  }
  return best?.locale ?? null;
}

/**
 * The locale a first-time visitor should get, with no cookie and no /es URL.
 *
 * Browser preference first, then country, then English.
 */
export function firstVisitLocale(acceptLanguage?: string | null, country?: string | null): Locale {
  return localeFromAcceptLanguage(acceptLanguage) ?? localeForCountry(country);
}
