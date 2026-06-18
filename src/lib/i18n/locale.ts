// Server-side readers for the two independent locales.
// ui_locale drives interface strings (next-intl). content_locale drives which language
// content queries return, and falls back to ui_locale, then the default.
import 'server-only';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, type Locale } from '@/i18n/request';

export async function getUiLocale(): Promise<Locale> {
  const value = (await cookies()).get('ui_locale')?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getContentLocale(): Promise<Locale> {
  const store = await cookies();
  const content = store.get('content_locale')?.value;
  if (isLocale(content)) return content;
  const ui = store.get('ui_locale')?.value;
  return isLocale(ui) ? ui : defaultLocale;
}
