// Next 16 client instrumentation. Runs after the HTML loads, before React hydration. The blessed
// place for browser Sentry init and PostHog init. Each init is guarded on its env var so the bundle
// runs cleanly with NO Sentry DSN and NO PostHog key (graceful degradation, like resend.ts/stripe.ts).
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.1,
    // Session replay OFF for v1 (cost + CSP worker-src). Enable later behind a flag.
  });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // App Router has no auto pageview; PostHogPageview captures manually.
    person_profiles: 'identified_only',
  });
}

// Sentry traces client navigations through this hook. Omitting it triggers an SDK console warning.
// No-op without a DSN (init never ran).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
