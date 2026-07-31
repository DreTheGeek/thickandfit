// Public support intake. The form on /support posts here.
//
// Public and unauthenticated on purpose: the people who most need support are the ones who cannot
// log in, so requiring a session would exclude exactly the population this exists for. That makes it
// an abuse surface, so it carries the same envelope as the funnel signup: IP rate limit, Turnstile,
// Zod, and a length cap before anything touches the database.
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';
import { verifyTurnstileToken } from '@/lib/security/turnstile';
import { createSupportTicket } from '@/lib/support/intake';
import { resolveTenantId } from '@/lib/tenant';
import { storeAttachment } from '@/lib/support/attachment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  email: z.string().trim().toLowerCase().email().max(200),
  category: z.enum(['billing', 'account', 'bug', 'content', 'other']).optional(),
  // A screenshot OF THE PROBLEM, as a data URL. ~14MB of base64 covers the bucket's 10MB binary cap
  // plus encoding overhead; storeAttachment enforces the real limit and the mime allowlist, so this
  // bound exists only to stop an oversized body reaching the parser.
  attachment: z.string().max(14_000_000).optional(),
  turnstile_token: z.string().max(2048).optional(),
});

async function POST_h(req: Request): Promise<Response> {
  const ip = await clientIp();
  // 3/min. Lower than the funnel's 5: nobody legitimately files three tickets a minute, and the
  // cost of a flood here is a poisoned board during the exact week the team depends on it.
  if (!(await checkRateLimit(ip, 'support-ticket', 3, 60))) {
    return apiError('Too many requests. Please try again in a minute.', 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return apiError('Invalid input', 422);

  const turnstile = await verifyTurnstileToken(parsed.data.turnstile_token, ip);
  if (!turnstile.ok) {
    console.error('support/ticket turnstile:', turnstile.reason);
    return apiError('Verification failed. Please refresh and try again.', 400);
  }

  try {
    const companyId = await resolveTenantId();
    // Stored before the ticket so its path goes in with the row. A failed upload yields null and the
    // ticket is still created: a bug report without its screenshot beats no bug report.
    const attachmentPath = parsed.data.attachment
      ? await storeAttachment(parsed.data.attachment, 'web')
      : null;

    const res = await createSupportTicket({
      companyId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      email: parsed.data.email,
      source: 'web',
      category: parsed.data.category ?? null,
      attachmentUrl: attachmentPath,
    });
    if (!res.ok) return apiError('Could not send your message. Please try again in a moment.', 500);
    // A duplicate reads as success to the member: they pressed Send twice, which is not an error and
    // must not prompt a third attempt.
    return apiSuccess({ received: true }, 201);
  } catch (e) {
    console.error('support/ticket:', e instanceof Error ? e.message : e);
    return apiError('Could not send your message. Please try again in a moment.', 500);
  }
}

export const POST = withApiLog(POST_h);
