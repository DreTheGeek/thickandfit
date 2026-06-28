import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Security headers on every response (CLAUDE.md mandate). The CSP declares an explicit
// script/style/img/connect policy. unsafe-inline is required for Next's inline runtime + Mux player;
// Mux is allowlisted for scripts and connections, Supabase (incl. wss for Realtime) + R2 for data/media.
// PostHog assets load from *.posthog.com (script + connect); Sentry events ingest over *.sentry.io
// + *.ingest.sentry.io (connect). Both degrade to no-ops without keys, so the origins are harmless
// when unconfigured. Session replay is OFF for v1, so no worker-src/blob: is needed.
const isDev = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  // Dev only: React/Turbopack need 'unsafe-eval' for dev-mode RSC features. Production never uses eval.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.mux.com https://*.posthog.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.dev https://*.mux.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
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
