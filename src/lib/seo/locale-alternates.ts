// Reciprocal hreflang for the public marketing pages.
//
// Google ignores hreflang wholesale unless the annotations point BOTH ways, so the English page and
// its Spanish twin must advertise the same language map. Building both sides from one helper is
// what guarantees that: there is no way to update one and forget the other.
//
// x-default points at the English URL because that is what an unmatched visitor should land on,
// and because "/" is where the IP-default cookie logic already routes people.
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { isEsPath } from '@/i18n/request';

/** The Spanish twin of an English marketing path. "/" maps to "/es", "/faq" to "/es/faq". */
export function esPathFor(enPath: string): string {
  return enPath === '/' ? '/es' : `/es${enPath}`;
}

/** Marketing routes that exist in both languages. */
// /privacy and /terms are here because App Store Connect takes ONE privacy-policy URL and Spanish
// speakers need a stable Spanish one to land on, rather than depending on whatever the cookie says.
const BILINGUAL_PATHS = ['/', '/pricing', '/faq', '/about', '/join', '/join/thanks', '/join/quiz', '/disclaimer', '/privacy', '/terms', '/support'] as const;

/**
 * Which language a marketing URL IS, as opposed to which language the visitor last picked.
 *
 * "es" for /es/*, "en" for the English twin of a bilingual route, null for everything else (the
 * app, /join, /auth/*), which keeps using the cookie.
 *
 * This exists because the URL has to be authoritative in BOTH directions. Making only /es
 * authoritative produced a one-way trap: /es wrote a one-year ui_locale=es cookie, nothing ever
 * wrote it back to en, so clicking EN in the nav landed on / and / still rendered Spanish from the
 * cookie. There was no route back to English from the UI, and the English canonical URL could serve
 * Spanish to a crawler.
 */
export function urlLocaleFor(pathname: string | null | undefined): 'en' | 'es' | null {
  const p = pathname ?? '';
  if (isEsPath(p)) {
    const bare = p === '/es' ? '/' : p.slice('/es'.length);
    return (BILINGUAL_PATHS as readonly string[]).includes(bare) ? 'es' : null;
  }
  return (BILINGUAL_PATHS as readonly string[]).includes(p) ? 'en' : null;
}

/** Public, unauthenticated pages, including their /es twins. Anything else is the app. */
const PUBLIC_PATHS = ['/', '/pricing', '/faq', '/about', '/join', '/terms', '/privacy', '/disclaimer'] as const;

/** Auth screens are publicly reachable too, and only read the `auth` namespace. Same for every
 *  nested page under /join (thank-you, quiz) — the whole funnel is unauthenticated. */
const PUBLIC_PREFIXES = ['/auth/', '/join/'] as const;

/**
 * True for a public marketing route. Used by the root layout to decide whether the client message
 * bundle should include the app namespace, which these pages never read.
 */
export function isPublicMarketingPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  const bare = isEsPath(p) ? (p === '/es' ? '/' : p.slice('/es'.length)) : p;
  if ((PUBLIC_PATHS as readonly string[]).includes(bare)) return true;
  return (PUBLIC_PREFIXES as readonly string[]).some((prefix) => bare.startsWith(prefix));
}

/**
 * Keeps in-page navigation inside the current language. On /es, a link to /pricing becomes
 * /es/pricing. Without this a Spanish visitor clicking "Precios" lands on the English canonical
 * URL, which serves Spanish via the cookie but tells Google that URL is English. Routes with no
 * Spanish twin (/join, /auth/*) pass through unchanged and rely on the cookie.
 */
export function withLocalePrefix(currentPathname: string | null | undefined, target: string): string {
  if (!isEsPath(currentPathname)) return target;
  return (BILINGUAL_PATHS as readonly string[]).includes(target) ? esPathFor(target) : target;
}

/**
 * The other language's URL for the page currently being served, or null if this route has no twin.
 * Used by the marketing nav so the switch is a real link between two real URLs rather than a cookie
 * write: a crawler follows it and discovers the Spanish surface, and a visitor can be linked
 * straight to the language they read.
 */
export function twinPathFor(pathname: string | null | undefined): { href: string; to: 'en' | 'es' } | null {
  const p = pathname ?? '/';
  if (isEsPath(p)) {
    const en = p === '/es' ? '/' : p.slice('/es'.length);
    return { href: en, to: 'en' };
  }
  if ((BILINGUAL_PATHS as readonly string[]).includes(p)) {
    return { href: esPathFor(p), to: 'es' };
  }
  return null;
}

/**
 * Alternates for a marketing page, given its ENGLISH path. Call from both the English page and its
 * /es twin: the language map is identical on purpose, only the canonical flips to the URL actually
 * being served, so each URL self-canonicalises instead of pointing at the other language.
 */
export async function localeAlternates(enPath: string): Promise<NonNullable<Metadata['alternates']>> {
  const pathname = (await headers()).get('x-pathname');
  const esPath = esPathFor(enPath);
  return {
    canonical: isEsPath(pathname) ? esPath : enPath,
    languages: {
      en: enPath,
      es: esPath,
      'x-default': enPath,
    },
  };
}
