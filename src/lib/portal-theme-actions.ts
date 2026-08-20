'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { PORTAL_THEME_COOKIE, PORTAL_THEME_MAX_AGE, type PortalTheme } from '@/lib/portal-theme';

/**
 * Switch the member portal between light and dark.
 *
 * revalidatePath('/', 'layout') rather than a client-side class flip: the theme lives on the shell,
 * which is a server component, so the tree has to re-render for the attribute to change. Doing it
 * in JS instead would leave the server and client disagreeing about the ground colour on the next
 * navigation, which is the hydration class of bug this codebase has already paid for twice.
 */
export async function setPortalThemeAction(theme: PortalTheme): Promise<void> {
  if (theme !== 'light' && theme !== 'dark') return;
  (await cookies()).set(PORTAL_THEME_COOKIE, theme, {
    path: '/',
    maxAge: PORTAL_THEME_MAX_AGE,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
