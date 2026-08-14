// POST /api/billing/portal: hand the member a Stripe-hosted session where she can replace her card.
//
// THE GAP THIS CLOSES. There was no way to fix a declined card anywhere in this app. Stephanie asked
// for it in as many words on 2026-08-13 ("if their card is declined, send them an actual link, hey
// update your card"), and the chain without it was worse than a missing button: a past_due member is
// ejected from every app page by requireEntitled, landed on /checkout, and offered a SECOND
// subscription that startCheckoutAction would have created.
//
// requireAuth, NOT requireEntitled. A member who can pay is by definition one the paywall is already
// rejecting; gating this endpoint on entitlement would lock the fix behind the failure it fixes.
//
// Deliberately not under src/app/api/stripe/ — that prefix is reserved for the webhook surface, which
// authenticates by signature rather than by session and must not grow session-authed siblings.
import { resolveAuth } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiError } from '@/lib/api/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { isStripeConfigured, createBillingPortalSession } from '@/lib/billing/stripe';
import { getSubscriptionForProfile } from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POST_h(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!isStripeConfigured()) return apiError('Billing is not configured.', 503);

  // failClosed, matching startCheckoutAction: this mints a Stripe object, so a broken limiter must
  // deny rather than wave through. 10/hour is far above any honest retry.
  if (!(await checkRateLimit(ctx.userId, 'billing-portal', 10, 3600, { failClosed: true }))) {
    return apiError('Too many attempts. Please wait a moment.', 429);
  }

  const sub = await getSubscriptionForProfile(ctx.userId);
  const customerId = sub?.stripe_customer_id ?? null;
  // No customer means she has never reached Stripe, so there is no card to update and no portal to
  // open. Checkout is her screen, and saying so beats a 500 or an empty portal.
  if (!customerId) return apiError('No billing account yet.', 409);

  const origin = new URL(req.url).origin;
  const session = await createBillingPortalSession({
    customerId,
    returnUrl: `${origin}/account/billing`,
  });
  if (!session.ok || !session.data.url) return apiError('Could not open the billing portal.', 502);

  return Response.json({ ok: true, url: session.data.url });
}

export const POST = withApiLog(POST_h);
