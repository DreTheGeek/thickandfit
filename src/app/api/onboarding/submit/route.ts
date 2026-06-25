// Onboarding submit: compute the prediction + targets, store one row per profile.
import { z } from 'zod';
import { cookies } from 'next/headers';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { onboardingInputSchema, computePlan } from '@/lib/onboarding/prediction';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

const ONE_YEAR = 60 * 60 * 24 * 365;

// The prediction stats plus the display name + preferred language captured in the wizard.
const submitSchema = onboardingInputSchema.extend({
  firstName: z.string().trim().min(1).max(60).optional(),
  language: z.enum(['en', 'es']).optional(),
});

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
  const parsed = submitSchema.safeParse(body);
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

  // Persist the captured display name + preferred language to the profile.
  const profileUpdate: Record<string, string> = {};
  if (parsed.data.firstName) profileUpdate.full_name = parsed.data.firstName;
  if (parsed.data.language) {
    profileUpdate.ui_locale = parsed.data.language;
    profileUpdate.content_locale = parsed.data.language;
  }
  if (Object.keys(profileUpdate).length > 0) {
    await supabase.from('profiles').update(profileUpdate).eq('id', ctx.userId);
  }

  // Apply the chosen language immediately via cookies so the dashboard loads in it.
  if (parsed.data.language) {
    const store = await cookies();
    store.set('ui_locale', parsed.data.language, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
    store.set('content_locale', parsed.data.language, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  }

  return apiSuccess({ plan });
}
