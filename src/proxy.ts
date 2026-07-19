// Two jobs per request:
// 1. Refresh the Supabase session so rotated auth cookies are persisted (Server Components
//    cannot write cookies, so this proxy must; without it sessions break after the
//    first token rotation and users get bounced back to sign-in).
// 2. On first visit (no ui_locale cookie), default the interface language from the
//    visitor's country: LATAM/ES -> Spanish, else English. User-overridable later.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { localeForCountry } from '@/lib/i18n/geo';

// On the admin.<domain> host, only the admin portal + auth are reachable; everything else (all of
// /coach and the member app) redirects to /admin, so the ops surface is fully isolated.
const ADMIN_ALLOW = [/^\/admin(\/|$)/, /^\/auth\//];

// Per-request CSP with a script nonce (Next.js reads it from the request CSP header during SSR and
// stamps it onto every framework + app inline script). script-src is now nonce + strict-dynamic
// instead of 'unsafe-inline', which is the XSS-relevant hardening. style-src keeps 'unsafe-inline':
// the app renders React inline styles (Framer Motion, dynamic sizing) that a strict style policy
// would break, and injected styles are a far weaker XSS vector than scripts.
function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://*.mux.com https://*.posthog.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    // data: for the landing page's base64-embedded webfonts (lifted Webflow CSS).
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.dev https://*.mux.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io",
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

  // Fresh nonce per request, exposed to the render via x-nonce and enforced via the CSP header.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production');
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);
  reqHeaders.set('Content-Security-Policy', csp);

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

  if (!req.cookies.get('ui_locale')) {
    const country = req.headers.get('x-vercel-ip-country');
    res.cookies.set('ui_locale', localeForCountry(country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // The response carries the same CSP the render was nonced against.
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|.*\\..*).*)'],
};
