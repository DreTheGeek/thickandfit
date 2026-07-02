'use server';

// Coach edits the notes on a meal plan (call 2026-07-01: Stephanie's "free veggies" note). Coach-only;
// scoped to the coach's company. The note is shown to the client on their meal-plan view.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

const Input = z.object({
  planId: z.string().uuid(),
  notes: z.string().trim().max(2000),
});

export type MealPlanNotesResult = { ok: boolean; error?: string };

export async function saveMealPlanNotesAction(input: unknown): Promise<MealPlanNotesResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const { error } = await createServiceClient()
    .from('meal_plans')
    .update({ notes: parsed.data.notes || null })
    .eq('id', parsed.data.planId)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('saveMealPlanNotesAction:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  revalidatePath(`/coach/tool/meal-plans/${parsed.data.planId}`);
  return { ok: true };
}
