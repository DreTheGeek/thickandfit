'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { macrosForGrams, type FoodLite } from '@/lib/nutrition/macros';
import { searchFoods, getFoodDetail, type FoodDetail } from '@/lib/nutrition/foods';

export async function searchFoodsAction(query: string): Promise<FoodLite[]> {
  await requireAuth();
  const locale = await getLocale();
  return searchFoods(query, locale);
}

export async function getFoodDetailAction(foodId: string): Promise<FoodDetail | null> {
  const parsed = z.string().uuid().safeParse(foodId);
  if (!parsed.success) return null;
  await requireAuth();
  const locale = await getLocale();
  return getFoodDetail(parsed.data, locale);
}

const LogInput = z.object({
  foodId: z.string().uuid(),
  name: z.string().min(1).max(200),
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  grams: z.number().positive().max(5000),
  portionId: z.string().uuid().nullable().optional(),
});

export type LogResult = { ok: boolean; error?: string };

export async function logFoodAction(input: unknown): Promise<LogResult> {
  const parsed = LogInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  const sb = await createClient();

  // Macros are recomputed server-side from the food row — never trusted from the client.
  const { data: food } = await sb
    .from('foods')
    .select('kcal, protein_g, carb_g, fat_g')
    .eq('id', parsed.data.foodId)
    .maybeSingle();
  if (!food) return { ok: false, error: 'not_found' };
  const f = food as { kcal: number; protein_g: number; carb_g: number; fat_g: number };
  const m = macrosForGrams(
    { kcal: Number(f.kcal), proteinG: Number(f.protein_g), carbG: Number(f.carb_g), fatG: Number(f.fat_g) },
    parsed.data.grams,
  );

  const { error } = await sb.from('food_log').insert({
    company_id: ctx.companyId,
    profile_id: ctx.userId,
    name: parsed.data.name,
    food_id: parsed.data.foodId,
    portion_id: parsed.data.portionId ?? null,
    meal_slot: parsed.data.mealSlot,
    grams: parsed.data.grams,
    amount: parsed.data.grams,
    source: 'search',
    kcal: m.kcal,
    protein_g: m.proteinG,
    carb_g: m.carbG,
    fat_g: m.fatG,
  });
  if (error) {
    console.error('logFoodAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  revalidatePath('/nutrition');
  return { ok: true };
}

export async function deleteFoodLogAction(id: string): Promise<LogResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  await requireAuth();
  const sb = await createClient();
  const { error } = await sb.from('food_log').delete().eq('id', parsed.data); // RLS scopes to owner
  if (error) {
    console.error('deleteFoodLogAction:', error.message);
    return { ok: false, error: 'delete_failed' };
  }
  revalidatePath('/nutrition');
  return { ok: true };
}
