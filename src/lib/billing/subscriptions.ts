// Billing data access. Reads run on the service client (server-side, already auth-gated by the
// caller) so the /account/billing RSC always gets a consistent view. Webhook upserts also live
// here so the route handler stays thin.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type SubscriptionRow = {
  id: string;
  company_id: string;
  profile_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  price_cents: number;
  currency: string;
  card_brand: string | null;
  card_last4: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
};

export type PaymentRow = {
  id: string;
  amount_cents: number;
  amount_refunded_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
};

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

export function isActiveStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.includes(status));
}

/** The subscriber's most recent subscription row (active preferred), or null if none. */
export async function getSubscriptionForProfile(
  profileId: string,
): Promise<SubscriptionRow | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('subscriptions')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

export async function getPaymentsForProfile(
  profileId: string,
  limit = 12,
): Promise<PaymentRow[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('payments')
    .select('id, amount_cents, amount_refunded_cents, currency, status, description, paid_at, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as PaymentRow[] | null) ?? [];
}

// --- Webhook-side upserts (service client) ----------------------------------
type StripeSubscriptionObject = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  canceled_at?: number | null;
  trial_end?: number | null;
  metadata?: Record<string, string>;
  items?: { data: Array<{ price?: { id: string; unit_amount?: number | null; currency?: string } }> };
};

function epochToIso(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

/** Upsert a subscription row from a Stripe subscription object. Idempotent on stripe_subscription_id. */
export async function upsertSubscriptionFromStripe(sub: StripeSubscriptionObject): Promise<void> {
  const svc = createServiceClient();
  const profileId = sub.metadata?.profile_id ?? null;
  const companyId = sub.metadata?.company_id ?? null;
  const price = sub.items?.data?.[0]?.price;

  // We need a company/profile to satisfy NOT NULL. If the event lacks metadata, fall back to an
  // existing row's identity (a later event on the same subscription).
  let resolvedProfile = profileId;
  let resolvedCompany = companyId;
  if (!resolvedProfile || !resolvedCompany) {
    const { data: existing } = await svc
      .from('subscriptions')
      .select('profile_id, company_id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();
    resolvedProfile = resolvedProfile ?? existing?.profile_id ?? null;
    resolvedCompany = resolvedCompany ?? existing?.company_id ?? null;
  }
  if (!resolvedProfile || !resolvedCompany) {
    // Never drop a money event silently (global rule): a charged-but-not-granted user must be catchable.
    console.error(
      `upsertSubscriptionFromStripe: unresolved tenant for subscription ${sub.id} (no metadata + no existing row); grant NOT applied`,
    );
    return;
  }

  const { error } = await svc.from('subscriptions').upsert(
    {
      company_id: resolvedCompany,
      profile_id: resolvedProfile,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      stripe_price_id: price?.id ?? null,
      status: sub.status,
      price_cents: price?.unit_amount ?? 0,
      currency: price?.currency ?? 'usd',
      current_period_end: epochToIso(sub.current_period_end),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: epochToIso(sub.canceled_at),
      trial_end: epochToIso(sub.trial_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );
  // THROW on failure: the webhook's catch marks the ledger row failed (reclaimable), so Stripe's
  // retry re-runs this idempotent upsert. Swallowing left a charged user without their entitlement.
  if (error) throw new Error(`upsertSubscriptionFromStripe: ${error.message}`);
}

type StripeInvoiceObject = {
  id: string;
  charge?: string | null;
  payment_intent?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string;
  subscription?: string | null;
  customer?: string | null;
  status_transitions?: { paid_at?: number | null };
  lines?: { data: Array<{ description?: string }> };
};

/** Record a payment outcome from an invoice event. Idempotent on stripe_invoice_id. */
export async function recordInvoicePayment(
  invoice: StripeInvoiceObject,
  outcome: 'succeeded' | 'failed',
): Promise<void> {
  const svc = createServiceClient();

  // Link to our subscription + profile via the stripe subscription id when present.
  let subscriptionRowId: string | null = null;
  let profileId: string | null = null;
  let companyId: string | null = null;
  if (invoice.subscription) {
    const { data: sub } = await svc
      .from('subscriptions')
      .select('id, profile_id, company_id')
      .eq('stripe_subscription_id', invoice.subscription)
      .maybeSingle();
    subscriptionRowId = sub?.id ?? null;
    profileId = sub?.profile_id ?? null;
    companyId = sub?.company_id ?? null;
  }
  if (!companyId && invoice.customer) {
    // Fallback: the first invoice.payment_succeeded can race AHEAD of customer.subscription.created,
    // so the subscription row may not exist yet. Resolve the tenant via the Stripe customer instead.
    const { data: byCustomer } = await svc
      .from('subscriptions')
      .select('id, profile_id, company_id')
      .eq('stripe_customer_id', invoice.customer)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    subscriptionRowId = byCustomer?.id ?? subscriptionRowId;
    profileId = byCustomer?.profile_id ?? profileId;
    companyId = byCustomer?.company_id ?? null;
  }
  if (!companyId) {
    // Never drop a money event silently: THROW so the webhook marks the ledger row failed
    // (reclaimable) and Stripe's retry re-runs once the subscription row exists. The old clean
    // return marked the event processed and the first payment vanished from the payments history.
    throw new Error(
      `recordInvoicePayment: unresolved tenant for invoice ${invoice.id} (subscription ${invoice.subscription ?? 'none'} not found yet)`,
    );
  }

  await svc.from('payments').upsert(
    {
      company_id: companyId,
      profile_id: profileId,
      subscription_id: subscriptionRowId,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge ?? null,
      stripe_payment_intent_id: invoice.payment_intent ?? null,
      amount_cents: (outcome === 'succeeded' ? invoice.amount_paid : invoice.amount_due) ?? 0,
      currency: invoice.currency ?? 'usd',
      status: outcome,
      description: invoice.lines?.data?.[0]?.description ?? null,
      paid_at: outcome === 'succeeded' ? epochToIso(invoice.status_transitions?.paid_at) : null,
    },
    { onConflict: 'stripe_invoice_id' },
  );
}

type StripeChargeObject = {
  id: string;
  amount_refunded?: number | null;
  amount?: number | null;
  invoice?: string | null;
};

/** Apply a refund to the matching payment row (by charge id, else by invoice id). */
export async function recordRefund(charge: StripeChargeObject): Promise<void> {
  const svc = createServiceClient();
  const refunded = charge.amount_refunded ?? 0;
  const total = charge.amount ?? 0;
  const status = refunded >= total && total > 0 ? 'refunded' : 'partially_refunded';

  // Try charge id first, then invoice id.
  const { data: byCharge } = await svc
    .from('payments')
    .select('id')
    .eq('stripe_charge_id', charge.id)
    .maybeSingle();
  let targetId = byCharge?.id ?? null;
  if (!targetId && charge.invoice) {
    const { data: byInvoice } = await svc
      .from('payments')
      .select('id')
      .eq('stripe_invoice_id', charge.invoice)
      .maybeSingle();
    targetId = byInvoice?.id ?? null;
  }
  if (!targetId) return;

  await svc
    .from('payments')
    .update({ amount_refunded_cents: refunded, status })
    .eq('id', targetId);
}
