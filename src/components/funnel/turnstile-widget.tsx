'use client';
// Cloudflare Turnstile client widget for the waitlist signup form. Renders NOTHING when the
// public site key is unset, so pre-launch (no key yet) doesn't show a broken checkbox. When set,
// loads the Turnstile script once, mounts the widget, and calls onToken(token) whenever the
// challenge succeeds (or onToken(null) on expiry/error) so the parent can gate submit-enable on it.
//
// Same-origin, low-noise: the "flexible" theme + "auto" size passes through the site's own light/
// dark background. Locale mirrors the form's language so the challenge copy reads native.
import { useEffect, useId, useRef, type ReactElement } from 'react';

type TurnstileGlobal = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible' | 'compact' | 'invisible';
      language?: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      'timeout-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile script failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('turnstile script failed')));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  locale,
  onToken,
}: {
  siteKey: string;
  locale: 'en' | 'es';
  onToken: (token: string | null) => void;
}): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const domId = useId();

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          size: 'flexible',
          language: locale,
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(null),
          'expired-callback': () => onToken(null),
          'timeout-callback': () => onToken(null),
        });
      })
      .catch(() => {
        // Cloudflare unreachable — token stays null; server-side verify will 400 on submit rather
        // than opening the door. The user sees the standard rate-limit / verification error state.
        onToken(null);
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // idempotent unmount
        }
      }
    };
    // siteKey + locale change should tear down + remount; onToken is stable in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, locale]);

  return <div ref={hostRef} id={domId} className="mt-4" />;
}
