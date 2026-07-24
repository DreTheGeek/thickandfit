// Billing data access. Reads run on the service client (server-side, already auth-gated by the
// caller) so the /account/billing RSC always gets a consistent view. Webhook upserts also live
// here so the route handler stays thin.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create';
import { convertLead } from '@/lib/funnel/service';

type ServiceClient = ReturnType<typeof createServiceClient>;

// Minimal currency formatter (no shared util exists). Cents -> localized money string.
function formatCents(cents: number | null | undefined, currency = 'usd'): string {
  const v = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

async function memberLocale(svc: ServiceClient, profileId: string): Promise<'en' | 'es'> {
  const { data } = await svc.from('profiles').select('ui_locale').eq('id', profileId).maybeSingle();
  return (data as { ui_locale?: string | null } | null)?.ui_locale === 'es' ? 'es' : 'en';
}

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

/** The subscriber's subscription row: an ACTIVE one if any exists, else the most recent. A customer
 *  can hold a history of rows (cancel -> resubscribe keeps the old row per 0085), so "newest" alone
 *  could surface an abandoned 'incomplete' row over a live one. */
export async function getSubscriptionForProfile(
  profileId: string,
): Promise<SubscriptionRow | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('subscriptions')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as SubscriptionRow[];
  return rows.find((r) => isActiveStatus(r.status)) ?? rows[0] ?? null;
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

  // Reflect the app subscription back onto the CRM contact so nurture targets correctly: without this
  // the ghl-sync mirror (GHL->Supabase, one-way) would keep a paying member marked as a lead/lost and
  // drip "join" offers at them. Best-effort: a CRM miss never fails the money webhook. No-op if the
  // member has no contact row yet.
  const crmStage = crmStageForSubStatus(sub.status);
  if (crmStage) {
    const { error: crmErr } = await svc
      .from('contacts')
      .update({ lifecycle_stage: crmStage })
      .eq('company_id', resolvedCompany)
      .eq('profile_id', resolvedProfile);
    if (crmErr) console.error('upsertSubscriptionFromStripe CRM sync:', crmErr.message);
  }

  // Post-conversion suppression (kb-funnels doctrine 0): once this member has a paying
  // subscription, they must exit the pre-launch drip immediately. If a buyer receives the "doors
  // close in 24h" email tomorrow it's the highest-severity brand-damage event the launch can ship.
  // convertLead is idempotent (only writes when converted_at is null) so re-firing on subsequent
  // subscription events (updates, cancels) is safe. Best-effort: a suppression miss must never fail
  // a money webhook — that would fail the retry loop for the actual entitlement grant.
  if (sub.status === 'active' || sub.status === 'trialing') {
    try {
      const { data: prof } = await svc.from('profiles').select('email').eq('id', resolvedProfile).maybeSingle();
      const email = (prof as { email?: string | null } | null)?.email;
      if (email) await convertLead(email);
    } catch (e) {
      console.error('upsertSubscriptionFromStripe convertLead:', e instanceof Error ? e.message : e);
    }
  }
}

// Map a Stripe subscription status onto the CRM lifecycle_stage. Returns null for statuses we do not
// want to overwrite the CRM with (e.g. 'incomplete' - a checkout not yet finished).
function crmStageForSubStatus(status: string): string | null {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'canceled';
  return null;
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

  const { error: payErr } = await svc.from('payments').upsert(
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
  // THROW on failure (never-drop-a-money-event rule): the webhook marks the ledger row failed
  // (reclaimable) and Stripe's retry re-runs this idempotent upsert. Silently discarding the error
  // is exactly how the partial-index bug lost every payment row without a trace.
  if (payErr) throw new Error(`recordInvoicePayment: ${payErr.message}`);

  // Dunning: a failed charge means the member's card was declined. `past_due` still grants access
  // during Stripe's retry window, so without this notice the member churns silently. Billing-category
  // notices always deliver (cannot be muted). Best-effort: a notify failure never fails the webhook.
  if (outcome === 'failed' && profileId) {
    try {
      const locale = await memberLocale(svc, profileId);
      const amount = formatCents(invoice.amount_due, invoice.currency);
      const copy =
        locale === 'es'
          ? {
              title: 'Pago rechazado',
              body: `No pudimos procesar tu pago de ${amount}. Actualiza tu tarjeta para mantener tu acceso.`,
            }
          : {
              title: 'Payment failed',
              body: `We couldn't process your ${amount} payment. Update your card to keep your access.`,
            };
      await createNotification(companyId, profileId, {
        type: 'renewal',
        title: copy.title,
        body: copy.body,
        link: '/account/billing',
      });
    } catch (e) {
      console.error('recordInvoicePayment dunning notice:', e instanceof Error ? e.message : e);
    }
  }
}

/** Webhook-race reconciliation: the member lands on /account/billing?checkout=success BEFORE the
 *  webhook has delivered customer.subscription.created. Pull the Checkout Session by id, then the
 *  subscription object, and run the same idempotent upsert the webhook runs. Safe with a foreign or
 *  junk session id: the upsert keys tenant off the subscription's OWN metadata (set at creation), so
 *  the worst case is a no-op or upserting a row the webhook would have written anyway. */
export async function reconcileCheckoutSession(sessionId: string): Promise<boolean> {
  const { getCheckoutSession, getSubscriptionObject } = await import('@/lib/billing/stripe');
  const session = await getCheckoutSession(sessionId);
  if (!session.ok || !session.data.subscription) return false;
  const sub = await getSubscriptionObject(session.data.subscription);
  if (!sub.ok) return false;
  const obj = sub.data as unknown as StripeSubscriptionObject;
  if (typeof obj.id !== 'string' || typeof obj.customer !== 'string') return false;
  try {
    await upsertSubscriptionFromStripe(obj);
    return true;
  } catch (e) {
    // The webhook remains the source of truth; reconciliation is best-effort.
    console.error('reconcileCheckoutSession:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** A trial is about to end and the card will be charged. Sends the pre-renewal notice the /about page
 *  promises. For a trial shorter than 3 days Stripe fires this at trial creation, which still gives the
 *  member advance notice. Best-effort; a notify failure never fails the webhook. */
export async function notifyTrialWillEnd(sub: StripeSubscriptionObject): Promise<void> {
  const svc = createServiceClient();
  let profileId = sub.metadata?.profile_id ?? null;
  let companyId = sub.metadata?.company_id ?? null;
  if (!profileId || !companyId) {
    const { data: existing } = await svc
      .from('subscriptions')
      .select('profile_id, company_id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();
    profileId = profileId ?? existing?.profile_id ?? null;
    companyId = companyId ?? existing?.company_id ?? null;
  }
  if (!profileId || !companyId) {
    console.error(`notifyTrialWillEnd: unresolved tenant for subscription ${sub.id}`);
    return;
  }
  const price = sub.items?.data?.[0]?.price;
  const amount = formatCents(price?.unit_amount, price?.currency);
  const locale = await memberLocale(svc, profileId);
  const copy =
    locale === 'es'
      ? {
          title: 'Tu prueba gratis termina pronto',
          body: `Cuando termine tu prueba, tu tarjeta se cobrará ${amount}. Puedes cancelar en cualquier momento antes de esa fecha.`,
        }
      : {
          title: 'Your free trial ends soon',
          body: `When your trial ends, your card will be charged ${amount}. You can cancel anytime before then.`,
        };
  await createNotification(companyId, profileId, {
    type: 'renewal',
    title: copy.title,
    body: copy.body,
    link: '/account/billing',
  });
}

type StripeDisputeObject = {
  id: string;
  charge?: string | null;
  amount?: number | null;
  currency?: string;
  reason?: string | null;
  status?: string | null;
};

/** A chargeback was opened. Flag the payment row and alert every operator so they can submit evidence
 *  before Stripe's response deadline (anti-chargeback pillar). Full evidence-packet assembly is a
 *  separate follow-up; this closes the silent-auto-loss gap by making a dispute visible immediately. */
export async function recordDispute(dispute: StripeDisputeObject): Promise<void> {
  const svc = createServiceClient();

  let companyId: string | null = null;
  if (dispute.charge) {
    const { data: payment } = await svc
      .from('payments')
      .select('id, company_id')
      .eq('stripe_charge_id', dispute.charge)
      .maybeSingle();
    const row = payment as { id: string; company_id: string } | null;
    if (row) {
      companyId = row.company_id;
      await svc
        .from('payments')
        .update({ status: 'disputed', failure_reason: dispute.reason ?? 'dispute' })
        .eq('id', row.id);
    }
  }
  if (!companyId) {
    console.error(`recordDispute: no matching payment for charge ${dispute.charge ?? 'none'}`);
    return;
  }

  const { data: operators } = await svc
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'operator');
  const amount = formatCents(dispute.amount, dispute.currency);
  for (const op of (operators ?? []) as Array<{ id: string }>) {
    await createNotification(companyId, op.id, {
      type: 'system',
      title: 'Chargeback opened',
      body: `A ${amount} payment was disputed (reason: ${dispute.reason ?? 'unknown'}). Respond in Stripe before the evidence deadline.`,
      link: '/coach/billing',
    });
  }
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
