// On first visit (no ui_locale cookie), default the interface language from the visitor's country.
// LATAM/ES -> Spanish, else English. User-overridable via the LanguageToggle.
import { NextResponse, type NextRequest } from 'next/server';
import { localeForCountry } from '@/lib/i18n/geo';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
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
