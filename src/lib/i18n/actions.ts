'use server';
// Server actions to persist the two independent locales. Written to BOTH the cookie (immediate
// effect) and the signed-in user's profile (so the choice survives login on any device -- sign-in
// re-applies ui_locale from the profile).
import { cookies } from 'next/headers';
import { isLocale, type Locale } from '@/i18n/request';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const ONE_YEAR = 60 * 60 * 24 * 365;

async function persistToProfile(column: 'ui_locale' | 'content_locale', locale: Locale): Promise<void> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user) {
    await createServiceClient().from('profiles').update({ [column]: locale }).eq('id', user.id);
  }
}

export async function setUiLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set('ui_locale', locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  // Stamp the version marker too, or the middleware's one-time correction sweep would see an
  // unmarked browser on the very next request and recompute over the choice she just made. An
  // explicit pick is the strongest signal there is and must outrank any inference.
  jar.set('ui_locale_v', '2', { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  await persistToProfile('ui_locale', locale);
}

export async function setContentLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set('content_locale', locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  await persistToProfile('content_locale', locale);
}
