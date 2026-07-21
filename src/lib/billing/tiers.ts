// Checkout tier vocabulary, shared by the server action and the client billing UI. Pure (no
// 'server-only', no process.env) so a client component can import the type + helpers safely.
//
// Onboarding captures one of three coaching tiers. Only Self-Guided is an instant self-serve Stripe
// subscription. Team ($200-300) and 1-on-1 with Steph ($3k+) are high-ticket, application/consult
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
