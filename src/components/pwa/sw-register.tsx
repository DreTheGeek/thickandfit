'use client';
import { useEffect } from 'react';

/**
 * Register the service worker, and make sure an installed app actually PICKS UP a deploy.
 *
 * WHAT WAS MISSING. This used to be `register('/sw.js')` and nothing else. Registration alone does
 * not keep an app current: a browser only re-fetches sw.js on a navigation or on its own roughly
 * daily check, and a standalone PWA that is never fully closed does neither. Stephanie's team live
 * in this app all day. They could be running a build from last week and there was nothing anywhere
 * that would tell them, or fix it.
 *
 * On the web that gap is small, because navigations are network-first so any page load gets fresh
 * HTML. In the INSTALLED app, and in the iOS shell (which is a Capacitor wrapper pointing at this
 * same URL, so it ships web updates without an App Store review), a session can stay open for days.
 *
 * Three parts:
 *   1. ASK. Re-check for a new worker whenever the app comes back to the foreground, which is the
 *      moment she is about to use it and the moment a stale build starts to matter.
 *   2. NOTICE. sw.js calls skipWaiting(), so a new worker activates as soon as it is found and
 *      claims the open page. That page is still running the OLD JavaScript, which is the actual
 *      stale state worth fixing.
 *   3. RELOAD, BUT ONLY WHEN IT IS FREE. Never mid-workout: reloading a member between sets is
 *      hostile, and the player's state is hers. Reload while the tab is hidden (nobody is looking),
 *      or the next time she brings it back to the foreground from anywhere that is not the player.
 */
export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let pending = false;
    // A page that had NO controller is a first install, not an update. Reloading there would make
    // every brand-new visitor's first page load flash for no reason.
    let hadController = navigator.serviceWorker.controller != null;
    // location.reload() can re-fire controllerchange on the way out; without this guard that is a
    // refresh loop, which is a far worse bug than the staleness it was fixing.
    let reloading = false;

    const safeToReload = (): boolean =>
      // Her sets are autosaved now, but a reload still drops the rest timer, the video position and
      // the set she is halfway through typing. Nothing about a deploy is worth that.
      !window.location.pathname.startsWith('/workout/');

    const maybeReload = (): void => {
      if (!pending || reloading) return;
      if (document.visibilityState === 'visible' && !safeToReload()) return;
      reloading = true;
      window.location.reload();
    };

    const onControllerChange = (): void => {
      if (!hadController) {
        hadController = true;
        return;
      }
      pending = true;
      maybeReload();
    };

    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') {
        // Hidden is the cheapest possible moment to take an update.
        maybeReload();
        return;
      }
      maybeReload();
      // And ask whether there IS one, since she has just come back.
      void navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);

    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
      console.warn('sw register:', e instanceof Error ? e.message : e);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
