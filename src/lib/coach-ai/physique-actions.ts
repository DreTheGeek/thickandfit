'use server';

// Member-facing action: analyze a progress photo into a supportive body-comp read + staged coaching,
// then persist it. Entitlement-gated (paid + health-ack). The image is passed as a URL or data URL
// (same delivery the food-photo flow uses); progressPhotoId links the read to the stored photo.
import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { analyzePhysique, type PhysiqueResult } from '@/lib/coach-ai/physique';
import { notifyCoachesOfFlaggedPhysique } from '@/lib/coach-ai/physique-notify';

const Input = z.object({
  imageUrl: z.string().min(1).max(15_000_000), // signed storage URL or data URL
  weightLb: z.number().positive().max(2000).nullable().optional(),
  goal: z.string().trim().max(500).nullable().optional(),
  progressPhotoId: z.string().uuid().nullable().optional(),
});

export async function analyzePhysiqueAction(input: unknown): Promise<PhysiqueResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { status: 'error' };

  const ctx = await requireEntitled();
  if (!ctx.companyId) return { status: 'error' };
  const locale = (await getLocale()) === 'es' ? 'es' : 'en';

  const result = await analyzePhysique({
    imageUrl: parsed.data.imageUrl,
    weightLb: parsed.data.weightLb ?? null,
    goal: parsed.data.goal ?? null,
    locale,
  });

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
    // promised exactly that). Fire-and-forget; never blocks the member's result.
    if (a.flagged) void notifyCoachesOfFlaggedPhysique(ctx.companyId, ctx.userId);
  }
  return result;
}
