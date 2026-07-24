// Public waitlist funnel signup — extends /api/waitlist with names/phone/IG + referral attribution.
// The old /api/waitlist stays alive for lightweight newsletter forms; this endpoint is the launch
// funnel entry point (Aug 4 → Sept 27), and the response is designed for the thank-you page:
// referral share URL + entry count + is-new signal, no email confirmation wall.
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { submitSignup, signupSchema } from '@/lib/funnel/service';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function POST_h(req: Request): Promise<Response> {
  // Rate limit per IP: 5/min. Same envelope as /api/waitlist because the abuse surface is identical
  // (creates a GHL contact + sends a Resend email + reserves a referral code per accepted request).
  if (!(await checkRateLimit(await clientIp(), 'funnel-signup', 5, 60))) {
    return apiError('Too many requests. Please try again in a minute.', 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  try {
    const result = await submitSignup(parsed.data);
    return apiSuccess(result, 201);
  } catch (e) {
    console.error('funnel/signup:', e instanceof Error ? e.message : e);
    return apiError('Could not join the waitlist', 500);
  }
}

export const POST = withApiLog(POST_h);
