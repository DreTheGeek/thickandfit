import 'server-only';
import { cookies } from 'next/headers';

/**
 * Light or dark for the member portal. LIGHT IS THE DEFAULT.
 *
 * A cookie rather than a profile column, for the same reason ui_locale started as one: the shell
 * renders on the server on every request and a cookie is already there, where a column costs a read
 * on the hot path of every single screen. The trade is that the choice does not follow her to a new
 * device, which for a theme is a much smaller loss than for a language.
 *
 * ONE YEAR, because unlike a locale inferred from an IP this is only ever written by someone
 * tapping the control. There is no inference to expire.
 */
export type PortalTheme = 'light' | 'dark';

export const PORTAL_THEME_COOKIE = 'portal_theme';
export const PORTAL_THEME_MAX_AGE = 60 * 60 * 24 * 365;

export async function readPortalTheme(): Promise<PortalTheme> {
  const v = (await cookies()).get(PORTAL_THEME_COOKIE)?.value;
  return v === 'dark' ? 'dark' : 'light';
}
