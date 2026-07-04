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

  let res = NextResponse.next({ request: req });

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
          res = NextResponse.next({ request: req });
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

  return res;
}

export const config = {
  matcher: ['/((?!_next|assets|api|.*\\..*).*)'],
};
