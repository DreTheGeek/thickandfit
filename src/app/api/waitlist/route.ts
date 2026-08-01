// Public waitlist submission. Validates with Zod, stores the lead, triggers email + GHL drip.
// Rate limited per IP because every accepted submission creates a GHL contact + sends a Resend email
// (cost/spam/sender-reputation vector on an unauthenticated, pre-launch endpoint).
//
// Turnstile-verified for the same reason /api/funnel/signup is. This endpoint has the IDENTICAL abuse
// profile (a GHL contact and a Resend send per accepted request, so real spend and real sender
// reputation) and had only the IP throttle, which a distributed script walks straight through. Found
// while auditing which public endpoints actually call the verifier: signup and support did, this one
// did not, and it is still wired to the marketing waitlist form.
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { waitlistSchema, submitWaitlist } from '@/lib/marketing/waitlist';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { verifyTurnstileToken } from '@/lib/security/turnstile';

export const dynamic = 'force-dynamic';

async function POST_h(req: Request): Promise<Response> {
  if (!(await checkRateLimit(await clientIp(), 'waitlist', 5, 60))) {
    return apiError('Too many requests. Please try again in a minute.', 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  // Lazy-gated on TURNSTILE_SECRET_KEY: skips cleanly while unset so today's live form keeps working,
  // and starts blocking the moment the secret lands. Runs BEFORE submitWaitlist so a rejected request
  // never reaches the GHL contact or the Resend send.
  const turnstile = await verifyTurnstileToken(parsed.data.turnstile_token, await clientIp());
  if (!turnstile.ok) {
    console.error('waitlist turnstile:', turnstile.reason);
    return apiError('Verification failed. Please refresh and try again.', 400);
  }

  try {
    const result = await submitWaitlist(parsed.data);
    return apiSuccess(result, 201);
  } catch {
    return apiError('Could not join waitlist', 500);
  }
}

export const POST = withApiLog(POST_h);
