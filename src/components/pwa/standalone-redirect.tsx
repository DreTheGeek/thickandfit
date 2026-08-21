'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * In the INSTALLED app, the marketing landing page is never the right screen.
 *
 * "On the pwa, i dont want the landing page to load. i want it to be staight to login."
 *
 * The manifest already says `start_url: /dashboard`, and /dashboard already 307s an unauthenticated
 * visitor to /auth/sign-in. Neither of those helps an app that was ALREADY INSTALLED, because
 * start_url is captured at install time and editing the manifest does not reach back into a
 * home-screen icon somebody added months ago. On iOS especially it stays whatever it was.
 *
 * So this is the retrofit: if the app is running standalone and has somehow landed on a marketing
 * page, send it into the app. A signed-in member gets Today; a signed-out one gets the sign-in
 * screen, via the redirect that already exists.
 *
 * ONLY THE TWO LANDING PAGES. Not /join, not the legal pages, not /auth. Someone in the installed
 * app can have a real reason to be on any of those - an App Store reviewer needs /privacy to be
 * reachable, and a member may be reading /terms - and hijacking every public route would be a
 * bigger behaviour change than the problem being solved.
 *
 * `replace`, not `push`, so the back gesture does not walk her straight back onto the page she was
 * just moved off.
 */
const LANDING = new Set(['/', '/es']);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari has never supported the display-mode media query for home-screen apps and uses this
  // non-standard flag instead. A Latin-American audience skews Android, but Stephanie and her team
  // are on iPhones, so both paths matter.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayMode =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  return iosStandalone || displayMode;
}

export function StandaloneRedirect(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (!LANDING.has(pathname)) return;
    if (!isStandalone()) return;
    window.location.replace('/dashboard');
  }, [pathname]);

  return null;
}
