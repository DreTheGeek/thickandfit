// Public waitlist submission. Validates with Zod, stores the lead, triggers email + GHL drip.
import { apiSuccess, apiError } from '@/lib/api/auth';
import { waitlistSchema, submitWaitlist } from '@/lib/marketing/waitlist';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!(await checkRateLimit(ip, 'waitlist', 5, 60))) return apiError('Too many requests', 429);

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
