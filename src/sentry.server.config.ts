// Sentry init for the Node.js server runtime. Imported by instrumentation.ts register() only when a
// DSN is present, so this whole file is inert without keys (no init runs, no events sent).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Session replay stays OFF for v1 (cost + extra CSP worker-src). Add later behind a flag.
  });
}
