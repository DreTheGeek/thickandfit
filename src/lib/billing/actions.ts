'use server';
// Billing server actions: start checkout (writes a consent_captures row), one-tap cancel
// (cancel_at_period_end + optional reason), and reactivate. No dark patterns: cancel is a single
// confirm, reason is optional, and reactivate is always offered.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  isStripeConfigured,
  createCustomer,
  createCheckoutSession,
  cancelAtPeriodEnd,
  reactivate,
} from '@/lib/billing/stripe';
import { getSubscriptionForProfile } from '@/lib/billing/subscriptions';

export type BillingState = { error?: string; ok?: boolean; checkoutUrl?: string };

const CONSENT_VERSION = '2026-06';

async function origin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host') ?? 'app.teamthickandfit.com'}`;
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
  _formData: FormData,
): Promise<BillingState> {
  const ctx = await requireAuth();
  if (!ctx.companyId) return { error: 'noCompany' };
  if (!isStripeConfigured()) return { error: 'notConfigured' };

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return { error: 'notConfigured' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'noEmail' };

  // Capture consent first (so even an abandoned checkout has the agreement on record).
  const { ip, ua } = await clientMeta();
  const svc = createServiceClient();
  await svc.from('consent_captures').insert({
    company_id: ctx.companyId,
    user_id: ctx.userId,
    consent_type: 'billing',
    consent_version: CONSENT_VERSION,
    accepted: true,
    ip_address: ip,
    user_agent: ua,
  });

  // Reuse an existing customer id if we have one.
  const existing = await getSubscriptionForProfile(ctx.userId);
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
    successUrl: `${base}/account/billing?checkout=success`,
    cancelUrl: `${base}/account/billing?checkout=cancelled`,
    profileId: ctx.userId,
    companyId: ctx.companyId,
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
    await supabase.from('cancellation_reasons').insert({
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      subscription_id: sub.id,
      reason_code: parsed.data.reasonCode || null,
      reason_text: parsed.data.reasonText ?? null,
    });
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
