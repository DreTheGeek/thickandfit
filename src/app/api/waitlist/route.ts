// Public waitlist submission. Validates with Zod, stores the lead, triggers email + GHL drip.
// Rate limited per IP because every accepted submission creates a GHL contact + sends a Resend email
// (cost/spam/sender-reputation vector on an unauthenticated, pre-launch endpoint).
import { apiSuccess, apiError } from '@/lib/api/auth';
import { waitlistSchema, submitWaitlist } from '@/lib/marketing/waitlist';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
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

  try {
    const result = await submitWaitlist(parsed.data);
    return apiSuccess(result, 201);
  } catch {
    return apiError('Could not join waitlist', 500);
  }
}
