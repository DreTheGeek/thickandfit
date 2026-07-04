# WP12 finish: Sentry + PostHog + Security Headers + global-error

**Researched:** 2026-06-28
**Branch:** phase-2
**Domain:** Observability / reliability wiring for Next.js 16 (App Router, Turbopack, pnpm)
**Confidence:** HIGH (Next 16 conventions read from local `node_modules/next/dist/docs`; Sentry/PostHog verified against current vendor docs)

## Summary

WP12 needs four things wired with graceful no-key degradation: (1) Sentry server + client capture, (2) PostHog client analytics, (3) verification of security headers on every response, and (4) a bilingual `global-error.tsx`. The codebase already has a working English-only `global-error.tsx`, a working `error.tsx` (plus nested `(app)` and `(app)/coach` boundaries), a full security-header block in `next.config.ts`, and `system-health.ts` already probes for the exact env var names this WP introduces. So WP12 is mostly additive: new instrumentation files, two new client integrations, a CSP widening for the third-party origins, and a copy/i18n pass on `global-error.tsx`.

The Next 16 way to wire monitoring is the file-convention triplet: `instrumentation.ts` (server `register()` + `onRequestError`), `instrumentation-client.ts` (client init + `onRouterTransitionStart`), and `global-error.tsx` (root error boundary). This is exactly what both `@sentry/nextjs` (>= 8.28, current major 9.x) and PostHog now target. Neither `@sentry/nextjs` nor `posthog-js` is installed yet (`node_modules/@sentry`, `node_modules/posthog-js` both absent), so a `pnpm add` step is required. The Sentry SDK supports Next 16 + Turbopack with no extra config; it auto-detects the bundler.

**Primary recommendation:** Add `@sentry/nextjs` + `posthog-js`, create `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`; wrap `next.config.ts` in `withSentryConfig`; widen the existing CSP `script-src`/`connect-src`/`worker-src` for Sentry + PostHog; and make `global-error.tsx` bilingual. Every integration must early-return when its DSN/key env var is absent (mirrors the existing `resend.ts` / `stripe.ts` lazy pattern) so builds and runtime never crash without keys.

## User Constraints

No `*-CONTEXT.md` exists for this phase (checked `phase_dir`); there are no locked decisions or deferred-idea constraints to honor beyond the standing project rules in `CLAUDE.md` / `AGENTS.md`:

- **No em dashes** anywhere in code or copy (global rule). Use periods/commas/colons.
- **Lazy-proxy / no-build-time-crash** for any external client (per `CLAUDE.md` "Lazy Proxy pattern for Stripe/Resend/OpenRouter clients"). Monitoring must follow the same env-guarded early-return shape.
- **Security headers on every response** is a `CLAUDE.md` mandate (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`).
- **This Next.js has breaking changes vs training data** (`AGENTS.md`): instrumentation/error conventions below were read from the installed `node_modules/next/dist/docs`, not assumed.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WP12-1 | Sentry server + client error capture for Next 16 | `instrumentation.ts` (`register` + `onRequestError = Sentry.captureRequestError`), `instrumentation-client.ts` (`Sentry.init` + `onRouterTransitionStart = Sentry.captureRouterTransitionStart`), `sentry.server.config.ts`, `sentry.edge.config.ts`, `withSentryConfig` wrap. All Next-16 conventions confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` + Sentry manual-setup docs. |
| WP12-2 | PostHog client product analytics | `instrumentation-client.ts` `posthog.init(...)` + a small `PostHogPageview` client component (App Router has no automatic pageviews). Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. |
| WP12-3 | Verify security headers on every response | `next.config.ts` `headers()` already sets all five + HSTS on `/:path*`. Gap: CSP must be widened for Sentry/PostHog origins (or a `tunnelRoute`/reverse-proxy used). |
| WP12-4 | Bilingual `global-error.tsx` | Existing file hardcodes `lang="en"` and English copy. next-intl server APIs are unavailable inside a global error boundary (it replaces the root layout / `NextIntlClientProvider`); plan a self-contained bilingual approach (read `ui_locale` cookie or inline both strings). |

## Current State (what already exists, cited)

| Concern | Status | File |
|---------|--------|------|
| `global-error.tsx` | Exists, English-only, hardcoded `lang="en"`, uses `reset()` (not `unstable_retry`) | `src/app/global-error.tsx` |
| Root `error.tsx` | Exists (marketing/auth/legal scope) | `src/app/error.tsx` |
| Nested error boundaries | Exist | `src/app/(app)/error.tsx`, `src/app/(app)/coach/error.tsx` |
| Root 404 | Exists, bilingual via next-intl | `src/app/not-found.tsx` (uses `getTranslations('notFound')`) |
| Security headers | All 5 + HSTS present on `/:path*` | `src/next.config.ts` lines 22-34 |
| CSP | Present; `script-src`/`connect-src` allow self + Mux + Supabase + R2 only | `next.config.ts` lines 10-20 |
| Env-name probes | `system-health.ts` already checks `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY` | `src/lib/coach/system-health.ts` lines 185-197 |
| "Planned" copy | EN/ES strings reference "Sentry/PostHog connects in Phase 3" | `src/messages/en.json` + `es.json` key `monitoringSoon` (line 397) |
| `@sentry/nextjs` installed? | **No** (`node_modules/@sentry` absent) | n/a |
| `posthog-js` installed? | **No** (`node_modules/posthog-js` absent) | n/a |
| Lazy external-client precedent | `resend.ts` (`if (!apiKey) return false`), `stripe.ts` (`isStripeConfigured()` + `{ ok:false, status:503 }`) | `src/lib/email/resend.ts`, `src/lib/billing/stripe.ts` |
| Layout / providers | `RootLayout` wraps `NextIntlClientProvider` > `Providers` (next-themes) | `src/app/layout.tsx`, `src/components/providers.tsx` |
| Proxy (Next 16 middleware) | `src/proxy.ts` refreshes Supabase session + sets `ui_locale` cookie; matcher excludes `api`/`_next`/assets | `src/proxy.ts` |

Note the project keeps instrumentation in `src/` (it uses a `src` folder, so the Next 16 docs say instrumentation files live "inside a `src` folder"). All new instrumentation files go in `src/`, not repo root.

## Standard Stack

### Core
| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `@sentry/nextjs` | `^9` (>= 8.28 required for `onRequestError`; 9.x is current) | Server + client + edge error capture, tracing, source maps | Official Sentry Next.js SDK; the only one that ships the `captureRequestError` / `captureRouterTransitionStart` helpers wired to Next 16 file conventions. Supports Next 16 + Turbopack with auto bundler detection. |
| `posthog-js` | `^1` (latest) | Client product analytics, autocapture, pageviews | Official PostHog browser SDK; PostHog's own Next.js guide initializes it in `instrumentation-client.ts`. |

### Supporting / optional
| Library | When to use |
|---------|-------------|
| `posthog-node` | Only if we later want server-side event capture (feature flags, server events). Not required for WP12 client analytics; skip for now to keep scope tight. |

### Alternatives considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `@sentry/nextjs` | Raw `onRequestError` fetch to a custom endpoint (per the Next docs example) | Loses tracing, source maps, breadcrumbs, release health. Not worth it; the SDK degrades fine without a DSN. |
| PostHog reverse proxy via `next.config` rewrites | Direct `api_host` to `us.i.posthog.com` + CSP allowlist | Reverse proxy dodges ad blockers but adds rewrite rules and complicates CSP. For a first cut, direct host + CSP allowlist is simpler; proxy can come later. |

**Installation:**
```bash
pnpm add @sentry/nextjs posthog-js
```

## Architecture / File Plan (Next 16 conventions, all paths under src/)

```
src/
  instrumentation.ts          # NEW: server register() + onRequestError (Sentry)
  instrumentation-client.ts   # NEW: client Sentry.init + posthog.init + onRouterTransitionStart
  sentry.server.config.ts     # NEW: Sentry.init for Node runtime
  sentry.edge.config.ts       # NEW: Sentry.init for Edge runtime (proxy.ts runs at edge)
  app/
    global-error.tsx          # EDIT: bilingual + Sentry.captureException in useEffect
  lib/
    analytics/posthog.ts      # OPTIONAL helper: typed capture() wrapper, no-op if unconfigured
    monitoring/posthog-pageview.tsx  # NEW client comp: capture $pageview on route change
next.config.ts                # EDIT: wrap export in withSentryConfig; widen CSP
```

### Pattern 1: server instrumentation (`src/instrumentation.ts`)
**What:** Next 16 calls `register()` once per server boot and `onRequestError` on every server-side error. The docs confirm `onRequestError` signature (`error`, `request`, `context`) in `instrumentation.md`. Sentry provides drop-in helpers.

```ts
// src/instrumentation.ts
// Source: node_modules/next/dist/docs/.../file-conventions/instrumentation.md
//         + https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return; // graceful no-DSN
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures Server Component / Route Handler / Server Action errors. Safe no-op without a DSN.
export const onRequestError = Sentry.captureRequestError;
```

### Pattern 2: client instrumentation (`src/instrumentation-client.ts`)
**What:** Next 16 runs this file after HTML load, before hydration. It is the blessed place for both Sentry client init and PostHog init. The `onRouterTransitionStart` export is required by Sentry to instrument navigations (otherwise the SDK logs a warning).

```ts
// src/instrumentation-client.ts
// Source: node_modules/next/dist/docs/.../file-conventions/instrumentation-client.md
//         + Sentry + PostHog Next.js guides
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.1,
    // Session replay is optional; gate it on a flag to control cost.
  });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // App Router has no auto pageviews; we capture manually
    person_profiles: 'identified_only',
  });
}

// Required by Sentry to trace client navigations. No-op without a DSN.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

### Pattern 3: sentry config files
```ts
// src/sentry.server.config.ts (and a near-identical src/sentry.edge.config.ts)
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}
```
The `if (dsn)` guard makes the whole thing inert without keys, matching `resend.ts`'s `if (!apiKey) return false`.

### Pattern 4: bilingual `global-error.tsx`
**What:** `global-error.tsx` replaces the root layout AND the `NextIntlClientProvider`, so `useTranslations`/`getTranslations` are **not available** there. The existing file hardcodes `lang="en"`. Two viable approaches:

- **A (recommended, self-contained):** Read the `ui_locale` cookie client-side (`document.cookie`) inside the component, pick from a small inline `{ en, es }` copy map, set `<html lang>` accordingly. Zero next-intl dependency, no provider needed. The proxy already guarantees a `ui_locale` cookie exists (`src/proxy.ts` lines 34-41).
- **B:** Keep it English-only but well-branded (lower effort). Not preferred since the task explicitly says bilingual.

Also add Sentry capture in `useEffect` (the file is already `'use client'`):
```tsx
// src/app/global-error.tsx (edit)
'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

const COPY = {
  en: { title: 'Something went wrong', body: 'Please reload the page.', cta: 'Reload' },
  es: { title: 'Algo salió mal', body: 'Por favor recarga la página.', cta: 'Recargar' },
} as const;

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }; reset: () => void;
}) {
  useEffect(() => { Sentry.captureException(error); }, [error]); // no-op without DSN
  const locale = typeof document !== 'undefined'
    && /(?:^|;\s*)ui_locale=es/.test(document.cookie) ? 'es' : 'en';
  const t = COPY[locale];
  return (
    <html lang={locale}>
      <body>{/* existing on-brand markup, swap strings for t.title/t.body/t.cta */}</body>
    </html>
  );
}
```
Note: keep `reset` (current prop) for now. Next 16.2 added `unstable_retry` as an additional prop (see `error.md` version history `v16.2.0`); `reset` still works and is stable, so no need to migrate in this WP.

### Pattern 5: `withSentryConfig` wrap in `next.config.ts`
**What:** Sentry wraps the exported config to enable source-map upload + tunneling. Compose it OUTSIDE the existing `withNextIntl(...)` call. The existing `export default withNextIntl(nextConfig)` (line 44) becomes:
```ts
import { withSentryConfig } from '@sentry/nextjs';
// ...
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  // org / project / authToken read from SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN env at build time.
  // Without an auth token, source-map upload is skipped; the build still succeeds (graceful degrade).
});
```
`withSentryConfig` is safe to call without `SENTRY_AUTH_TOKEN`; it just skips the upload step.

### Pattern 6: PostHog pageview capture (App Router)
App Router has no automatic pageview. Add a tiny client component mounted in `RootLayout` (inside `Providers`) that fires `posthog.capture('$pageview')` on `usePathname()` / `useSearchParams()` change. Guard on `posthog.__loaded` so it is inert without a key.

### Anti-patterns to avoid
- **Do not** put Sentry/PostHog `init` in `layout.tsx` or a server component. Client init belongs in `instrumentation-client.ts`; server init in the `sentry.*.config.ts` files imported by `register()`.
- **Do not** import `@sentry/nextjs` server APIs into a client component or vice-versa. The SDK exposes isomorphic helpers but the `init` configs are runtime-specific.
- **Do not** add the third-party origins to CSP and forget `worker-src`/`connect-src` for Sentry session replay or tunneling. Test the browser console for CSP violations.
- **Do not** rely on next-intl inside `global-error.tsx` (provider is gone at that boundary).

## Security Headers: gap analysis

`next.config.ts` already sets, on `source: '/:path*'` (every response):

| Header | Present? | Value |
|--------|----------|-------|
| `X-Frame-Options` | yes | `DENY` |
| `X-Content-Type-Options` | yes | `nosniff` |
| `Referrer-Policy` | yes | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | yes | `camera=(self), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | yes (bonus) | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | yes | self + Mux + Supabase(+wss) + R2 |

**All five mandated headers are already present.** The only WP12 change required is widening the **CSP** so Sentry + PostHog are not blocked:

- `script-src`: add `https://*.posthog.com` (PostHog loads `array.js` / autocapture from `us-assets.i.posthog.com`). Sentry's browser SDK is bundled (no external script) so it needs no `script-src` change.
- `connect-src`: add `https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io` (Sentry event ingestion + PostHog event capture). If a Sentry `tunnelRoute` is configured, ingestion is same-origin and Sentry needs no `connect-src` change (preferred for ad-blocker avoidance). Decide tunnel vs. allowlist at plan time.
- `worker-src` / `child-src`: PostHog session recording may spawn a worker; add `'self' blob:` to `worker-src` if session replay is enabled (skip if not).
- `img-src` already permits `https:`, so Sentry/PostHog beacons via image are fine.

Because the CSP currently uses `'unsafe-inline'` in `script-src` (not nonces), there is no nonce plumbing to thread through Sentry/PostHog. Keep it that way for this WP; the CSP guide (`content-security-policy.md`) notes nonces force full dynamic rendering, which would regress this mostly-static marketing surface.

**Verify on every response** (the task's word "verify"): all headers are config-driven on `/:path*`, so they apply to pages and route handlers alike. Confirm at runtime with `curl -sI https://<deploy>/ | grep -iE 'content-security|x-frame|x-content|referrer|permissions|strict-transport'` and ensure no header is missing after the CSP edit.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Server error capture | Custom `onRequestError` POST to a homemade endpoint | `Sentry.captureRequestError` | Sentry handles digest matching, source maps, edge vs node runtime, batching. |
| Client error + navigation tracing | `window.onerror` + manual fetch | `Sentry.init` + `captureRouterTransitionStart` | SDK wires React error boundaries, breadcrumbs, replay. |
| Pageview/analytics pipeline | Custom event table + API | `posthog-js` | Autocapture, funnels, retention, session replay out of the box. |
| Webhook/source-map upload | Manual sourcemap tooling | `withSentryConfig` | Build-time upload + release tagging, skips gracefully without auth token. |

## Common Pitfalls

### Pitfall 1: `global-error.tsx` cannot use next-intl
**What goes wrong:** Importing `useTranslations`/`getTranslations` throws because the `NextIntlClientProvider` (mounted in `layout.tsx`) is gone when the global boundary renders.
**Avoid:** Self-contained inline `{ en, es }` copy keyed off the `ui_locale` cookie (Pattern 4). The proxy guarantees the cookie exists.

### Pitfall 2: build crash / SSR crash without env vars
**What goes wrong:** Calling `Sentry.init({ dsn: undefined })` or `posthog.init(undefined)` can warn or behave oddly; an unguarded `withSentryConfig` upload step can fail CI.
**Avoid:** Guard every `init` with `if (dsn)` / `if (key)` (Patterns 1-3), and set `withSentryConfig` to skip upload without `SENTRY_AUTH_TOKEN`. Mirrors `resend.ts` `if (!apiKey) return false`.

### Pitfall 3: CSP silently blocks the new beacons
**What goes wrong:** Sentry/PostHog requests fail with a console CSP error and no events arrive, but the app looks fine.
**Avoid:** Widen `connect-src` (and `script-src` for PostHog assets) before testing; check the browser console + the Network tab for blocked requests. Prefer a Sentry `tunnelRoute` to keep ingestion same-origin.

### Pitfall 4: instrumentation files in the wrong directory
**What goes wrong:** Placing `instrumentation.ts` at repo root when the project uses a `src` folder means Next never loads it.
**Avoid:** This project uses `src/` (confirmed: `src/app`, `src/proxy.ts`), so all instrumentation files go in `src/`. The Next docs explicitly say instrumentation lives "inside a `src` folder if using one."

### Pitfall 5: edge runtime missed
**What goes wrong:** `src/proxy.ts` runs on the edge runtime; without `sentry.edge.config.ts` + the `NEXT_RUNTIME === 'edge'` branch in `register()`, proxy errors are not captured.
**Avoid:** Include both the node and edge config files and branch on `process.env.NEXT_RUNTIME` (Pattern 1), exactly as the Next instrumentation doc shows.

## Env vars needed

| Var | Scope | Purpose | Degrade-without |
|-----|-------|---------|-----------------|
| `NEXT_PUBLIC_SENTRY_DSN` | client | Browser Sentry init | client capture off |
| `SENTRY_DSN` | server | Server/edge Sentry init (can reuse the public DSN value) | server capture off |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | build only | Source-map upload via `withSentryConfig` | upload skipped, build still passes |
| `NEXT_PUBLIC_POSTHOG_KEY` | client | PostHog project token | analytics off |
| `NEXT_PUBLIC_POSTHOG_HOST` | client | PostHog ingest host (default `https://us.i.posthog.com`) | falls back to default |

`system-health.ts` already reads `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`/`NEXT_PUBLIC_POSTHOG_KEY`, so once these are set the Coach "System Health" panel will flip those rows from "planned" to "configured" with no extra code. Consider also flipping `system-map.ts` line 75 and the `monitoringSoon` copy (en/es line 397) from "Phase 3 / planned" once wired (optional follow-up, not required to function).

## State of the Art

| Old approach | Current (Next 16) | Notes |
|--------------|-------------------|-------|
| `sentry.client.config.ts` | `instrumentation-client.ts` | Sentry moved client init into the Next file convention (Next 15.3+). |
| `_error.js` / `pages/_error` | `error.tsx` + `global-error.tsx` | App Router boundaries; already in place here. |
| `middleware.ts` | `proxy.ts` | This Next renames middleware to proxy (already adopted: `src/proxy.ts`). |
| Webpack-only Sentry plugin | Turbopack auto-detected | Next 16 defaults to Turbopack; SDK supports it with no extra config. |
| `reset` only on error boundaries | `unstable_retry` added (v16.2.0) | `reset` still valid; no migration needed this WP. |

## Open Questions

1. **Sentry tunnelRoute vs CSP allowlist for ingestion.**
   - Known: tunnel keeps ingestion same-origin (beats ad blockers) but adds a route + must be excluded from auth/proxy matchers.
   - Recommendation: start with CSP `connect-src` allowlist (simpler); add `tunnelRoute` later if ad-blocker loss is measurable.

2. **PostHog session replay on/off.**
   - Known: replay needs `worker-src 'self' blob:` and increases payload/cost.
   - Recommendation: ship pageviews + autocapture first; gate replay behind a later decision.

3. **Single DSN reuse for server + client.**
   - Known: Sentry DSNs are not secret; the same value can fill both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
   - Recommendation: set both to the same project DSN to avoid drift.

4. **`reset` -> `unstable_retry` migration.** Deferred; out of WP12 scope (cosmetic; current `reset` works).

## Validation / Verification Plan

In-browser via deploy preview (no real keys required to prove graceful degradation):

1. **Build with no monitoring env vars** -> `pnpm build` succeeds (proves no build-time crash). This is the core "graceful degradation" gate.
2. **Headers present on every response:** `curl -sI <deploy>/` and `curl -sI <deploy>/api/v1/ping` -> both show all five security headers + HSTS, and the CSP includes the widened Sentry/PostHog origins. (`/api/v1/ping` returns `{ ok, data }` 200 per `src/app/api/v1/ping/route.ts`.)
3. **No CSP violations:** load `/` and `/join` with DSN+key set, open DevTools console -> no `Refused to connect`/`Refused to load` CSP errors; Network tab shows PostHog `/e/` and Sentry `/envelope` requests succeeding.
4. **Server capture:** with `SENTRY_DSN` set, trigger a thrown error in a route handler/Server Component -> event appears in Sentry, `error.digest` matches server logs.
5. **Client capture + navigation:** with `NEXT_PUBLIC_SENTRY_DSN` set, throw in a client component -> `global-error.tsx` (or nested `error.tsx`) renders AND Sentry receives the exception; navigate between pages -> no missing-`onRouterTransitionStart` warning.
6. **Bilingual global error:** set `ui_locale=es` cookie, force a root-layout error -> `global-error.tsx` shows Spanish copy and `<html lang="es">`; clear cookie -> English. (Use React DevTools to toggle the boundary, per `error.md` "good to know".)
7. **PostHog pageviews:** with key set, navigate the app -> PostHog "Activity" shows `$pageview` events on route change.
8. **System Health panel:** once env vars are set, the Coach System Health rows for "Error monitoring (Sentry)" and "Product analytics (PostHog)" flip to "configured" (driven by `system-health.ts` lines 185-197) with no code change.

## Sources

### Primary (HIGH)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` - `register` + `onRequestError` signature, runtime branching, version history.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md` - client init timing, `onRouterTransitionStart` export.
- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` + `.../file-conventions/error.md` - `error.tsx` / `global-error.tsx` rules, `unstable_retry` (v16.2.0), global error has no provider.
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` - CSP-without-nonces (config `headers()`), third-party allowlist, nonce-forces-dynamic warning.
- Codebase: `src/next.config.ts`, `src/app/global-error.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/layout.tsx`, `src/components/providers.tsx`, `src/proxy.ts`, `src/i18n/request.ts`, `src/lib/email/resend.ts`, `src/lib/billing/stripe.ts`, `src/lib/coach/system-health.ts`, `src/app/api/v1/ping/route.ts`, `package.json`.

### Secondary (MEDIUM, verified against vendor docs)
- Sentry Next.js manual setup - https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ (file set, `captureRequestError`, `captureRouterTransitionStart`, `withSentryConfig`).
- Sentry Next.js overview - https://docs.sentry.io/platforms/javascript/guides/nextjs/ (required files, global-error capture).
- Sentry blog "Turbopack support for the Next.js SDK" - https://blog.sentry.io/turbopack-support-next-js-sdk/ (Next 16 / Turbopack auto-detection, 15.4.1+).
- PostHog Next.js guide - https://posthog.com/docs/libraries/next-js (instrumentation-client init, env vars, manual pageviews, reverse-proxy option).

## Metadata
**Confidence breakdown:**
- Next 16 conventions: HIGH (read from installed docs).
- Sentry/PostHog file layout + helper names: HIGH (vendor docs + multiple sources agree).
- Exact CSP origin strings for Sentry/PostHog: MEDIUM (origins are correct families; confirm exact ingest subdomains against the live DSN/region at plan time).
- Sentry SDK major (9.x): MEDIUM (>= 8.28 is the hard floor for `onRequestError`; pin to latest 9 at install).

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (Sentry/PostHog SDKs move fast; re-check before pinning versions).
