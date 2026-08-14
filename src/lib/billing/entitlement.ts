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
import { isActiveEntitlementStatus, routeForEntitlements } from '@/lib/billing/status-shared';

/** Entitlement source vocabulary, matching the CHECK constraint on entitlements.source. */
export type EntitlementSource = 'apple' | 'stripe' | 'ghl' | 'manual';
export type EntitlementStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  // A coach-granted break (0140). Grants nothing, but is NOT canceled: expires_at holds the resume
  // date and her own records stay readable. See isPaused below.
  | 'paused'
  | 'canceled'
  | 'expired'
  | 'revoked';

// Definition lives in status-shared.ts alongside the two lists it must never be collapsed into.
export { isActiveEntitlementStatus } from '@/lib/billing/status-shared';

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
 * True when she HAS a grant and the only thing wrong with it is that a payment failed.
 *
 * "Not entitled" is one boolean covering two situations that call for opposite screens. A woman who
 * never subscribed should see the checkout page. A woman whose card expired should see a button that
 * replaces the card — sending her to checkout offers to sell her a second subscription alongside the
 * one she is already being dunned for, and startCheckoutAction would happily create it, because it
 * reads her existing subscription only for the customer id.
 *
 * Narrow on purpose. Only past_due qualifies. `canceled`, `expired` and `revoked` are settled states
 * where checkout is the right destination, and `unpaid` is Stripe's terminal give-up after the whole
 * retry schedule has failed — by then the subscription itself needs recreating, not the card.
 */
export async function pastDueOnly(profileId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('entitlements')
    .select('status')
    .eq('profile_id', profileId);
  // Fail to FALSE, which routes her to checkout. Wrong, but the safe wrong: it shows a working page
  // rather than a card-update flow for a subscription we could not confirm exists.
  if (error) {
    console.error('pastDueOnly:', error.message);
    return false;
  }

  // routeForEntitlements holds the whole table, including the case that makes this self-contained
  // rather than order-dependent: a live grant beside a stale past_due one is a member with working
  // access, and telling her to fix a card would be a false alarm.
  const rows = (data ?? []) as { status: string }[];
  return routeForEntitlements(rows.map((r) => r.status)) === 'fixCard';
}

/**
 * Is she on a coach-granted break, and until when?
 *
 * A pause is not a cancellation and must not be shown as one. She asked for a break, she is coming
 * back on a date somebody agreed with her, and the worst thing this app can do in the meantime is
 * meet her with a paywall — that turns a pause into a decision she had not made.
 *
 * The resume date rides expires_at, matching how manual comp grants already use the column. Null
 * means paused with no agreed date, which is a real case ("pause me until I say") and renders as an
 * open-ended break rather than a blank.
 */
export async function isPaused(
  profileId: string,
): Promise<{ paused: boolean; resumesOn: string | null }> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('entitlements')
    .select('status, expires_at')
    .eq('profile_id', profileId);
  // Fail to NOT paused. Wrong in the direction that shows her the normal app rather than stranding
  // her on a break page she cannot leave, which is the failure she would have to email about.
  if (error) {
    console.error('isPaused:', error.message);
    return { paused: false, resumesOn: null };
  }

  const rows = (data ?? []) as { status: string; expires_at: string | null }[];
  // The same table the guard routes on, so "is she paused" and "where does she go" cannot disagree.
  // A live grant wins: someone holding both a paused row and an active one has access, and locking
  // her out over a stale row would be the worse error.
  if (routeForEntitlements(rows.map((r) => r.status)) !== 'paused') {
    return { paused: false, resumesOn: null };
  }
  const paused = rows.find((r) => r.status === 'paused');
  return { paused: true, resumesOn: paused?.expires_at ?? null };
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
