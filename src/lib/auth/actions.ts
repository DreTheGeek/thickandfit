'use server';
// Auth server actions (useActionState-compatible). Backed by Supabase Auth via the SSR client.
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { homePathForUser, type Role } from '@/lib/auth/session';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { recordSignupConsent } from '@/lib/legal/consent';

export type AuthState = { error?: string; sent?: boolean };

const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const emailSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({ password: z.string().min(8) });

const INVALID_CREDENTIALS = 'Enter a valid email and a password of at least 8 characters.';
const INVALID_EMAIL = 'Enter a valid email address.';
const INVALID_PASSWORD = 'Password must be at least 8 characters.';
// Sanitized, non-enumerating messages. The raw Supabase error is logged server-side, never returned
// to the client (would leak "User already registered" / rate-limit internals -> account enumeration).
const SIGNIN_FAILED = 'Invalid email or password. Please try again.';
const SIGNUP_FAILED = 'Could not complete sign-up. Please try again.';
const UPDATE_PASSWORD_FAILED = 'Could not update your password. Please try again.';

async function origin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host') ?? 'app.teamthickandfit.com'}`;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: INVALID_CREDENTIALS };
  if (!(await checkRateLimit(await clientIp(), 'auth-signin', 5, 60))) return { error: TOO_MANY };
  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('signInAction:', error.message);
    return { error: SIGNIN_FAILED };
  }
  // Route by role + onboarding state, reusing the just-authenticated client.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let dest = '/dashboard';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    dest = await homePathForUser(user.id, (profile?.role as Role) ?? 'subscriber');
  }
  redirect(dest);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: INVALID_CREDENTIALS };
  if (!(await checkRateLimit(await clientIp(), 'auth-signup', 3, 60))) return { error: TOO_MANY };
  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) {
    console.error('signUpAction:', error.message);
    return { error: SIGNUP_FAILED };
  }
  // Capture timestamped Terms + Privacy consent for the new user (anti-get-sued). Fire-and-forget.
  if (data.user) {
    const h = await headers();
    void recordSignupConsent(data.user.id, await clientIp(), h.get('user-agent'));
  }
  return { sent: true };
}

export async function requestResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: INVALID_EMAIL };
  if (!(await checkRateLimit(await clientIp(), 'auth-reset', 3, 60))) return { error: TOO_MANY };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset-password`,
  });
  return { sent: true };
}

// Completes a password reset. The recovery callback has already established a session,
// so updateUser runs against the authenticated SSR client. Returns the role home on success.
export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: INVALID_PASSWORD };
  const confirm = String(formData.get('confirm') ?? '');
  if (confirm !== parsed.data.password) return { error: 'Passwords do not match.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error('updatePasswordAction:', error.message);
    return { error: UPDATE_PASSWORD_FAILED };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const dest = await homePathForUser(user.id, (profile?.role as Role) ?? 'subscriber');
  redirect(dest);
}

export async function signInWithOAuthAction(provider: 'google' | 'apple'): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await origin()}/auth/callback` },
  });
  if (error) {
    // Return to the page that initiated OAuth (sign-in OR sign-up), not a hardcoded sign-in -- a
    // failed OAuth started from the sign-up page used to bounce the user to sign-in.
    const h = await headers();
    const referer = h.get('referer');
    let dest = '/auth/sign-in';
    try {
      const u = referer ? new URL(referer) : null;
      if (u && u.host === h.get('host') && u.pathname.startsWith('/auth/')) dest = u.pathname;
    } catch {
      // keep the sign-in default
    }
    redirect(`${dest}?error=oauth`);
  }
  if (data?.url) redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
