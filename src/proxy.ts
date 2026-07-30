// Two jobs per request:
// 1. Refresh the Supabase session so rotated auth cookies are persisted (Server Components
//    cannot write cookies, so this proxy must; without it sessions break after the
//    first token rotation and users get bounced back to sign-in).
// 2. On first visit (no ui_locale cookie), default the interface language from the
//    visitor's country: LATAM/ES -> Spanish, else English. User-overridable later.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { localeForCountry } from '@/lib/i18n/geo';
import { urlLocaleFor, esPathFor } from '@/lib/seo/locale-alternates';
import {
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE_S,
  PREVIEW_PARAM,
  gateRedirectPath,
  hasPreviewAccess,
  isGatedPath,
  isPrelaunchEnabled,
  presentedPreviewToken,
} from '@/lib/launch/prelaunch';

// On the admin.<domain> host, the operator can reach the admin portal, the coach console, and
// auth — so Stephanie can run her whole operator+coach day from one host without bouncing to www.
// The member app + marketing site still hard-redirect to /admin, so the host stays ops-scoped.
// Safety: /coach/* is already requireCoach()-gated at the page level — the host isn't the auth
// boundary, per-route auth is. When white-label ever lands, tighten this back to /admin only and
// mirror the ops-shaped coach surfaces (clients, subscribers, leads, billing, broadcasts,
// approvals, community moderation) as /admin/* pages with requireOperator.
const ADMIN_ALLOW = [/^\/admin(\/|$)/, /^\/coach(\/|$)/, /^\/auth\//];

// Per-request CSP with a script nonce (Next.js reads it from the request CSP header during SSR and
// stamps it onto every framework + app inline script). script-src is now nonce + strict-dynamic
// instead of 'unsafe-inline', which is the XSS-relevant hardening. style-src keeps 'unsafe-inline':
// the app renders React inline styles (Framer Motion, dynamic sizing) that a strict style policy
// would break, and injected styles are a far weaker XSS vector than scripts.
function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // Cloudflare Turnstile loads its api.js from challenges.cloudflare.com; adding the origin here
    // lets 'strict-dynamic' (which trusts nonce'd scripts to load further scripts) reach it. The
    // widget renders an iframe from the same origin — covered by frame-src below.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://*.mux.com https://*.posthog.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    // data: for the landing page's base64-embedded webfonts (lifted Webflow CSS).
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.dev https://*.mux.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://challenges.cloudflare.com",
    // Turnstile mounts its challenge UI inside a same-origin iframe on challenges.cloudflare.com.
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const host = (req.headers.get('host') || '').toLowerCase();
  if (host.startsWith('admin.')) {
    const { pathname } = req.nextUrl;
    if (!ADMIN_ALLOW.some((re) => re.test(pathname))) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // Pre-launch gate: hide the public marketing site while leaving the waitlist funnel live.
  // Runs BEFORE the session refresh below, so a hidden page never touches Supabase at all.
  // Off unless PRELAUNCH_HIDE_SITE is set, and never applies on the admin host.
  if (!host.startsWith('admin.') && isPrelaunchEnabled()) {
    const { pathname, searchParams } = req.nextUrl;
    // The team clears the gate with /?preview=<token>, which is exchanged for a cookie so the rest
    // of their browsing needs no query string.
    const presented = presentedPreviewToken(searchParams);
    if (presented) {
      const url = req.nextUrl.clone();
      url.searchParams.delete(PREVIEW_PARAM);
      const res = NextResponse.redirect(url);
      res.cookies.set(PREVIEW_COOKIE, presented, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: PREVIEW_MAX_AGE_S,
      });
      return res;
    }
    if (isGatedPath(pathname) && !hasPreviewAccess(req.cookies.get(PREVIEW_COOKIE)?.value)) {
      const url = req.nextUrl.clone();
      url.pathname = gateRedirectPath(pathname);
      url.search = '';
      // 307, not 308: this is a temporary state that ends when doors open on Sept 27, and a
      // permanent redirect would be cached by browsers and CDNs long after the site goes live.
      return NextResponse.redirect(url, 307);
    }
  }

  // Fresh nonce per request, exposed to the render via x-nonce and enforced via the CSP header.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production');
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);
  reqHeaders.set('Content-Security-Policy', csp);
  // The render needs the path to resolve the UI locale. Locale used to come only from the
  // ui_locale cookie, which no crawler sends, so every Spanish page was unreachable to search and
  // answer engines: Googlebot asking for es-MX got English. The public /es/* routes fix that by
  // giving Spanish real URLs, and i18n/request.ts reads this header to pick the locale.
  reqHeaders.set('x-pathname', req.nextUrl.pathname);

  let res = NextResponse.next({ request: { headers: reqHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: reqHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touch the session so @supabase/ssr refreshes + re-writes the auth cookies via setAll.
  await supabase.auth.getUser();

  // The URL is authoritative in BOTH directions, and that symmetry is the point. /es writes es so a
  // visitor arriving from Spanish search stays in Spanish through /join and sign-in, which have no
  // Spanish twin. The English twin writes en so the nav toggle actually works: without it, /es set a
  // one-year cookie, nothing ever cleared it, and clicking EN landed on / which still rendered
  // Spanish. One way in, no way out, and the English canonical URL served Spanish to crawlers.
  const urlLocale = urlLocaleFor(req.nextUrl.pathname);
  if (urlLocale) {
    res.cookies.set('ui_locale', urlLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  } else if (!req.cookies.get('ui_locale')) {
    const country = req.headers.get('x-vercel-ip-country');
    res.cookies.set('ui_locale', localeForCountry(country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // A LATAM visitor with no stated preference gets sent to the Spanish URL rather than being served
  // Spanish at the English one. Serving a different language at a canonical URL is the thing that
  // confuses crawlers and breaks the hreflang pair. Only fires when no preference exists, so it can
  // never override someone who picked a language.
  if (
    urlLocale === 'en' &&
    !req.cookies.get('ui_locale') &&
    localeForCountry(req.headers.get('x-vercel-ip-country')) === 'es'
  ) {
    const url = req.nextUrl.clone();
    url.pathname = esPathFor(req.nextUrl.pathname);
    return NextResponse.redirect(url, 307);
  }

  // Waitlist referral persistence: a friend clicked /join?r=<code>. Server components on GET can't
  // set cookies, so this middleware stashes the code for 60 days. The server render reads it back
  // to prefill the form + resolve the friend's name; a returning visitor without ?r= still credits.
  // Scoped to /join* and safe on every other route.
  if (req.nextUrl.pathname.startsWith('/join')) {
    const rParam = req.nextUrl.searchParams.get('r');
    if (rParam) {
      res.cookies.set('funnel_ref_incoming', rParam.trim().toLowerCase(), {
        path: '/',
        maxAge: 60 * 60 * 24 * 60,
        sameSite: 'lax',
      });
    }
  }

  // The response carries the same CSP the render was nonced against.
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|.*\\..*).*)'],
};
