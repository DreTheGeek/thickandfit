// Access entitlement. THE single authoritative read is public.entitlements (migration 0095): every
// provider (Stripe, Apple IAP, GHL, manual comp) projects a grant into that one table and this module
// is the only thing that interprets it. Coaches/operators are entitled by role and checked by the
// caller (guards.ts), not here.
//
// Why one table: access used to be derived from `subscriptions` OR `profiles.comp_access_until`, and
// neither could represent an Apple purchase. Apple's review checklist makes a single source of truth a
// submission blocker, and separately forbids the client trusting a payment provider for entitlement
// state. See supabase/migrations/0095_entitlements.sql for the full rationale.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { isStripeConfigured } from '@/lib/billing/stripe';
import { readCoachSettingsForProfile } from '@/lib/coach/settings';

/** Entitlement source vocabulary, matching the CHECK constraint on entitlements.source. */
export type EntitlementSource = 'apple' | 'stripe' | 'ghl' | 'manual';
export type EntitlementStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'revoked';

/** The only statuses that grant access. Must stay in sync with 0095's status CHECK.
 *  past_due deliberately does NOT grant: Stripe retries for days, and serving paid content through a
 *  failed payment is how involuntary churn turns into unpaid usage. */
export function isActiveEntitlementStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

/** True if this profile may use the paid app right now. Single query against the authoritative table. */
export async function isEntitled(profileId: string): Promise<boolean> {
  // Pre-launch: while Stripe is unconfigured nobody CAN subscribe, so gating would lock every member
  // out of the paid surfaces with no way to pay. Everyone is entitled until the live
  // STRIPE_SECRET_KEY lands; then this line goes inert and pay-to-enter arms itself everywhere.
  if (!isStripeConfigured()) return true;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('entitlements')
    .select('status, expires_at')
    .eq('profile_id', profileId)
    .in('status', ['active', 'trialing']);
  if (error) {
    // Fail CLOSED. An unreadable entitlement table must not hand out free access to the whole app.
    console.error('isEntitled:', error.message);
    return false;
  }

  const rows = (data ?? []) as { status: string; expires_at: string | null }[];
  const now = Date.now();
  const liveNow = rows.some((r) => {
    if (!isActiveEntitlementStatus(r.status)) return false;
    // No expiry = open-ended grant. Otherwise it must still be in the future.
    return !r.expires_at || new Date(r.expires_at).getTime() > now;
  });
  if (liveNow) return true;

  // "Automatically remove client access to the app when their membership expires" (coach settings,
  // default ON). Only asked when the answer could change: a member who is entitled right now is
  // entitled either way, and skipping the read keeps the settings table off the hot path.
  //
  // Scope is deliberately narrow. This can only rescue a grant that is STILL active or trialing and
  // has simply run past its end date, which is the manual / GHL / paid-through-a-date case the coach
  // is describing. A canceled, past_due, expired or revoked grant is dead regardless: turning this
  // switch off must never keep serving paid content to someone whose payment failed.
  const datedButActive = rows.some(
    (r) => isActiveEntitlementStatus(r.status) && r.expires_at !== null,
  );
  if (!datedButActive) return false;

  const { isAccessRevokedOnExpiry } = await readCoachSettingsForProfile(profileId);
  return !isAccessRevokedOnExpiry;
}

/**
 * Project a grant into the authoritative table. Every provider funnels through here.
 *
 * Idempotent by construction: upserts on (company_id, source, external_txn_id), the unique index from
 * 0095. Duplicate webhook delivery is normal, not exceptional, so a redelivered event updates the
 * existing grant instead of minting a second one.
 */
export async function upsertEntitlement(input: {
  companyId: string;
  profileId: string;
  source: EntitlementSource;
  status: EntitlementStatus;
  externalTxnId: string;
  productKey?: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  rawPayload?: unknown;
}): Promise<{ ok: boolean }> {
  const svc = createServiceClient();
  const { error } = await svc.from('entitlements').upsert(
    {
      company_id: input.companyId,
      profile_id: input.profileId,
      product_key: input.productKey ?? 'self_guided',
      source: input.source,
      status: input.status,
      ...(input.startedAt ? { started_at: input.startedAt } : {}),
      expires_at: input.expiresAt ?? null,
      external_txn_id: input.externalTxnId,
      raw_payload: (input.rawPayload ?? null) as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,source,external_txn_id' },
  );
  if (error) {
    // Never swallow a money event: a charged-but-not-granted member has to be findable in the logs.
    console.error('upsertEntitlement:', error.message, input.source, input.externalTxnId);
    return { ok: false };
  }
  return { ok: true };
}

/** Grant a profile comped access for `days` from now (challenge winners, free clients). Coach-only. */
export async function grantCompAccess(profileId: string, days: number): Promise<void> {
  const until = new Date(Date.now() + Math.max(1, Math.floor(days)) * 86_400_000).toISOString();
  const svc = createServiceClient();
  // comp_access_until stays written: 9 admin/coach surfaces render it. It is no longer an access
  // oracle, just the human-readable comp window.
  await svc.from('profiles').update({ comp_access_until: until }).eq('id', profileId);

  const { data: prof } = await svc
    .from('profiles')
    .select('company_id')
    .eq('id', profileId)
    .maybeSingle();
  const companyId = (prof as { company_id: string | null } | null)?.company_id ?? null;
  if (!companyId) {
    console.error('grantCompAccess: no company on profile', profileId, '- entitlement NOT written');
    return;
  }
  await upsertEntitlement({
    companyId,
    profileId,
    source: 'manual',
    status: 'active',
    // Synthetic and stable, so re-granting extends the same row rather than stacking duplicates.
    externalTxnId: `comp:${profileId}`,
    expiresAt: until,
    rawPayload: { grantedDays: days },
  });
}

/** Revoke comped access immediately (clears the timestamp). Coach-only. */
export async function revokeCompAccess(profileId: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('profiles').update({ comp_access_until: null }).eq('id', profileId);
  // Revoke rather than delete: an audit of "who had access when" must survive the revocation.
  const { error } = await svc
    .from('entitlements')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('profile_id', profileId)
    .eq('source', 'manual');
  if (error) console.error('revokeCompAccess entitlement:', error.message);
}

/** True once the client has accepted the health / assumption-of-risk disclaimer. */
export async function hasAckedHealth(profileId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('health_ack_at')
    .eq('id', profileId)
    .maybeSingle();
  return Boolean((data as { health_ack_at: string | null } | null)?.health_ack_at);
}

/** Record the client's health-disclaimer acceptance (timestamped). */
export async function ackHealth(profileId: string): Promise<void> {
  const svc = createServiceClient();
  await svc.from('profiles').update({ health_ack_at: new Date().toISOString() }).eq('id', profileId);
}
