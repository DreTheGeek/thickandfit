// POST /api/stripe/webhook — Stripe event sink.
// Signature-verified (HMAC over the raw body), idempotent (UNIQUE event ledger), Zod-shaped.
// Handles: customer.subscription.updated/deleted, invoice.payment_succeeded/failed, charge.refunded.
// Without STRIPE_WEBHOOK_SECRET it returns 503 (never crashes the build, never processes unsigned).
import { z } from 'zod';
import { verifyWebhookSignature, stripeWebhookSecret } from '@/lib/billing/stripe';
import { claimEvent, markEventProcessed } from '@/lib/billing/webhook-events';
import {
  upsertSubscriptionFromStripe,
  recordInvoicePayment,
  recordRefund,
} from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe envelope. We only assert the fields we route on; the object itself is validated per-type.
const EventEnvelope = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

const SubscriptionObject = z.object({
  id: z.string(),
  customer: z.string(),
  status: z.string(),
  cancel_at_period_end: z.boolean(),
  current_period_end: z.number().nullable().optional(),
  canceled_at: z.number().nullable().optional(),
  trial_end: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  items: z
    .object({
      data: z.array(
        z.object({
          price: z
            .object({
              id: z.string(),
              unit_amount: z.number().nullable().optional(),
              currency: z.string().optional(),
            })
            .optional(),
        }),
      ),
    })
    .optional(),
});

const InvoiceObject = z.object({
  id: z.string(),
  charge: z.string().nullable().optional(),
  payment_intent: z.string().nullable().optional(),
  amount_paid: z.number().nullable().optional(),
  amount_due: z.number().nullable().optional(),
  currency: z.string().optional(),
  subscription: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  status_transitions: z.object({ paid_at: z.number().nullable().optional() }).optional(),
  lines: z.object({ data: z.array(z.object({ description: z.string().optional() })) }).optional(),
});

const ChargeObject = z.object({
  id: z.string(),
  amount: z.number().nullable().optional(),
  amount_refunded: z.number().nullable().optional(),
  invoice: z.string().nullable().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return Response.json({ ok: false, error: 'Stripe webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!verifyWebhookSignature({ rawBody, signatureHeader: signature, secret })) {
    return Response.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  let parsedEnvelope: z.infer<typeof EventEnvelope>;
  try {
    parsedEnvelope = EventEnvelope.parse(JSON.parse(rawBody));
  } catch {
    return Response.json({ ok: false, error: 'Malformed event' }, { status: 400 });
  }

  const { id: eventId, type, data } = parsedEnvelope;

  // Idempotency: claim once. A replay returns 200 so Stripe stops retrying.
  let claim: { alreadyProcessed: boolean };
  try {
    claim = await claimEvent(eventId, type);
  } catch {
    // Could not claim -> tell Stripe to retry later.
    return Response.json({ ok: false, error: 'Could not record event' }, { status: 500 });
  }
  if (claim.alreadyProcessed) {
    return Response.json({ ok: true, received: true, duplicate: true }, { status: 200 });
  }

  try {
    switch (type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = SubscriptionObject.parse(data.object);
        await upsertSubscriptionFromStripe(sub);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = InvoiceObject.parse(data.object);
        await recordInvoicePayment(invoice, 'succeeded');
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = InvoiceObject.parse(data.object);
        await recordInvoicePayment(invoice, 'failed');
        break;
      }
      case 'charge.refunded': {
        const charge = ChargeObject.parse(data.object);
        await recordRefund(charge);
        break;
      }
      default:
        // Acknowledged but unhandled. Recorded in the ledger so we can audit coverage.
        break;
    }
    await markEventProcessed(eventId);
    return Response.json({ ok: true, received: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error';
    await markEventProcessed(eventId, message);
    // 500 so Stripe retries; the ledger row already exists, so the retry will see it as claimed.
    // To allow a real retry we clear processing by leaving error set; Stripe retry will hit the
    // duplicate path and 200. We log the failure for manual replay instead.
    return Response.json({ ok: false, error: 'Processing failed' }, { status: 500 });
  }
}
