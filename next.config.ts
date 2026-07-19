import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Static security headers on every response (CLAUDE.md mandate). The Content-Security-Policy is NOT
// here: it now carries a per-request script nonce and is set in proxy.ts (script-src is nonce +
// strict-dynamic instead of 'unsafe-inline'). Everything else is request-independent and lives here.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.lenus.io' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
    ],
  },
};

// Wrap OUTSIDE withNextIntl so Sentry sees the fully-composed config. withSentryConfig enables
// source-map upload + release tagging at build time. Without SENTRY_AUTH_TOKEN the upload step is
// silently skipped and the build still succeeds (graceful degradation). silent suppresses Sentry's
// build logs outside CI.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  // org / project / authToken are read from SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN at build
  // time. When the auth token is absent, source-map upload is skipped (no build failure).
});
