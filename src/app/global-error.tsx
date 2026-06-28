'use client';
// Last-resort boundary: catches errors thrown in the ROOT layout itself (where the normal error.tsx
// can't render). Must supply its own <html>/<body>. Guarantees the app never serves a blank document.
//
// next-intl is unavailable here: this boundary replaces the root layout AND its NextIntlClientProvider,
// so useTranslations would throw. Instead we read the ui_locale cookie (the proxy always sets it,
// see src/proxy.ts) and pick from a self-contained EN/ES copy map. No em dashes anywhere.
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import * as Sentry from '@sentry/nextjs';

const COPY = {
  en: {
    title: 'Something went wrong',
    body: 'Please reload the page.',
    cta: 'Reload',
  },
  es: {
    title: 'Algo salió mal',
    body: 'Por favor recarga la página.',
    cta: 'Recargar',
  },
} as const;

function readLocale(): 'en' | 'es' {
  if (typeof document === 'undefined') return 'en';
  return /(?:^|;\s*)ui_locale=es/.test(document.cookie) ? 'es' : 'en';
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  // Report the failure. No-op without a Sentry DSN (init never ran).
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const locale = readLocale();
  const t = COPY[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#000',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t.title}</h1>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>{t.body}</p>
          <button
            onClick={() => reset()}
            style={{
              background: '#5EBE62',
              color: '#000',
              border: 0,
              padding: '0.65rem 1.6rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.cta}
          </button>
        </div>
      </body>
    </html>
  );
}
