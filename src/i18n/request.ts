// next-intl request config (no URL routing). UI locale comes from the `ui_locale` cookie,
// set by the LanguageToggle or the IP-default middleware. Content locale is tracked separately.
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

/** True for the public Spanish marketing routes (/es, /es/pricing, ...). */
export function isEsPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return p === '/es' || p.startsWith('/es/');
}

export default getRequestConfig(async () => {
  // The URL wins over the cookie. A crawler never sends ui_locale, so cookie-only resolution meant
  // Spanish had no addressable URL and could not be indexed or cited at all. The /es/* routes are
  // the Spanish surface, and they must render Spanish for anyone, cookie or not.
  const pathname = (await headers()).get('x-pathname');
  if (isEsPath(pathname)) {
    return { locale: 'es', messages: (await import('../messages/es.json')).default };
  }

  const cookieLocale = (await cookies()).get('ui_locale')?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
