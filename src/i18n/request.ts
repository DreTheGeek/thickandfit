// next-intl request config (no URL routing). UI locale comes from the `ui_locale` cookie,
// set by the LanguageToggle or the IP-default middleware. Content locale is tracked separately.
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('ui_locale')?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
