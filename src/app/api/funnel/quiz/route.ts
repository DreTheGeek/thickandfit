// Public quiz submission for the waitlist funnel. Awards +2 entries once per lead (idempotent) and
// tags the lead's language + tier candidacy for the post-launch private mid/high-ticket flow.
// Rate-limited harder than signup because the caller already has a leadId (i.e., they are on the
// thank-you page, not a bot spraying signups).
import { apiSuccess, apiError } from '@/lib/api/auth';
import { withApiLog } from '@/lib/telemetry/request-log';
import { submitQuiz, quizSchema } from '@/lib/funnel/service';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function POST_h(req: Request): Promise<Response> {
  if (!(await checkRateLimit(await clientIp(), 'funnel-quiz', 10, 60))) {
    return apiError('Too many requests. Please try again in a minute.', 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }

  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  try {
    const result = await submitQuiz(parsed.data);
    return apiSuccess(result, 200);
  } catch (e) {
    console.error('funnel/quiz:', e instanceof Error ? e.message : e);
    return apiError('Could not save your answers', 500);
  }
}

export const POST = withApiLog(POST_h);
