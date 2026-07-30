// Public waitlist funnel signup — extends /api/waitlist with names/phone/IG + referral attribution.
// The old /api/waitlist stays alive for lightweight newsletter forms; this endpoint is the launch
// funnel entry point (Aug 4 → Sept 27), and the response is designed for the thank-you page:
// referral share URL + entry count + is-new signal, no email confirmation wall.
import { cookies } from 'next/headers';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { submitSignup, signupSchema } from '@/lib/funnel/service';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import { PREVIEW_COOKIE, hasPreviewAccess, isWaitlistClosed } from '@/lib/launch/prelaunch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function POST_h(req: Request): Promise<Response> {
  const ip = await clientIp();

  // Waitlist closed (PRELAUNCH_WAITLIST_CLOSED): refuse here, not just in the proxy.
  //
  // The proxy redirect hides the /join PAGE, which stops a human. It does not stop a direct POST to
  // this route, and this route is what actually creates the lead, the GHL contact and the referral
  // code. Closing the door on the page while leaving the endpoint open would mean the waitlist is
  // "closed" everywhere except the one place that counts.
  //
  // The team's preview cookie bypasses it, so the whole funnel stays testable while it is dark.
  if (isWaitlistClosed()) {
    const jar = await cookies();
    if (!hasPreviewAccess(jar.get(PREVIEW_COOKIE)?.value)) {
      return apiError('The waitlist is not open yet.', 503);
    }
  }

  // Rate limit per IP: 5/min. Same envelope as /api/waitlist because the abuse surface is identical
  // (creates a GHL contact + sends a Resend email + reserves a referral code per accepted request).
  if (!(await checkRateLimit(ip, 'funnel-signup', 5, 60))) {
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

  // Bot defense: Turnstile server-verify BEFORE any DB write / email / GHL upsert. Lazy-gated
  // on TURNSTILE_SECRET_KEY — when unset (pre-config), skips silently so legitimate signups
  // still succeed. When set, a missing/invalid token 400s the request without any side effect.
  // The 5/min IP rate limit above still bounds attempts even in the pre-config window.
  const turnstile = await verifyTurnstileToken(parsed.data.turnstile_token, ip);
  if (!turnstile.ok) {
    console.error('funnel/signup turnstile:', turnstile.reason);
    return apiError('Verification failed. Please refresh and try again.', 400);
  }

  try {
    const result = await submitSignup(parsed.data);
    return apiSuccess(result, 201);
  } catch (e) {
    console.error('funnel/signup:', e instanceof Error ? e.message : e);
    return apiError('Could not join the waitlist', 500);
  }
}

export const POST = withApiLog(POST_h);
