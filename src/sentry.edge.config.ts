// Sentry init for the Edge runtime. src/proxy.ts runs at the edge, so without this file edge errors
// would be missed. Imported by instrumentation.ts register() only when a DSN is present, so it is
// inert without keys.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
