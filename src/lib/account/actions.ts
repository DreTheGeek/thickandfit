'use server';

// Account self-service: GDPR/CCPA right-to-erasure. Deleting the auth user cascades to public.profiles
// (profiles.id references auth.users on delete cascade), which in turn cascades to every profile-owned
// table (food_log, habits, habit_logs, progress_photos, coach_messages, ...). One call erases the user.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ackHealth } from '@/lib/billing/entitlement';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

// Record acceptance of the health / assumption-of-risk disclaimer, then continue into the app.
export async function acceptHealthAction(): Promise<void> {
  const ctx = await requireAuth();
  await ackHealth(ctx.userId);
  redirect('/dashboard');
}

export async function deleteAccountAction(): Promise<void> {
  const ctx = await requireAuth();

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(ctx.userId);
  if (error) {
    console.error('deleteAccountAction:', error.message);
    throw new Error('delete_failed');
  }

  // The session now points at a deleted user; clear the auth cookies before leaving the app.
  const sb = await createClient();
  await sb.auth.signOut();
  redirect('/?deleted=1');
}

// ---------------------------------------------------------------------------
// Data export (GDPR Art. 20 / CCPA right to know). The signed-in user assembles
// THEIR OWN owned rows into one JSON document for download. Service client + an
// explicit ALLOWLIST so the export surface stays auditable and can never leak
// another tenant's data or internal security/audit/secret material.
// ---------------------------------------------------------------------------

// Tables keyed by the user's PROFILE id (profiles.id === auth.uid()). User-authored
// or user-facing data the person is entitled to take with them.
const EXPORT_BY_PROFILE = [
  'food_log',
  'weight_entries',
  'habits',
  'habit_logs',
  'workout_logs',
  'workout_completion_history',
  'coach_messages',
  'notifications',
  'post_comments',
  'post_reactions',
  'recipe_favorites',
  'form_assignments',
  'form_responses',
  'plan_assignments',
  'onboarding_responses',
  'challenge_participants',
  'cancellation_reasons',
  'payments',
  'subscriptions',
  'user_insights',
  'user_streaks',
  'user_badges',
  'contacts',
] as const;

// Tables keyed by the user's auth id directly.
const EXPORT_BY_USER = ['consent_captures', 'notification_preferences'] as const;

// progress_photos is exported as METADATA ONLY (storage paths, never image bytes).
const PHOTO_COLUMNS = 'id, storage_path, taken_on, pose, weight_kg, created_at';

// REDACTED by design (documented for the audit trail, NEVER queried here):
//   security_events, audit_log, session_logs  -> security/internal telemetry
//   push_subscriptions p256dh/auth/endpoint    -> live push secrets
//   ai_usage_log                               -> internal cost/usage accounting
//   progress_photos image bytes                -> paths only, no binary
export type ExportState = { json?: string; error?: string };

export async function exportMyDataAction(): Promise<ExportState> {
  const ctx = await requireAuth();

  // Bound the export so it cannot be hammered (each run reads ~25 tables via service client).
  if (!(await checkRateLimit(await clientIp(), 'account-export', 5, 60))) {
    return { error: 'rateLimited' };
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const svc = createServiceClient();
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    note: 'This is the personal data Thick & Fit holds for your account. Internal security, audit, and notification-secret records are intentionally excluded.',
    account: {
      id: ctx.userId,
      email: user?.email ?? null,
      created_at: user?.created_at ?? null,
    },
  };

  for (const table of EXPORT_BY_PROFILE) {
    const { data, error } = await svc.from(table).select('*').eq('profile_id', ctx.userId);
    if (error) console.error(`exportMyDataAction ${table}:`, error.message);
    out[table] = data ?? [];
  }
  for (const table of EXPORT_BY_USER) {
    const { data, error } = await svc.from(table).select('*').eq('user_id', ctx.userId);
    if (error) console.error(`exportMyDataAction ${table}:`, error.message);
    out[table] = data ?? [];
  }

  // Photos: metadata + storage path only, never image bytes.
  const { data: photos } = await svc
    .from('progress_photos')
    .select(PHOTO_COLUMNS)
    .eq('profile_id', ctx.userId);
  out.progress_photos = photos ?? [];

  // The profile row itself (id === auth.uid()).
  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', ctx.userId)
    .maybeSingle();
  out.profile = profile ?? null;

  return { json: JSON.stringify(out, null, 2) };
}

// ---------------------------------------------------------------------------
// Change password (in-app, already signed in). Requires the current password so
// a hijacked session cannot silently lock the real owner out (Fort Knox anti-hacker).
// ---------------------------------------------------------------------------

export type AccountFormState = { ok?: boolean; error?: string; pending?: boolean };

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function updateMyPasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const ctx = await requireAuth();

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) return { error: 'invalidPassword' };

  const confirm = String(formData.get('confirmPassword') ?? '');
  if (confirm !== parsed.data.newPassword) return { error: 'passwordMismatch' };

  if (!(await checkRateLimit(await clientIp(), 'account-password', 5, 60))) {
    return { error: 'rateLimited' };
  }

  const sb = await createClient();
  // updateUser({ password, current_password }) re-verifies the old password server-side
  // before applying the change (supabase-js >= 2.102; this repo runs 2.108.2).
  const { error } = await sb.auth.updateUser({
    password: parsed.data.newPassword,
    current_password: parsed.data.currentPassword,
  });
  if (error) {
    // Most common cause: wrong current password. Sanitized, non-enumerating message.
    console.error('updateMyPasswordAction:', error.message);
    return { error: 'passwordUpdateFailed' };
  }
  void logSecurityEvent(ctx.userId, 'password_changed');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Change email. Supabase "Secure email change" (default ON) is NOT immediate:
// it sends a confirmation link to BOTH the current and the new inbox, and the
// email only changes after confirmation. So we return a PENDING state, never ok.
// profiles.email is kept in sync by the on_auth_user_updated trigger (0043).
// ---------------------------------------------------------------------------

const emailChangeSchema = z.object({ email: z.string().email() });

async function origin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host') ?? 'app.teamthickandfit.com'}`;
}

export async function updateMyEmailAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireAuth();

  const parsed = emailChangeSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'invalidEmail' };

  if (!(await checkRateLimit(await clientIp(), 'account-email', 5, 60))) {
    return { error: 'rateLimited' };
  }

  const sb = await createClient();
  const { error } = await sb.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await origin()}/auth/callback` },
  );
  if (error) {
    console.error('updateMyEmailAction:', error.message);
    return { error: 'emailUpdateFailed' };
  }
  // Pending, NOT ok: the change lands only after both-inbox confirmation.
  return { pending: true };
}

// Best-effort security audit row. Fire-and-forget; never blocks the action.
async function logSecurityEvent(userId: string, eventType: string): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('security_events').insert({ user_id: userId, event_type: eventType });
  } catch {
    // Telemetry must never break the user-facing action.
  }
}
