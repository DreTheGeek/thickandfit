'use server';

// Coach edits the notes on a meal plan (call 2026-07-01: Stephanie's "free veggies" note). Coach-only;
// scoped to the coach's company. The note is shown to the client on their meal-plan view.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { parseStructuredPlan } from '@/lib/coach/meal-plan-structured';
import type { StructuredPlan } from '@/lib/coach/meal-plan-structured';

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

// --- Structured meal-plan builder (call 2026-07-02) ------------------------------------------------
// Save the full structured plan the coach authored in the builder (slots -> recipes -> ingredients +
// macros + steps + tips). Reuses parseStructuredPlan for normalization so a saved plan is stored in the
// exact shape the reader expects (empties dropped). Derives the meal_plans macro/kcal columns from the
// authored calorie target + macros so the library + client targets card stay consistent.
const Macros = z.object({
  proteinG: z.number().min(0).max(600),
  carbG: z.number().min(0).max(900),
  fatG: z.number().min(0).max(400),
});
const Ingredient = z.object({ qty: z.string().trim().max(40), item: z.string().trim().max(160) });
const Recipe = z.object({
  title: z.string().trim().max(160),
  prepMin: z.number().int().min(0).max(1440).nullable(),
  cookMin: z.number().int().min(0).max(1440).nullable(),
  kcal: z.number().int().min(0).max(5000).nullable(),
  macros: Macros.nullable(),
  ingredients: z.array(Ingredient).max(40),
  spices: z.array(Ingredient).max(40),
  note: z.string().trim().max(600).nullable(),
  steps: z.array(z.string().trim().max(1200)).max(30),
});
const Slot = z.object({
  name: z.string().trim().max(80),
  kcalTarget: z.number().int().min(0).max(5000).nullable(),
  recipes: z.array(Recipe).max(12),
});
const StructuredInput = z.object({
  planId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().max(200).nullable(),
  calorieTarget: z.number().int().min(0).max(8000).nullable(),
  macros: Macros.nullable(),
  notes: z.string().trim().max(2000).nullable(),
  slots: z.array(Slot).max(10),
});

export type SaveStructuredResult = { ok: boolean; planId?: string; error?: string };

// Percent-of-calories split from macro grams (protein/carb at 4 kcal/g, fat at 9), or nulls when we
// cannot compute one - these feed the GENERATED protein_g/carb_g/fat_g columns on meal_plans.
function splitFromMacros(m: { proteinG: number; carbG: number; fatG: number } | null): {
  p: number | null;
  c: number | null;
  f: number | null;
} {
  if (!m) return { p: null, c: null, f: null };
  const pK = m.proteinG * 4;
  const cK = m.carbG * 4;
  const fK = m.fatG * 9;
  const total = pK + cK + fK;
  if (total <= 0) return { p: null, c: null, f: null };
  return { p: Math.round((pK / total) * 100), c: Math.round((cK / total) * 100), f: Math.round((fK / total) * 100) };
}

export async function saveStructuredPlanAction(input: unknown): Promise<SaveStructuredResult> {
  const parsed = StructuredInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };
  const d = parsed.data;

  // Normalize through the same reader the app renders with (drops title-less recipes + empty rows).
  const candidate = {
    goal: d.goal,
    calorieTarget: d.calorieTarget,
    macros: d.macros,
    macroSplit: null,
    slots: d.slots,
  };
  const cleaned: StructuredPlan | null = parseStructuredPlan(candidate);

  const split = splitFromMacros(d.macros);
  const calorieGoal =
    d.calorieTarget ??
    (d.macros ? Math.round(d.macros.proteinG * 4 + d.macros.carbG * 4 + d.macros.fatG * 9) : null);

  // `goal` is not a meal_plans column - it lives inside `structured`.
  const row = {
    name: d.name,
    calorie_goal: calorieGoal,
    split_protein_pct: split.p,
    split_carb_pct: split.c,
    split_fat_pct: split.f,
    num_meal_groups: cleaned ? cleaned.slots.length : d.slots.filter((s) => s.recipes.some((r) => r.title.trim())).length,
    structured: cleaned,
    notes: d.notes || null,
  };

  const sb = createServiceClient();

  if (d.planId) {
    const { error } = await sb.from('meal_plans').update(row).eq('id', d.planId).eq('company_id', ctx.companyId);
    if (error) {
      console.error('saveStructuredPlanAction update:', error.message);
      return { ok: false, error: 'save_failed' };
    }
    revalidatePath(`/coach/tool/meal-plans/${d.planId}`);
    return { ok: true, planId: d.planId };
  }

  // New plan -> a reusable library template (is_template). Assignment to a client happens separately.
  const { data: inserted, error } = await sb
    .from('meal_plans')
    .insert({ company_id: ctx.companyId, contact_id: null, is_template: true, ...row })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('saveStructuredPlanAction insert:', error?.message);
    return { ok: false, error: 'save_failed' };
  }
  revalidatePath('/coach/tool/meal-plans');
  return { ok: true, planId: (inserted as { id: string }).id };
}
