// Subscription and entitlement status predicates: the pure part.
//
// Split out of subscriptions.ts and entitlement.ts for the same reason settings-shared.ts and
// notification-preferences-shared.ts exist — both of those modules import `server-only`, and these
// three lists are the highest-consequence branching logic in the app that a test can actually reach.
// No database, no imports, so .qa-visual/billing-past-due-test.mts can assert the real functions
// instead of a copy of them that drifts.
//
// THREE LISTS THAT LOOK ALIKE AND ANSWER DIFFERENT QUESTIONS. Collapsing any two of them is the
// failure this file is arranged to prevent:
//
//   isActiveStatus              "render this as a live membership"      includes past_due
//   isActiveEntitlementStatus   "may she use the paid app right now"    excludes past_due
//   LIVE_SUBSCRIPTION_STATUSES  "would a second subscription double-bill her"  includes unpaid
//
// past_due is the status that separates the first two: Stripe retries for days, so the membership is
// real and she must not be served paid content through a failed payment. unpaid separates the third:
// it grants nothing and renders as inactive, but she still has a subscription object, and selling her
// another one charges her twice.

/** Subscription statuses the UI should present as a live membership. */
const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

export function isActiveStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.includes(status));
}

/** Entitlement statuses that grant access. Must stay in sync with 0095's status CHECK.
 *  past_due deliberately does NOT grant: Stripe retries for days, and serving paid content through a
 *  failed payment is how involuntary churn turns into unpaid usage. */
export function isActiveEntitlementStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Statuses that mean "she already has one of these", so checkout must refuse.
 *
 * `canceled` and `incomplete` are deliberately absent: resubscribing after a cancellation is the
 * flow working as intended, and an incomplete session never became a subscription.
 */
export const LIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'unpaid', 'paused'];

/**
 * Where a member belongs, given every entitlement status on her account.
 *
 * The routing table, in one pure function, because the branch is easy to get subtly wrong and both
 * wrong answers are silent. Sending a declined card to /checkout offers her a SECOND subscription
 * alongside the one she is being dunned for; sending a never-subscribed member to the card-update
 * flow shows her a fix for a card that does not exist.
 *
 * A live grant always wins. A member holding a working subscription and a stale past_due row from
 * some earlier failure is not a card problem, and raising one at her would be a false alarm on
 * somebody who is paying fine.
 *
 * And a pause is not a lapse. She asked for the break, a date was agreed, and meeting her with a
 * paywall re-opens a decision she already made in our favour — which is why 'paused' has its own
 * outcome instead of falling through to checkout.
 */
export function routeForEntitlements(statuses: string[]): 'app' | 'paused' | 'fixCard' | 'checkout' {
  if (statuses.some(isActiveEntitlementStatus)) return 'app';
  // Paused outranks past_due. A member on an agreed break whose card also happens to have expired
  // during it should see her break, not a demand to fix a card for coaching she is not receiving.
  if (statuses.includes('paused')) return 'paused';
  return statuses.includes('past_due') ? 'fixCard' : 'checkout';
}

/**
 * The `external_txn_id` of a member's pause grant.
 *
 * A pause is a `manual` entitlement row, deliberately separate from her Stripe grant: pausing must
 * not overwrite what she bought, and resuming must not invent access she no longer has. The id is
 * stable per member so re-pausing updates one row rather than stacking them, and it is distinct
 * from the comp grant's `comp:${profileId}` so a pause can never clobber a comp.
 *
 * Defined here rather than written inline at each call site because three places now depend on the
 * exact string — pauseMemberAction writes it, resumeMemberAction matches on it, and the engagement
 * sweep has to recognise and IGNORE it — and a drift between any two of them fails silently.
 */
export const PAUSE_GRANT_PREFIX = 'pause:';

export function pauseGrantId(profileId: string): string {
  return `${PAUSE_GRANT_PREFIX}${profileId}`;
}

/** Is this entitlement row the pause bookkeeping rather than something she actually holds? */
export function isPauseGrant(externalTxnId: string | null | undefined): boolean {
  return typeof externalTxnId === 'string' && externalTxnId.startsWith(PAUSE_GRANT_PREFIX);
}
