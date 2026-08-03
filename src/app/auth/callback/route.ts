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
import { createServiceClient } from '@/lib/supabase/service';
import { homePathForUser, type Role } from '@/lib/auth/session';
import { isSignupEnabled } from '@/lib/admin/settings';
import { resolveTenantId } from '@/lib/tenant';
import { ensureCrmContactFromProfile } from '@/lib/crm/ensure-contact';

export const dynamic = 'force-dynamic';

/** A Google sign-in that just minted a brand-new account counts as a signup, not a sign-in. */
const NEW_ACCOUNT_WINDOW_MS = 120_000;

/**
 * Enforce the operator signup switch on the OAuth path.
 *
 * Without this the switch is decorative: blocking the email form while "Continue with Google" still
 * creates accounts is not a closed door. Google hands us a session for an account Supabase has
 * ALREADY created by the time this route runs, so the only honest options are to reject and remove
 * it, or to let it stand.
 *
 * It is removed. The row is seconds old, carries nothing but what the profile trigger just copied,
 * and leaving it would quietly re-open the gate: the account would exist, so the next Google click
 * reads as a returning sign-in and sails through.
 *
 * The age window is a heuristic, and deliberately a narrow one. This is a business gate, not a
 * security boundary: the cost of missing a signup by a few seconds is that one account gets in, and
 * the cost of a false positive is bounded to accounts created inside the last two minutes while the
 * operator had signups switched off.
 */
async function rejectClosedSignup(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.created_at) return false;
  const age = Date.now() - new Date(user.created_at).getTime();
  if (!Number.isFinite(age) || age > NEW_ACCOUNT_WINDOW_MS) return false;

  const companyId = await resolveTenantId().catch(() => null);
  if (await isSignupEnabled(companyId)) return false;

  console.warn('callback: new account rejected, signups are closed:', user.id);
  await supabase.auth.signOut();
  try {
    await createServiceClient().auth.admin.deleteUser(user.id);
  } catch (e) {
    // Signing them out already blocked entry; a leftover row is recoverable by hand, so this must
    // not turn into a 500 on a path whose whole job is to land the person somewhere sensible.
    console.error('callback: could not remove rejected account:', e instanceof Error ? e.message : e);
  }
  return true;
}

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bridge the member into the Clients CRM here, not only at onboarding.
  //
  // /coach/clients reads `contacts`, and the only writers were signUpAction (email signup only),
  // onboarding submit, and the health profile. So a member who signed up with Google and stopped
  // before finishing onboarding existed in `profiles` and appeared NOWHERE in the coach's view. That
  // is exactly the person worth chasing, and she was the one who could not be seen.
  //
  // Idempotent and role-filtered (staff go to /admin/team, never the clients list), so running it on
  // every callback, including ordinary returning sign-ins, is safe and self-healing.
  if (user) await ensureCrmContactFromProfile(user.id);

  if (next) return `${origin}${next}`;
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
      // Magic link can mint an account too, so the switch is checked here as well. A `signup` type
      // confirming an account signUpAction already created is older than the window and unaffected.
      if (await rejectClosedSignup(supabase)) {
        return NextResponse.redirect(`${origin}/auth/sign-up`);
      }
      const dest = await resolveDestination(supabase, origin, next);
      return NextResponse.redirect(dest);
    }
    console.error('callback verifyOtp:', error.message, 'type:', type);

    // A PKCE-issued hash is not an OTP hash. signUp() runs on the SSR client, which uses the PKCE
    // flow, so {{ .TokenHash }} renders as `pkce_<hash>` and verifyOtp above cannot mint a session
    // from it. Walked on prod 2026-07-30: a brand-new member clicked Confirm and landed on
    // sign-in?error=auth ("Something went wrong signing you in") even though the click HAD verified
    // their address. Every new signup hit this.
    //
    // Try the PKCE exchange, which succeeds when the link is opened in the browser that submitted
    // the form (the one holding the code_verifier cookie).
    if (tokenHash.startsWith('pkce_')) {
      const { error: pkceErr } = await supabase.auth.exchangeCodeForSession(tokenHash);
      if (!pkceErr) {
        const dest = await resolveDestination(supabase, origin, next);
        return NextResponse.redirect(dest);
      }
      console.error('callback pkce exchange:', pkceErr.message, 'type:', type);
    }

    // Could not open a session here, which is expected when the link is opened from a mail app's
    // webview: the code_verifier lives in the browser that signed up. But verifyOtp already marked
    // the address confirmed, so the honest destination is sign-in with a SUCCESS notice. Showing a
    // red error for a confirmation that actually worked is what made this look broken.
    if (type === 'signup' || type === 'invite' || type === 'email') {
      return NextResponse.redirect(`${origin}/auth/sign-in?confirmed=1`);
    }
  }

  // Path 2 — PKCE code (OAuth flows that start + finish in the same browser).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // This is the Google path, so it is the one the signup switch has to hold.
      if (await rejectClosedSignup(supabase)) {
        return NextResponse.redirect(`${origin}/auth/sign-up`);
      }
      const dest = await resolveDestination(supabase, origin, next);
      return NextResponse.redirect(dest);
    }
    console.error('callback exchangeCode:', error.message);
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth`);
}
