'use server';
// Auth server actions (useActionState-compatible). Backed by Supabase Auth via the SSR client.
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { homePathForUser, type Role } from '@/lib/auth/session';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { recordSignupConsent } from '@/lib/legal/consent';
import { upsertGhlContact } from '@/lib/ghl/client';
import { ensureCrmContact } from '@/lib/crm/ensure-contact';

export type AuthState = { error?: string; sent?: boolean };

const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
});

const emailSchema = z.object({ email: z.string().email() });
const passwordSchema = z.object({ password: z.string().min(8) });

const INVALID_CREDENTIALS = 'Enter a valid email and a password of at least 8 characters.';
const INVALID_SIGNUP =
  'Enter your first and last name, a valid email, and a password of at least 8 characters.';
const INVALID_EMAIL = 'Enter a valid email address.';
const INVALID_PASSWORD = 'Password must be at least 8 characters.';
// Sanitized, non-enumerating messages. The raw Supabase error is logged server-side, never returned
// to the client (would leak "User already registered" / rate-limit internals -> account enumeration).
const SIGNIN_FAILED = 'Invalid email or password. Please try again.';
const SIGNUP_FAILED = 'Could not complete sign-up. Please try again.';
const ALREADY_REGISTERED =
  'An account with this email already exists. Sign in instead, or use "Forgot password?" to reset your password.';
const UPDATE_PASSWORD_FAILED = 'Could not update your password. Please try again.';

async function origin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host') ?? 'app.teamthickandfit.com'}`;
}

// Security login audit (Fort Knox: who signed in, from where, success/failure). Service-role insert
// into session_logs (insert is service-role-only). Best-effort; a logging failure never blocks login.
async function logSignIn(
  success: boolean,
  opts: { userId?: string | null; companyId?: string | null; reason?: string } = {},
): Promise<void> {
  try {
    const h = await headers();
    await createServiceClient()
      .from('session_logs')
      .insert({
        user_id: opts.userId ?? null,
        company_id: opts.companyId ?? null,
        event_type: 'login_password',
        ip_address: await clientIp(),
        user_agent: h.get('user-agent'),
        success,
        failure_reason: opts.reason ?? null,
      });
  } catch (e) {
    console.error('logSignIn:', e instanceof Error ? e.message : e);
  }
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
    after(() => logSignIn(false, { reason: 'bad_credentials' }));
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
      .select('role, ui_locale, content_locale, company_id')
      .eq('id', user.id)
      .maybeSingle();
    const signInCompanyId = (profile as { company_id?: string | null } | null)?.company_id ?? null;
    after(() => logSignIn(true, { userId: user.id, companyId: signInCompanyId }));
    // Apply the user's saved language so the app loads in their preference on any device.
    if (profile?.ui_locale === 'en' || profile?.ui_locale === 'es') {
      const store = await cookies();
      const oneYear = 60 * 60 * 24 * 365;
      store.set('ui_locale', profile.ui_locale, { path: '/', maxAge: oneYear, sameSite: 'lax' });
      const content =
        profile.content_locale === 'en' || profile.content_locale === 'es'
          ? profile.content_locale
          : profile.ui_locale;
      store.set('content_locale', content, { path: '/', maxAge: oneYear, sameSite: 'lax' });
    }
    dest = await homePathForUser(user.id, (profile?.role as Role) ?? 'subscriber');
  }
  redirect(dest);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  });
  if (!parsed.success) return { error: INVALID_SIGNUP };
  if (!(await checkRateLimit(await clientIp(), 'auth-signup', 3, 60))) return { error: TOO_MANY };
  const { email, password, firstName, lastName } = parsed.data;
  const fullName = `${firstName} ${lastName}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      // Display metadata only, never authorization (that lives in app_metadata / profiles.role).
      data: { first_name: firstName, last_name: lastName, full_name: fullName },
    },
  });
  if (error) {
    console.error('signUpAction:', error.message);
    return { error: SIGNUP_FAILED };
  }
  // Supabase enumeration protection: signing up with an already-registered email "succeeds" with a
  // fake user carrying zero identities, and NO email is ever sent. Without this check the UI shows
  // "check your email" and the person waits forever (observed 2026-07-18: a real user re-signed-up,
  // got the dead-end, then failed sign-in). Telling them the account exists is a deliberate UX >
  // enumeration tradeoff here; the 3/min rate limit above bounds abuse.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: ALREADY_REGISTERED };
  }
  if (data.user) {
    // The auth trigger already created the profile row (it fires on the auth.users insert), but it
    // only copies id + email; persist the name so the coach portal shows it before onboarding.
    const { error: nameErr } = await createServiceClient()
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', data.user.id);
    if (nameErr) console.error('signUpAction full_name:', nameErr.message);
    // Capture timestamped Terms + Privacy consent for the new user (anti-get-sued). This is legal
    // evidence, so it must NOT ride a bare `void` (the frozen lambda can drop it): run it inside the
    // same after() unit as the CRM sync, where the response is kept alive until the work completes.
    const h = await headers();
    const consentIp = await clientIp();
    const consentUa = h.get('user-agent');
    // Surface the new member in the Clients CRM and GoHighLevel at signup itself, so the coach
    // portal and Stephanie's automations see them without waiting for onboarding (which refines the
    // same contact later and is a no-op if this already linked it). after() so the frozen lambda
    // cannot drop the work; any failure here never blocks signup.
    const store = await cookies();
    const lang = store.get('ui_locale')?.value === 'es' ? 'es' : 'en';
    const userId = data.user.id;
    after(async () => {
      try {
        await recordSignupConsent(userId, consentIp, consentUa);
      } catch (e) {
        console.error('signUpAction consent capture:', e instanceof Error ? e.message : e);
      }
      try {
        const svc = createServiceClient();
        const { data: prof } = await svc
          .from('profiles')
          .select('company_id')
          .eq('id', userId)
          .maybeSingle();
        const companyId = (prof as { company_id?: string | null } | null)?.company_id ?? null;
        if (companyId) {
          await ensureCrmContact({ profileId: userId, companyId, firstName, lastName, language: lang });
        }
        const { contactId } = await upsertGhlContact({
          email,
          firstName,
          lastName,
          tags: ['app-signup', `lang:${lang}`],
        });
        if (contactId && companyId) {
          await svc
            .from('contacts')
            .update({ ghl_contact_id: contactId })
            .eq('company_id', companyId)
            .eq('profile_id', userId)
            .is('ghl_contact_id', null);
        }
      } catch (e) {
        console.error('signUpAction post-signup sync:', e instanceof Error ? e.message : e);
      }
    });
  }
  return { sent: true };
}

export async function requestResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: INVALID_EMAIL };
  if (!(await checkRateLimit(await clientIp(), 'auth-reset', 3, 60))) return { error: TOO_MANY };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/auth/reset-password`,
  });
  // The user response stays neutral either way (no account enumeration), but the failure MUST hit
  // the server log: a silently swallowed 429 here is exactly how the 2/hour project email cap hid
  // while users were told "a reset link is on its way" (2026-07-18).
  if (error) console.error('requestResetAction:', error.message);
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
