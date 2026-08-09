// Founding-vs-standard offer resolution.
//
// The 2026-07-23 call locked a founding rate of $19.97/mo held FOR LIFE, available during a 5-day
// window when doors open, after which new members pay the standard rate. The App Store checklist
// makes the lifetime half a [REQUIRED] item and is blunt about why: "Founding-member lifetime pricing
// must be implemented so an existing subscriber is never silently moved to the standard tier. Apple
// treats tricky price changes as a Code of Conduct issue."
//
// Pure and dependency-free (no 'server-only', no process.env, no Date.now() inside), matching
// tiers.ts, so the client billing UI and the server action agree on one implementation. `now` is
// always injected: the project's purity rule bans clock reads inside render bodies, and injecting it
// is also what makes the window testable without freezing time.

/** Money in cents, the project convention. */
export const FOUNDING_PRICE_CENTS = 1997;

// LOCKED at $24.97 by Dre on 2026-07-30, confirming his 07-23 call. This supersedes the $29.97 in the
// LevelUp App Store checklist and in the 2026-07-01 notes; the app's own marketing copy already said
// $24.97 throughout, so those two documents are the outliers and should be corrected, not this.
//
// Do not change this casually after go-live: an auto-renewing Stripe price cannot be edited, only
// replaced, and moving existing subscribers is exactly the "tricky price change" Apple treats as a
// Code of Conduct issue. Founding members are insulated regardless (see productKeyForOffer).
export const STANDARD_PRICE_CENTS = 2497;

/**
 * Doors open, midnight Pacific (Stephanie's audience is US-anchored).
 *
 * THE DAY IS NOT CONFIRMED. The 2026-08-06 call moved the launch off her Sept 27 birthday to
 * "October, Libra season" ("I think that's going to be the smartest thing logistic-wise") to absorb
 * the D-U-N-S delay, but nobody named a date. Libra season ends 22 Oct, so this sits at the LAST
 * day of the window on purpose.
 *
 * Why late rather than early: this constant only decides when the founding rate stops being
 * claimable (see foundingClosesAt). Too late costs nothing, since the paywall is not open yet. Too
 * early silently starts charging waitlist members $24.97 for the $19.97 they were promised, which
 * is the one failure mode that reaches a customer's card. Replace with the real day when she picks
 * it; nothing else needs to change.
 */
export const DOORS_OPEN_ISO = '2026-10-22T07:00:00.000Z';

/** How long the founding rate stays claimable once doors open. */
export const FOUNDING_WINDOW_DAYS = 5;

export type Offer = 'founding' | 'standard';

const DAY_MS = 86_400_000;

/** The instant the founding window shuts. */
export function foundingClosesAt(): Date {
  return new Date(Date.parse(DOORS_OPEN_ISO) + FOUNDING_WINDOW_DAYS * DAY_MS);
}

/**
 * Which offer a NEW subscriber gets right now.
 *
 * Before doors open counts as founding on purpose: the waitlist is being sold a founding rate for
 * weeks beforehand, and anyone who somehow reaches checkout early must not be charged more than the
 * thing they were promised.
 */
export function currentOffer(now: Date): Offer {
  return now.getTime() < foundingClosesAt().getTime() ? 'founding' : 'standard';
}

/** Whole days left to claim the founding rate; 0 once it has closed. Drives the countdown copy. */
export function foundingDaysLeft(now: Date): number {
  const ms = foundingClosesAt().getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

export function priceCentsForOffer(offer: Offer): number {
  return offer === 'founding' ? FOUNDING_PRICE_CENTS : STANDARD_PRICE_CENTS;
}

/**
 * The entitlement product_key for an offer. This is the GRANDFATHERING RECORD: it is how we can
 * always answer "is this member founding?" without re-deriving it from a signup date, and it is what
 * makes an accidental mass price migration detectable rather than silent.
 *
 * Stripe does not move a live subscription to a new price on its own, so the only real way a founding
 * member gets moved to standard is us doing it. Never bulk-update prices on existing subscriptions.
 */
export function productKeyForOffer(offer: Offer): string {
  return offer === 'founding' ? 'self_guided_founding' : 'self_guided_standard';
}

/** True if this entitlement product_key represents a grandfathered founding member. */
export function isFoundingProductKey(productKey: string | null | undefined): boolean {
  return productKey === 'self_guided_founding';
}

/** Display helper: 1997 -> "$19.97". Cents in, never floats. */
export function formatPriceCents(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
