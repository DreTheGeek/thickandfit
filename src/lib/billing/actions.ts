'use server';
// Billing server actions: start checkout (writes a consent_captures row), one-tap cancel
// (cancel_at_period_end + optional reason), and reactivate. No dark patterns: cancel is a single
// confirm, reason is optional, and reactivate is always offered.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
// Optional free trial, configured per offer. 0/unset = charge immediately. Shared with the /vs
// pages so the advertised trial and the sent trial cannot disagree; see trial-shared.ts.
import { configuredTrialDays as trialDays } from '@/lib/billing/trial-shared';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import {
  isStripeConfigured,
  createCustomer,
  createCheckoutSession,
  cancelAtPeriodEnd,
  reactivate,
} from '@/lib/billing/stripe';
import { getSubscriptionForProfile } from '@/lib/billing/subscriptions';
import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/billing/status-shared';
import { normalizeTier, isSelfServe, type CheckoutTier } from '@/lib/billing/tiers';
import { currentOffer, productKeyForOffer, type Offer } from '@/lib/billing/offer';

export type BillingState = {
  error?: string;
  ok?: boolean;
  checkoutUrl?: string;
  /** Set with error 'alreadySubscribed' so the page can say WHICH problem she has. */
  existingStatus?: string;
};

// The list, and the reason it is not isActiveStatus, live in status-shared.ts.

const CONSENT_VERSION = '2026-06';

// Tier + offer -> Stripe price id, with legacy fallbacks so existing single-price config keeps
// working. self is the only self-serve tier; team/steph prices exist so a future direct sale can be
// switched on, but the action still gates them behind isSelfServe (see startCheckoutAction).
//
// The founding/standard split only applies to `self`: the high-ticket tiers are sold by conversation,
// not by a window. If the founding price id is missing we fall back to the single self price rather
// than failing checkout, so a half-configured Stripe account still sells at the legacy price instead
// of showing "not configured" to a member holding a card.
function priceForTier(tier: CheckoutTier, offer: Offer): string | undefined {
  const e = process.env;
  if (tier === 'self') {
    const byOffer =
      offer === 'founding' ? e.STRIPE_PRICE_SELF_FOUNDING : e.STRIPE_PRICE_SELF_STANDARD;
    return byOffer ?? e.STRIPE_PRICE_SELF ?? e.STRIPE_PRICE_LOW ?? e.STRIPE_PRICE_ID ?? undefined;
  }
  if (tier === 'team') return e.STRIPE_PRICE_TEAM ?? e.STRIPE_PRICE_MID ?? undefined;
  return e.STRIPE_PRICE_STEPH ?? e.STRIPE_PRICE_HIGH ?? undefined;
}

async function origin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host') ?? 'www.teamthickandfit.com'}`;
}

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  return { ip, ua: h.get('user-agent') };
}

/**
 * Start subscription checkout. Records explicit billing consent BEFORE redirecting to Stripe
 * (anti-get-sued: timestamped consent with IP + user agent). Returns a Stripe Checkout URL.
 */
export async function startCheckoutAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requireAuth();
  if (!ctx.companyId) return { error: 'noCompany' };
  if (!isStripeConfigured()) return { error: 'notConfigured' };
  // Card-testing / spam control: creating checkout sessions writes consent rows and hits Stripe, so
  // cap attempts per user. 10/hour is far above any honest retry pattern (fails open on limiter error).
  if (!(await checkRateLimit(ctx.userId, 'checkout-start', 10, 3600, { failClosed: true }))) return { error: 'rateLimited' };

  // The chosen tier flows in from the checkout page (member's onboarding pick). Only self-serve tiers
  // may create a Stripe subscription here; high-ticket tiers are application-based (guard, even though
  // the UI already routes them to the "team will reach out" flow rather than this button).
  const tier = normalizeTier(formData.get('tier'));
  if (!isSelfServe(tier)) return { error: 'salesAssisted' };
  // Resolve the offer ONCE, here, and carry it through checkout. Reading the clock again later could
  // straddle the window boundary and charge a member a price they were not shown.
  const offer = currentOffer(new Date());
  const priceId = priceForTier(tier, offer);
  if (!priceId) return { error: 'notConfigured' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'noEmail' };

  // Capture consent first (so even an abandoned checkout has the agreement on record). Two rows:
  // the general billing consent, and a DISTINCT auto-renewal-disclosure acknowledgement for a clean
  // audit trail (ROSCA + California ARL: proof the user saw the auto-renew terms before the charge).
  // consent_captures.consent_type has no CHECK, so the new type needs no migration.
  const { ip, ua } = await clientMeta();
  const svc = createServiceClient();
  const { error: consentErr } = await svc.from('consent_captures').insert([
    {
      company_id: ctx.companyId,
      user_id: ctx.userId,
      consent_type: 'billing',
      consent_version: CONSENT_VERSION,
      accepted: true,
      ip_address: ip,
      user_agent: ua,
    },
    {
      company_id: ctx.companyId,
      user_id: ctx.userId,
      consent_type: 'auto_renewal_disclosure',
      consent_version: CONSENT_VERSION,
      accepted: true,
      ip_address: ip,
      user_agent: ua,
    },
  ]);
  // ARL/ROSCA evidence rows. Never block checkout on a logging failure, but never lose it silently
  // either (the whole point of the rows is proving the disclosure happened).
  if (consentErr) console.error('startCheckoutAction consent capture:', consentErr.message);

  // Reuse an existing customer id if we have one.
  const existing = await getSubscriptionForProfile(ctx.userId);

  // NEVER sell a second subscription to someone who already holds one.
  //
  // This block is the fix for a real, reachable double-billing path. A member whose card declined is
  // past_due, isEntitled stops granting, requireEntitled ejects her from the app to /checkout, and
  // this action ran happily: it read her existing subscription ONLY for the customer id and created
  // a whole new subscription against the same Stripe customer. She would then be dunned on the old
  // one and charged on the new one, and the bug reads to her as the app taking her money twice.
  //
  // past_due and unpaid are included on purpose. Those are exactly the states that route her here,
  // and the answer to both is the billing portal, not a second sale. `canceled` and `incomplete`
  // are deliberately absent: resubscribing after a cancellation is the flow working as intended.
  if (existing && LIVE_SUBSCRIPTION_STATUSES.includes(existing.status)) {
    return { error: 'alreadySubscribed', existingStatus: existing.status };
  }

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const created = await createCustomer({
      email: user.email,
      profileId: ctx.userId,
      companyId: ctx.companyId,
    });
    if (!created.ok) return { error: 'stripeError' };
    customerId = created.data.id;
  }

  const base = await origin();
  const session = await createCheckoutSession({
    customerId,
    priceId,
    // {CHECKOUT_SESSION_ID} is Stripe's template var: it lets the return page reconcile the
    // subscription server-side when the member lands BEFORE the webhook (the launch-day race).
    successUrl: `${base}/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/account/billing?checkout=cancelled`,
    profileId: ctx.userId,
    companyId: ctx.companyId,
    trialDays: trialDays(),
    // Stamps the grandfathering record onto the subscription, so the webhook records a founding
    // member as founding even if it lands after the window has shut.
    productKey: productKeyForOffer(offer),
  });
  if (!session.ok || !session.data.url) return { error: 'stripeError' };
  return { ok: true, checkoutUrl: session.data.url };
}

const CancelInput = z.object({
  reasonCode: z
    .enum(['too_expensive', 'not_using', 'missing_feature', 'other'])
    .optional()
    .or(z.literal('')),
  reasonText: z.string().max(1000).optional(),
});

/** One-tap cancel: schedule at period end, then store the optional reason. */
export async function cancelSubscriptionAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requireAuth();
  if (!ctx.companyId) return { error: 'noCompany' };

  const sub = await getSubscriptionForProfile(ctx.userId);
  if (!sub?.stripe_subscription_id) return { error: 'noSubscription' };

  if (isStripeConfigured()) {
    const res = await cancelAtPeriodEnd(sub.stripe_subscription_id);
    if (!res.ok) return { error: 'stripeError' };
  }

  // Reflect intent locally even before the webhook lands.
  const svc = createServiceClient();
  await svc
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  const parsed = CancelInput.safeParse({
    reasonCode: formData.get('reasonCode') ?? '',
    reasonText: String(formData.get('reasonText') ?? '').trim() || undefined,
  });
  if (parsed.success && (parsed.data.reasonCode || parsed.data.reasonText)) {
    // RLS insert via the user session client (policy: profile_id = auth.uid()).
    const supabase = await createClient();
    const { error: reasonErr } = await supabase.from('cancellation_reasons').insert({
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      subscription_id: sub.id,
      reason_code: parsed.data.reasonCode || null,
      reason_text: parsed.data.reasonText ?? null,
    });
    // Churn-evidence row: never block the cancel on it, never lose it silently.
    if (reasonErr) console.error('cancelSubscriptionAction reason:', reasonErr.message);
  }

  revalidatePath('/account/billing');
  return { ok: true };
}

/** Reactivate a subscription scheduled to cancel. */
export async function reactivateSubscriptionAction(
  _prev: BillingState,
  _formData: FormData,
): Promise<BillingState> {
  const ctx = await requireAuth();
  const sub = await getSubscriptionForProfile(ctx.userId);
  if (!sub?.stripe_subscription_id) return { error: 'noSubscription' };

  if (isStripeConfigured()) {
    const res = await reactivate(sub.stripe_subscription_id);
    if (!res.ok) return { error: 'stripeError' };
  }

  const svc = createServiceClient();
  await svc
    .from('subscriptions')
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('id', sub.id);

  revalidatePath('/account/billing');
  return { ok: true };
}
