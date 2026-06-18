// Onboarding submit: compute the prediction + targets, store one row per profile.
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { onboardingInputSchema, computePlan } from '@/lib/onboarding/prediction';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = onboardingInputSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const plan = computePlan(parsed.data);
  const supabase = createServiceClient();
  await supabase.from('onboarding_responses').upsert(
    {
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      answers: parsed.data,
      predicted_goal: parsed.data.goal,
      computed_targets: plan,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );

  return apiSuccess({ plan });
}
