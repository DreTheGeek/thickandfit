// Next 16 server instrumentation. register() runs once per server boot; onRequestError fires on
// every server-side error (Server Components, Route Handlers, Server Actions, the edge proxy).
// Graceful degradation: with no Sentry DSN this is fully inert (early return + no-op capture), so
// the build and runtime never depend on a key. Mirrors the lazy-proxy contract in resend.ts/stripe.ts.
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return; // no DSN: do nothing
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures server-side errors. Safe no-op without a DSN (Sentry init never ran).
export const onRequestError = Sentry.captureRequestError;
