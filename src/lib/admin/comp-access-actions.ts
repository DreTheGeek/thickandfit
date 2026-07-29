'use server';
// Comp access: grant or revoke free entitlement without a Stripe subscription.
//
// The launch-blocking use case: ~256 Lenus clients were imported into client_subscriptions but have
// no native subscriptions row, so the moment STRIPE_SECRET_KEY lands and requireEntitled arms, all
// of them get paywalled out of an app they already paid for. Comping them ahead of the cutover is
// the fix. profiles.comp_access_until (migration 0035) is what isEntitled() checks.
//
// Every mutation is operator-gated, rate-limited, and audited (Fort Knox: a free-access grant is
// exactly the kind of action a revenue reconciliation needs to trace back to a person).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { grantCompAccess, revokeCompAccess } from '@/lib/billing/entitlement';
import { logCoachAction } from '@/lib/coach/audit';
import { profileIdsFromJoin, type LegacyJoinRow } from '@/lib/admin/legacy-join';

export type CompResult = { ok: boolean; error?: string; granted?: number };

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  days: z.number().int().min(1).max(3650),
});
const revokeSchema = z.string().uuid();

/** Grant comp access to a single member, resolved by email within this company. */
export async function grantCompAccessAction(input: unknown): Promise<CompResult> {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (!(await checkRateLimit(ctx.userId, 'admin-comp-grant', 30, 3600, { failClosed: true }))) {
    return { ok: false, error: 'rate_limited' };
  }

  const { email, days } = parsed.data;
  const sb = createServiceClient();
  const { data: prof } = await sb
    .from('profiles')
    .select('id, email')
    .eq('company_id', ctx.companyId)
    .ilike('email', email)
    .maybeSingle();
  const profile = prof as { id: string; email: string | null } | null;
  if (!profile) return { ok: false, error: 'not_found' };

  await grantCompAccess(profile.id, days);
  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: profile.id,
    action: 'admin.grant_comp_access',
    newState: { email: profile.email, days },
  });
  revalidatePath('/admin/comp-access');
  return { ok: true, granted: 1 };
}

/** Revoke comp access immediately for one member. */
export async function revokeCompAccessAction(input: unknown): Promise<CompResult> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const profileId = parsed.data;
  const sb = createServiceClient();
  // Scope check before mutating: never let a crafted id revoke across tenants.
  const { data: prof } = await sb
    .from('profiles')
    .select('id, email, company_id')
    .eq('id', profileId)
    .maybeSingle();
  const profile = prof as { id: string; email: string | null; company_id: string | null } | null;
  if (!profile || profile.company_id !== ctx.companyId) return { ok: false, error: 'not_found' };

  await revokeCompAccess(profile.id);
  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: profile.id,
    action: 'admin.revoke_comp_access',
    newState: { email: profile.email },
  });
  revalidatePath('/admin/comp-access');
  return { ok: true };
}

/**
 * Bulk-comp every legacy client: any profile in this company whose linked CRM contact carries a
 * client_subscriptions row but who has NO native subscriptions row. That is exactly the cohort the
 * paywall would lock out at Stripe-go-live. Default 180 days buys a full migration window.
 *
 * Idempotent by nature (re-running just re-stamps comp_access_until), and audited as one bulk row
 * plus the count so the log stays readable.
 */
export async function bulkCompLegacyAction(days = 180): Promise<CompResult> {
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  if (!(await checkRateLimit(ctx.userId, 'admin-comp-bulk', 5, 3600, { failClosed: true }))) {
    return { ok: false, error: 'rate_limited' };
  }

  const sb = createServiceClient();

  // Contacts that carry an imported subscription (the Lenus cohort) AND link to a real profile.
  const { data: legacyRows, error: legacyErr } = await sb
    .from('client_subscriptions')
    .select('contact_id, contacts!inner(profile_id, company_id)')
    .eq('contacts.company_id', ctx.companyId)
    .not('contacts.profile_id', 'is', null);
  if (legacyErr) {
    console.error('bulkCompLegacyAction legacy read:', legacyErr.message);
    return { ok: false, error: 'failed' };
  }

  // Postgrest types an embedded !inner select as an ARRAY even when the FK is to-one, so normalize
  // both shapes rather than asserting one and being wrong at runtime.
  const legacyProfileIds = new Set<string>();
  for (const row of (legacyRows ?? []) as unknown as LegacyJoinRow[]) {
    for (const pid of profileIdsFromJoin(row)) legacyProfileIds.add(pid);
  }
  if (legacyProfileIds.size === 0) return { ok: true, granted: 0 };

  // Exclude anyone who already has a native subscription (they will pass the paywall on their own).
  const { data: nativeRows } = await sb
    .from('subscriptions')
    .select('profile_id')
    .in('profile_id', [...legacyProfileIds]);
  for (const row of (nativeRows ?? []) as { profile_id: string }[]) {
    legacyProfileIds.delete(row.profile_id);
  }
  if (legacyProfileIds.size === 0) return { ok: true, granted: 0 };

  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error: updErr } = await sb
    .from('profiles')
    .update({ comp_access_until: until })
    .eq('company_id', ctx.companyId)
    .in('id', [...legacyProfileIds]);
  if (updErr) {
    console.error('bulkCompLegacyAction update:', updErr.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    action: 'admin.bulk_comp_legacy',
    newState: { count: legacyProfileIds.size, days, until },
  });
  revalidatePath('/admin/comp-access');
  return { ok: true, granted: legacyProfileIds.size };
}
