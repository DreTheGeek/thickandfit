// One-command Stripe go-live setup. Idempotent: safe to run repeatedly.
//
// Given STRIPE_SECRET_KEY in the environment, this:
//   1. creates (or reuses) the "Thick & Fit Self-Guided" product,
//   2. creates (or reuses) the $19.97/month recurring price,
//   3. registers (or reuses) the webhook endpoint at the prod URL with the exact 7 events the
//      handler processes,
//   4. writes STRIPE_PRICE_SELF, STRIPE_WEBHOOK_SECRET and STRIPE_TRIAL_DAYS back into .env.local,
//   5. prints a summary (secrets masked).
//
// The ONLY human input is the secret key itself, which by Stripe's design can only be retrieved
// from the dashboard once. Everything downstream is automated here.
//
// Usage:  node --env-file=.env.local scripts/stripe-setup.mjs
// Test vs live is inferred from the key prefix (sk_test_ vs sk_live_).
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_URL =
  process.env.STRIPE_WEBHOOK_URL || 'https://www.teamthickandfit.com/api/stripe/webhook';
// No free trial by decision (2026-07-23 launch call): "cancel anytime, no contract" instead.
const TRIAL_DAYS = process.env.STRIPE_TRIAL_DAYS ?? '0';
const PRICE_CENTS = 1997;
const PRODUCT_NAME = 'Thick & Fit Self-Guided';
const PRODUCT_TAG = 'thickandfit:self-guided'; // stable metadata key for idempotent lookup
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

if (!KEY) {
  console.error(
    '\nSTRIPE_SECRET_KEY is not set.\n' +
      'Paste your Stripe secret key into .env.local as a single line, then re-run:\n' +
      '  STRIPE_SECRET_KEY=sk_test_...\n' +
      '(use a sk_test_ key first so we verify safely before going live).\n',
  );
  process.exit(1);
}
const MODE = KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';

const form = (obj) => {
  // Stripe wants form-encoding with bracket notation for nested keys and arrays.
  const parts = [];
  const walk = (prefix, value) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    else if (value && typeof value === 'object')
      Object.entries(value).forEach(([k, v]) => walk(`${prefix}[${k}]`, v));
    else parts.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
  };
  Object.entries(obj).forEach(([k, v]) => walk(k, v));
  return parts.join('&');
};

async function stripe(method, endpoint, body) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${endpoint}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

async function main() {
  console.log(`\nStripe setup running in ${MODE} mode.\n`);

  // 1. Product (idempotent by metadata tag).
  const products = await stripe('GET', '/products?active=true&limit=100');
  let product = products.data.find((p) => p.metadata?.tag === PRODUCT_TAG);
  if (product) {
    console.log(`product: reused ${product.id}`);
  } else {
    product = await stripe('POST', '/products', {
      name: PRODUCT_NAME,
      metadata: { tag: PRODUCT_TAG },
    });
    console.log(`product: created ${product.id}`);
  }

  // 2. Price (idempotent: an active $19.97/mo recurring price on this product).
  const prices = await stripe('GET', `/prices?product=${product.id}&active=true&limit=100`);
  let price = prices.data.find(
    (pr) =>
      pr.unit_amount === PRICE_CENTS &&
      pr.currency === 'usd' &&
      pr.recurring?.interval === 'month',
  );
  if (price) {
    console.log(`price: reused ${price.id}`);
  } else {
    price = await stripe('POST', '/prices', {
      product: product.id,
      unit_amount: PRICE_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { tag: PRODUCT_TAG },
    });
    console.log(`price: created ${price.id} ($19.97/mo)`);
  }

  // 3. Webhook endpoint (idempotent by URL). The signing secret is only returned at CREATE time,
  //    so if one already exists we cannot re-read it; the script reports that and leaves the
  //    existing STRIPE_WEBHOOK_SECRET in place.
  const hooks = await stripe('GET', '/webhook_endpoints?limit=100');
  let hook = hooks.data.find((h) => h.url === WEBHOOK_URL);
  let webhookSecret = null;
  if (hook) {
    // Make sure it subscribes to exactly the events the handler needs.
    await stripe('POST', `/webhook_endpoints/${hook.id}`, { enabled_events: EVENTS });
    console.log(`webhook: reused ${hook.id} (events synced; secret unchanged)`);
  } else {
    hook = await stripe('POST', '/webhook_endpoints', {
      url: WEBHOOK_URL,
      enabled_events: EVENTS,
    });
    webhookSecret = hook.secret;
    console.log(`webhook: created ${hook.id} -> ${WEBHOOK_URL}`);
  }

  // 4. Write back to .env.local, updating in place.
  const envPath = path.join(process.cwd(), '.env.local');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const setVar = (name, value) => {
    if (value == null) return;
    const line = `${name}=${value}`;
    const re = new RegExp(`^${name}=.*$`, 'm');
    env = re.test(env) ? env.replace(re, line) : env.replace(/\n?$/, `\n${line}\n`);
  };
  setVar('STRIPE_PRICE_SELF', price.id);
  setVar('STRIPE_TRIAL_DAYS', TRIAL_DAYS);
  if (webhookSecret) setVar('STRIPE_WEBHOOK_SECRET', webhookSecret);
  fs.writeFileSync(envPath, env);

  console.log('\n.env.local updated:');
  console.log(`  STRIPE_PRICE_SELF=${price.id}`);
  console.log(`  STRIPE_TRIAL_DAYS=${TRIAL_DAYS}`);
  console.log(
    `  STRIPE_WEBHOOK_SECRET=${webhookSecret ? webhookSecret.slice(0, 8) + '... (new)' : '(unchanged; existing endpoint)'}`,
  );

  // 5. Machine-readable summary for the caller (no secrets).
  fs.writeFileSync(
    path.join(process.cwd(), '.stripe-setup.json'),
    JSON.stringify(
      { mode: MODE, productId: product.id, priceId: price.id, webhookId: hook.id, webhookUrl: WEBHOOK_URL, events: EVENTS, trialDays: Number(TRIAL_DAYS), webhookSecretWritten: Boolean(webhookSecret) },
      null,
      2,
    ),
  );
  console.log('\nSummary written to .stripe-setup.json');
  console.log(MODE === 'TEST' ? '\nTEST mode: safe to verify a full checkout next.' : '\nLIVE mode: real charges are now possible.');
}

main().catch((e) => {
  console.error('\nsetup failed:', e.message);
  process.exit(1);
});
