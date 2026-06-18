'use server';
// Server actions to persist the two independent locales as cookies.
import { cookies } from 'next/headers';
import { isLocale } from '@/i18n/request';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setUiLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set('ui_locale', locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
}

export async function setContentLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set('content_locale', locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
}
