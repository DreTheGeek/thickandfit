// Lazy Stripe client. No SDK, no build-time crash without keys (mirrors the Resend pattern).
// Talks to the Stripe REST API over fetch and verifies webhook signatures with node:crypto.
// Every call returns a typed result and degrades gracefully when STRIPE_SECRET_KEY is unset.
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

export function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

/** True only when a live/test secret key is present. UI uses this to show a "not connected" state. */
export function isStripeConfigured(): boolean {
  return Boolean(stripeSecretKey());
}

type StripeResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

// Stripe form-encodes request bodies, including nested keys (a[b]=c, a[]=b). Flatten accordingly.
function encodeForm(obj: Record<string, unknown>, prefix = ''): string[] {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          pairs.push(...encodeForm(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          pairs.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === 'object') {
      pairs.push(...encodeForm(value as Record<string, unknown>, fullKey));
    } else {
      pairs.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs;
}

async function stripeRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<StripeResult<T>> {
  const key = stripeSecretKey();
  if (!key) return { ok: false, error: 'Stripe is not configured', status: 503 };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let url = `${STRIPE_API}${path}`;
  let payload: string | undefined;
  if (body && method === 'GET') {
    const qs = encodeForm(body).join('&');
    if (qs) url += `?${qs}`;
  } else if (body) {
    payload = encodeForm(body).join('&');
  }

  try {
    const res = await fetch(url, { method, headers, body: payload });
    const json = (await res.json()) as unknown;
    if (!res.ok) {
      const message =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: { message?: string } }).error?.message ?? 'Stripe error')
          : 'Stripe error';
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error', status: 502 };
  }
}

// --- Customers --------------------------------------------------------------
export type StripeCustomer = { id: string };

export async function createCustomer(args: {
  email: string;
  name?: string;
  profileId: string;
  companyId: string;
}): Promise<StripeResult<StripeCustomer>> {
  return stripeRequest<StripeCustomer>(
    'POST',
    '/customers',
    {
      email: args.email,
      name: args.name,
      metadata: { profile_id: args.profileId, company_id: args.companyId },
    },
    // Idempotent per profile: a retry or double-submit reuses the same customer instead of creating
    // duplicates (which would fragment billing history across two Stripe customers).
    `customer:${args.profileId}`,
  );
}

// --- Checkout Session -------------------------------------------------------
export type StripeCheckoutSession = { id: string; url: string | null };

export async function createCheckoutSession(args: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  profileId: string;
  companyId: string;
  /** Optional free-trial length in days; omitted/0 means charge immediately. */
  trialDays?: number;
}): Promise<StripeResult<StripeCheckoutSession>> {
  const trial = args.trialDays && args.trialDays > 0 ? Math.floor(args.trialDays) : undefined;
  // Idempotent per (profile, price) within an hour bucket: a double-submit reuses the same Checkout
  // session instead of spawning duplicates; a genuine later retry (new hour / switched tier) mints a
  // fresh one. Date.now() is fine here (ordinary request path, not a resumable workflow).
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  return stripeRequest<StripeCheckoutSession>(
    'POST',
    '/checkout/sessions',
    {
      mode: 'subscription',
      customer: args.customerId,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      line_items: [{ price: args.priceId, quantity: 1 }],
      // 3D Secure forced wherever the card supports it (anti-chargeback pillar: "3DS on all payments").
      // Shifts fraud liability to the issuer on authenticated payments, at a small conversion cost.
      payment_method_options: { card: { request_three_d_secure: 'any' } },
      subscription_data: {
        // encodeForm drops undefined, so no trial key is sent when trial is unset.
        trial_period_days: trial,
        metadata: { profile_id: args.profileId, company_id: args.companyId },
      },
      metadata: { profile_id: args.profileId, company_id: args.companyId },
    },
    `checkout:${args.profileId}:${args.priceId}:${hourBucket}`,
  );
}

// --- Checkout/session reads (webhook-race reconciliation) --------------------
export type StripeCheckoutSessionDetail = {
  id: string;
  status: string | null;
  subscription: string | null;
};

/** Read a Checkout Session (used when the member returns before the webhook lands). */
export async function getCheckoutSession(
  sessionId: string,
): Promise<StripeResult<StripeCheckoutSessionDetail>> {
  return stripeRequest<StripeCheckoutSessionDetail>('GET', `/checkout/sessions/${sessionId}`);
}

/** Read a full subscription object (same shape the webhook receives). */
export async function getSubscriptionObject(
  subscriptionId: string,
): Promise<StripeResult<Record<string, unknown>>> {
  return stripeRequest<Record<string, unknown>>('GET', `/subscriptions/${subscriptionId}`);
}

// --- Subscription mutations -------------------------------------------------
export type StripeSubscription = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
};

/** One-tap cancel: schedule cancellation at period end (no immediate loss of access). */
export async function cancelAtPeriodEnd(
  subscriptionId: string,
): Promise<StripeResult<StripeSubscription>> {
  return stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, {
    cancel_at_period_end: true,
  });
}

/** Reactivate a subscription that was scheduled to cancel. */
export async function reactivate(
  subscriptionId: string,
): Promise<StripeResult<StripeSubscription>> {
  return stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, {
    cancel_at_period_end: false,
  });
}

/** Cancel a subscription IMMEDIATELY (used on account deletion so a deleted user is never billed). */
export async function cancelSubscriptionNow(
  subscriptionId: string,
): Promise<StripeResult<StripeSubscription>> {
  return stripeRequest<StripeSubscription>('DELETE', `/subscriptions/${subscriptionId}`);
}

// --- Webhook signature verification (no SDK) --------------------------------
// Implements Stripe's scheme: header `t=timestamp,v1=signature`; signed payload is
// `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook signing secret.
export function verifyWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  const { rawBody, signatureHeader, secret } = args;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, kv) => {
    const [k, v] = kv.split('=');
    if (!k || !v) return acc;
    (acc[k] ??= []).push(v);
    return acc;
  }, {});

  const timestamp = parts['t']?.[0];
  const signatures = parts['v1'] ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const tolerance = args.toleranceSeconds ?? 300;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > tolerance) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected);
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}
