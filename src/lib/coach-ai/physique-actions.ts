'use server';

// Member-facing action: analyze a progress photo into a supportive body-comp read + staged coaching,
// then persist it. Entitlement-gated (paid + health-ack). The image is passed as a URL or data URL
// (same delivery the food-photo flow uses); progressPhotoId links the read to the stored photo.
import { z } from 'zod';
import { after } from 'next/server';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { analyzePhysique, type PhysiqueResult } from '@/lib/coach-ai/physique';
import { notifyCoachesOfFlaggedPhysique } from '@/lib/coach-ai/physique-notify';
import { checkRateLimit } from '@/lib/security/rate-limit';

const Input = z.object({
  // Signed storage URL or data URL. Refined like the photo route so only data:image/ or http(s) reaches
  // the upstream vision provider (no file:/junk strings forwarded to OpenRouter).
  imageUrl: z
    .string()
    .min(8)
    .max(15_000_000)
    .refine((v) => v.startsWith('data:image/') || /^https?:\/\//i.test(v), {
      message: 'imageUrl must be a data:image/ URL or an http(s) URL',
    }),
  weightLb: z.number().positive().max(2000).nullable().optional(),
  goal: z.string().trim().max(500).nullable().optional(),
  progressPhotoId: z.string().uuid().nullable().optional(),
});

export async function analyzePhysiqueAction(input: unknown): Promise<PhysiqueResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { status: 'error' };

  const ctx = await requireEntitled();
  if (!ctx.companyId) return { status: 'error' };

  // Cost control: gpt-5 vision is the priciest AI path; cap per user so spend cannot run away (fails open).
  if (!(await checkRateLimit(ctx.userId, 'physique-analysis', 20, 3600))) {
    return { status: 'error' };
  }

  const locale = (await getLocale()) === 'es' ? 'es' : 'en';

  const result = await analyzePhysique(
    {
      imageUrl: parsed.data.imageUrl,
      weightLb: parsed.data.weightLb ?? null,
      goal: parsed.data.goal ?? null,
      locale,
    },
    { companyId: ctx.companyId, profileId: ctx.userId },
  );

  // Persist successful reads (service client; RLS is the backstop). Best-effort, never blocks the result.
  if (result.status === 'ok') {
    const a = result.analysis;
    try {
      await createServiceClient()
        .from('physique_analyses')
        .insert({
          company_id: ctx.companyId,
          profile_id: ctx.userId,
          progress_photo_id: parsed.data.progressPhotoId ?? null,
          bf_low: a.bfLow,
          bf_high: a.bfHigh,
          weight_lb: parsed.data.weightLb ?? null,
          assessment: a.assessment,
          goals: a.goals,
          narrative: a.narrative,
          locale,
          model: a.model,
          flagged: a.flagged,
        });
    } catch (e) {
      console.error('analyzePhysiqueAction persist:', e instanceof Error ? e.message : e);
    }

    // Safety loop: a flagged read pings the company's coaches so a human follows up (the member is
    // promised exactly that). after() so this wellbeing escalation is NOT dropped by the frozen
    // lambda (a bare void here could silently lose a flag that a human must see).
    if (a.flagged) {
      const companyId = ctx.companyId;
      const userId = ctx.userId;
      try {
        after(() => notifyCoachesOfFlaggedPhysique(companyId, userId));
      } catch {
        void notifyCoachesOfFlaggedPhysique(companyId, userId);
      }
    }
  }
  return result;
}
