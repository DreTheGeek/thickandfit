// POST /api/coach-ai/plan: generate an AI meal plan for a client. Coach/operator-gated (resolveAuth
// + COACH_ROLES), rate-limited (bounds OpenRouter spend), Zod-validated. Reads the client's
// onboarding intake + the company's coaching knowledge, calls Sonnet in JSON mode, and inserts a
// meal_plans row the coach Meal Plans library renders. Usage is metered to ai_usage_log inside
// generateMealPlan.
//
// Key-gating: with no OPENROUTER_API_KEY it returns HTTP 200 { status: 'notConfigured' } and writes
// nothing. It never crashes without the key. SCOPE: meal plans only (no workout-program gen).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiError } from '@/lib/api/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { generateMealPlan, type PlanLocale } from '@/lib/coach-ai/plan-gen';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PlanRequest = z.object({
  clientProfileId: z.string().uuid(),
  contactId: z.string().uuid().nullable().optional(),
  locale: z.enum(['en', 'es']).optional(),
});

async function POST_h(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);
  // Only coaches/operators (incl. assistant_coach) may generate plans; subscribers cannot.
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);

  // Cost control: cap plan generations per coach so OpenRouter spend cannot run away (fails open).
  if (!(await checkRateLimit(ctx.userId, 'coach-ai-plan', 20, 300))) {
    return apiError('You are generating plans too fast. Please wait a moment.', 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const parsed = PlanRequest.safeParse(raw);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 422);
  }

  const result = await generateMealPlan({
    companyId: ctx.companyId,
    generatedBy: ctx.userId,
    clientProfileId: parsed.data.clientProfileId,
    contactId: parsed.data.contactId ?? null,
    locale: (parsed.data.locale ?? 'en') as PlanLocale,
  });

  // Graceful degradation: no key -> 200 with a clear status so the UI shows a sensible state.
  if (result.status === 'notConfigured') {
    return Response.json({ ok: false, status: 'notConfigured' }, { status: 200 });
  }
  if (result.status === 'noData') {
    return Response.json({ ok: false, status: 'noData' }, { status: 200 });
  }
  if (result.status === 'error') {
    return apiError('Could not generate the plan. Please try again.', 502);
  }

  return Response.json(
    { ok: true, status: 'ok', planId: result.planId, grounded: result.embedded },
    { status: 200 },
  );
}

export const POST = withApiLog(POST_h);
