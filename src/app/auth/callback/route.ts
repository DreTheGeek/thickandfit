// OAuth / magic link / email verification / password recovery callback.
//
// Handles TWO flow shapes so a browser-hop between the form submit and the email click doesn't
// break recovery:
//   1) OTP hash:   ?token_hash=...&type=recovery → verifyOtp (server-side, no browser-cookie dependency)
//   2) PKCE:       ?code=pkce_<token>            → exchangeCodeForSession (needs code_verifier cookie in THIS browser)
//
// Password recovery emails emit the OTP shape (see the Supabase auth email templates) so a click
// from ANY browser lands + exchanges + redirects to /auth/reset-password. PKCE stays supported
// for OAuth callbacks where the flow starts + finishes in the same browser.
//
// Diagnosis 2026-07-24: 100% of recent /auth/callback invocations returned 307 → sign-in?error=auth.
// exchangeCodeForSession was failing every time because the PKCE code_verifier cookie was not in
// the browser opening the email link (typical cross-browser mail-open scenario). Switching to
// verifyOtp for recovery is the durable fix; the browser-cookie dependency goes away.
//
// Failure lands on /auth/sign-in?error=auth without leaking details (log-only server-side).
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { homePathForUser, type Role } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// Only allow same-origin relative paths (e.g. "/dashboard"). Rejects "//evil.com",
// "https://evil.com", and any non-root-relative value to block open redirects.
function safeNext(next: string | null): string | null {
  if (!next) return null;
  return /^\/(?!\/)/.test(next) ? next : null;
}

type OtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

async function resolveDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string,
  next: string | null,
): Promise<string> {
  if (next) return `${origin}${next}`;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return `${origin}/dashboard`;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const dest = await homePathForUser(user.id, (profile?.role as Role) ?? 'subscriber');
  return `${origin}${dest}`;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as OtpType | null;
  const next = safeNext(searchParams.get('next'));

  // Path 1 — OTP / token_hash (password recovery, email confirmation, magic link, invite).
  // Server-side verify; does NOT need a browser-cookie code_verifier. This is the path that
  // works when the email is opened in a different browser than the form submission.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = await resolveDestination(supabase, origin, next);
      return NextResponse.redirect(dest);
    }
    console.error('callback verifyOtp:', error.message, 'type:', type);
  }

  // Path 2 — PKCE code (OAuth flows that start + finish in the same browser).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = await resolveDestination(supabase, origin, next);
      return NextResponse.redirect(dest);
    }
    console.error('callback exchangeCode:', error.message);
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth`);
}
