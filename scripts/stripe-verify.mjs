// Deterministic end-to-end verification of the Stripe path. No Stripe CLI, no live delivery needed.
//
// It proves four things:
//   1. the price is exactly $19.97/month recurring and active (Stripe API read-back),
//   2. the webhook endpoint subscribes to all required events and is enabled,
//   3. a Checkout Session can be created with the real key + price (the member-facing "start to pay"),
//   4. the webhook -> DB -> entitlement path works: it signs a synthetic subscription.created event
//      the exact way Stripe does (HMAC over "t.payload") and posts it to the running app's webhook,
//      then confirms the subscriptions row lands and the member is entitled. The test row is deleted
//      after.
//
// Usage:  node --env-file=.env.local scripts/stripe-verify.mjs
import crypto from 'node:crypto';

const KEY = process.env.STRIPE_SECRET_KEY;
const PRICE = process.env.STRIPE_PRICE_SELF;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.VERIFY_APP_URL ?? 'http://127.0.0.1:3000';
const EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
];

function fail(msg) {
  console.error('  FAIL:', msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('  ok:', msg);
}

async function stripe(method, endpoint, body) {
  const enc = body
    ? Object.entries(body)
        .flatMap(([k, v]) =>
          typeof v === 'object'
            ? Object.entries(v).map(([k2, v2]) => `${k}[${k2}]=${encodeURIComponent(v2)}`)
            : [`${k}=${encodeURIComponent(v)}`],
        )
        .join('&')
    : undefined;
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: enc,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message ?? res.status);
  return j;
}
const rest = (p, opts = {}) =>
  fetch(`${SB}/rest/v1/${p}`, {
    ...opts,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });

async function main() {
  if (!KEY || !PRICE) {
    fail('STRIPE_SECRET_KEY or STRIPE_PRICE_SELF missing. Run stripe-setup.mjs first.');
    return;
  }
  const MODE = KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`\nVerifying Stripe path in ${MODE} mode.\n`);

  console.log('1. price');
  const price = await stripe('GET', `/prices/${PRICE}`);
  price.unit_amount === 1997 ? ok('unit_amount 1997') : fail(`unit_amount ${price.unit_amount}, expected 1997`);
  price.currency === 'usd' ? ok('currency usd') : fail(`currency ${price.currency}`);
  price.recurring?.interval === 'month' ? ok('recurring monthly') : fail('not monthly recurring');
  price.active ? ok('active') : fail('price inactive');

  console.log('2. webhook');
  const hooks = await stripe('GET', '/webhook_endpoints?limit=100');
  const hook = hooks.data.find((h) => h.url.endsWith('/api/stripe/webhook'));
  if (!hook) fail('no webhook endpoint registered at /api/stripe/webhook');
  else {
    hook.status === 'enabled' ? ok('enabled') : fail(`status ${hook.status}`);
    const missing = EVENTS.filter((e) => !hook.enabled_events.includes(e) && !hook.enabled_events.includes('*'));
    missing.length === 0 ? ok(`all ${EVENTS.length} events subscribed`) : fail(`missing events: ${missing.join(', ')}`);
  }

  console.log('3. checkout session creation');
  const cust = await stripe('POST', '/customers', { name: 'verify-temp' });
  try {
    const sess = await stripe('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer: cust.id,
      success_url: `${APP}/account/billing?checkout=success`,
      cancel_url: `${APP}/account/billing?checkout=cancelled`,
      'line_items[0][price]': PRICE,
      'line_items[0][quantity]': 1,
    });
    sess.url?.includes('checkout.stripe.com') ? ok('checkout URL minted') : fail('no checkout URL');
  } finally {
    await stripe('POST', `/customers/${cust.id}`, {}).catch(() => {});
  }

  console.log('4. webhook -> DB -> entitlement');
  if (!WHSEC) {
    fail('STRIPE_WEBHOOK_SECRET not set locally (existing endpoint); cannot sign a test event. Skipping.');
    return;
  }
  // A test member to attribute the synthetic subscription to.
  const prof = await (await rest('profiles?email=eq.sample.sam%40thickandfit.test&select=id,company_id')).json();
  const profileId = prof[0]?.id;
  const companyId = prof[0]?.company_id;
  if (!profileId) return fail('sample.sam profile not found');

  const subId = `sub_verify_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const eventBody = JSON.stringify({
    id: `evt_verify_${Date.now()}`,
    type: 'customer.subscription.created',
    data: {
      object: {
        id: subId,
        customer: `cus_verify_${Date.now()}`,
        status: 'trialing',
        cancel_at_period_end: false,
        current_period_end: now + 3 * 86400,
        trial_end: now + 3 * 86400,
        metadata: { profile_id: profileId, company_id: companyId },
        items: { data: [{ price: { id: PRICE, unit_amount: 1997, currency: 'usd' } }] },
      },
    },
  });
  // Stripe signature: t=<ts>,v1=<hmac_sha256(secret, "<ts>.<body>")>
  const ts = now;
  const sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${eventBody}`).digest('hex');
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` },
    body: eventBody,
  });
  res.status === 200 ? ok(`webhook accepted (200)`) : fail(`webhook returned ${res.status}: ${(await res.text()).slice(0, 120)}`);

  await new Promise((r) => setTimeout(r, 800));
  const rows = await (await rest(`subscriptions?stripe_subscription_id=eq.${subId}&select=status,profile_id`)).json();
  if (rows[0]) {
    ok(`subscription row created (status ${rows[0].status})`);
    ['active', 'trialing'].includes(rows[0].status) ? ok('status is entitling') : fail(`status ${rows[0].status} does not entitle`);
  } else {
    fail('no subscriptions row written by the webhook handler');
  }

  // cleanup
  await rest(`subscriptions?stripe_subscription_id=eq.${subId}`, { method: 'DELETE' });
  await rest(`webhook_events?stripe_event_id=like.evt_verify_*`, { method: 'DELETE' }).catch(() => {});
  console.log('  cleanup: test rows removed');

  console.log(process.exitCode ? '\nVERIFY FAILED. See failures above.' : '\nVERIFY PASSED. The payment path works end to end.');
}

main().catch((e) => {
  console.error('\nverify crashed:', e.message);
  process.exit(1);
});
