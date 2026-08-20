// Checkout tier vocabulary, shared by the server action and the client billing UI. Pure (no
// 'server-only', no process.env) so a client component can import the type + helpers safely.
//
// Onboarding captures one of three coaching tiers. Only Self-Guided is an instant self-serve Stripe
// subscription. Team ($197/mo) and 1-on-1 with Steph (unadvertised, no longer offered at signup)
// are high-ticket, application/consult
// tiers: a one-tap auto-renewing checkout at that price is a chargeback + ROSCA/ARL liability, so
// those route to a "the team will reach out" flow instead (the tier interest is already on the CRM
// contact from onboarding). Legacy low/mid values map forward so older data keeps working.

export const CHECKOUT_TIERS = ['self', 'team', 'steph'] as const;
export type CheckoutTier = (typeof CHECKOUT_TIERS)[number];

export const SELF_SERVE_TIERS: readonly CheckoutTier[] = ['self'];

export function normalizeTier(raw: unknown): CheckoutTier {
  switch (raw) {
    case 'self':
    case 'low':
      return 'self';
    case 'team':
    case 'mid':
      return 'team';
    case 'steph':
    case 'high':
      return 'steph';
    default:
      return 'self';
  }
}

export function isSelfServe(tier: CheckoutTier): boolean {
  return SELF_SERVE_TIERS.includes(tier);
}

/**
 * Tiers that include a written meal plan.
 *
 * Lives here, beside SELF_SERVE_TIERS, because it is the same kind of statement: what a tier IS,
 * not what some module does about it. The auto-assign job reads it, and so should anything that
 * later needs to answer "does she get nutrition" — a second copy of this list somewhere else is how
 * a member ends up entitled to a plan on one screen and not on another.
 *
 * `self` is training-only by design (2026-08-13: "you pay the higher tier, here's your meal plan"),
 * which is exactly the inverse of SELF_SERVE_TIERS and not a coincidence: the written plan is part
 * of what the sales-assisted tiers are sold on.
 */
export const MEAL_PLAN_TIERS: readonly CheckoutTier[] = ['team', 'steph'];

/** Accepts either vocabulary; anything unrecognised normalizes to `self` and gets no plan, which is
 *  the safe direction — withholding falls back to today's behaviour of a coach doing it by hand. */
export function tierGetsMealPlan(tier: unknown): boolean {
  return MEAL_PLAN_TIERS.includes(normalizeTier(tier));
}
