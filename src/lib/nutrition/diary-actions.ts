'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { requireAuth, requireEntitled } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { macrosForGrams, foodStateFromName, type FoodLite } from '@/lib/nutrition/macros';
import { searchFoods, getFoodDetail, lookupFoodByBarcode, type FoodDetail } from '@/lib/nutrition/foods';
import { analyzeMealText } from '@/lib/nutrition/text-parse';
import { after } from 'next/server';
import { recordItemOutcome } from '@/lib/ai/inferences';
import { emitEvent } from '@/lib/events/emit';
import { recomputeChallengeProgressForProfile } from '@/lib/community/challenge-progress';

// Live leaderboard refresh for 'logs' challenges after a diary write; after() survives the frozen
// lambda, with a plain floating fallback outside a request scope.
function refreshChallenges(companyId: string, profileId: string): void {
  try {
    after(() => recomputeChallengeProgressForProfile(companyId, profileId));
  } catch {
    void recomputeChallengeProgressForProfile(companyId, profileId);
  }
}
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localDay } from '@/lib/datetime/local-day';
import type { PhotoResult } from '@/lib/nutrition/photo';

export async function searchFoodsAction(query: string): Promise<FoodLite[]> {
  await requireAuth();
  const locale = await getLocale();
  return searchFoods(query, locale);
}

const TextMealInput = z.string().trim().min(2).max(500);

// Text-to-macro: parse a natural-language meal description into confidence-scored, macro-scaled
// candidates (reuses the photo-to-macro resolve pipeline). The nutrition page is entitlement-gated.
export async function parseTextToMacroAction(text: unknown): Promise<PhotoResult> {
  const parsed = TextMealInput.safeParse(text);
  if (!parsed.success) return { status: 'error' };
  // requireEntitled, not requireAuth: this action spends real model tokens, and a server action is
  // its own POST endpoint - the page-level paywall does not protect it (matches the photo route).
  const ctx = await requireEntitled();
  // Cost control: cap text-to-macro AI parses per user so OpenRouter spend stays bounded (fails open).
  if (!(await checkRateLimit(ctx.userId, 'text-to-macro', 30, 300))) return { status: 'error' };
  const locale = await getLocale();
  // ctx enables provenance: the returned inferenceId links logged foods back to this prediction.
  return analyzeMealText(
    parsed.data,
    locale,
    ctx.companyId ? { companyId: ctx.companyId, profileId: ctx.userId } : undefined,
  );
}

const BarcodeInput = z.string().trim().min(4).max(32).regex(/^[0-9\s-]+$/);

export type BarcodeResult = { ok: boolean; food?: FoodLite; error?: 'invalid' | 'not_found' };

export async function lookupBarcodeAction(barcode: unknown): Promise<BarcodeResult> {
  const parsed = BarcodeInput.safeParse(barcode);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  await requireAuth();
  const locale = await getLocale();
  const food = await lookupFoodByBarcode(parsed.data, locale);
  if (!food) return { ok: false, error: 'not_found' };
  return { ok: true, food };
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
  // 'photo' covers vision-read packaged products (label scans); provenance links via aiInferenceId.
  source: z.enum(['search', 'barcode', 'text', 'photo']).optional(),
  aiInferenceId: z.string().uuid().optional(),
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

  // Write the user's LOCAL day explicitly so an evening logger does not land on tomorrow (UTC).
  const tz = await getProfileTimezone(ctx.userId);
  const { data: inserted, error } = await sb
    .from('food_log')
    .insert({
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      name: parsed.data.name,
      food_id: parsed.data.foodId,
      portion_id: parsed.data.portionId ?? null,
      meal_slot: parsed.data.mealSlot,
      log_date: localDay(tz),
      grams: parsed.data.grams,
      amount: parsed.data.grams,
      source: parsed.data.source ?? 'search',
      ai_inference_id: parsed.data.aiInferenceId ?? null,
      kcal: m.kcal,
      protein_g: m.proteinG,
      carb_g: m.carbG,
      fat_g: m.fatG,
    })
    .select('id')
    .single();
  if (error) {
    console.error('logFoodAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  if (ctx.companyId && inserted) {
    emitEvent({
      companyId: ctx.companyId,
      profileId: ctx.userId,
      type: 'food_logged',
      aggregateType: 'food_log',
      aggregateId: (inserted as { id: string }).id,
      payload: {
        food_id: parsed.data.foodId,
        meal_slot: parsed.data.mealSlot,
        grams: parsed.data.grams,
        kcal: m.kcal,
        source: parsed.data.source ?? 'search',
      },
    });
    refreshChallenges(ctx.companyId, ctx.userId);
  }
  revalidatePath('/nutrition');
  return { ok: true };
}

// Log a single photo-detected food. The client sends the visible (cooked, as-photographed) grams;
// the server matches the row's stated state and converts to the raw-equivalent grams so the
// per-100g macros apply correctly, then recomputes macros server-side. source = 'photo'.
const PhotoLogInput = z.object({
  foodId: z.string().uuid(),
  name: z.string().min(1).max(200),
  predictedName: z.string().min(1).max(200),
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  grams: z.number().positive().max(5000),
  // Provenance + correction capture (all optional; a photo log still works without them).
  aiInferenceId: z.string().uuid().optional(),
  predictedFoodId: z.string().uuid().optional(), // the food the scan matched (identity-swap detection)
  predictedGrams: z.number().positive().max(5000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function logPhotoFoodAction(input: unknown): Promise<LogResult> {
  const parsed = PhotoLogInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireAuth();
  const sb = await createClient();

  const { data: food } = await sb
    .from('foods')
    .select('kcal, protein_g, carb_g, fat_g, category, name_en, name_es')
    .eq('id', parsed.data.foodId)
    .maybeSingle();
  if (!food) return { ok: false, error: 'not_found' };
  const f = food as {
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    category: string | null;
    name_en: string;
    name_es: string | null;
  };

  // Photo grams are the visible cooked portion. If the row is stated raw, convert cooked -> raw.
  let effGrams = parsed.data.grams;
  const listed = foodStateFromName(`${f.name_en} ${f.name_es ?? ''} ${parsed.data.predictedName}`);
  if (listed === 'raw' && f.category) {
    const { data: r } = await sb
      .from('cooked_uncooked_ratios')
      .select('factor')
      .eq('category', f.category)
      .eq('state_from', 'raw')
      .eq('state_to', 'cooked')
      .limit(1)
      .maybeSingle();
    const factor = r ? Number((r as { factor: number }).factor) : 0;
    if (factor > 0) effGrams = Math.round(parsed.data.grams / factor);
  }

  const m = macrosForGrams(
    { kcal: Number(f.kcal), proteinG: Number(f.protein_g), carbG: Number(f.carb_g), fatG: Number(f.fat_g) },
    effGrams,
  );

  // Correction detection, the supervised signal that improves the scan over time.
  // GRAMS: a meaningful portion change (>5%) from the scan's estimate, comparing the user-facing
  // (visible) grams they submitted against the visible grams the scan predicted.
  // IDENTITY: the user logged a DIFFERENT food than the scan matched. Detected ONLY via the threaded
  // predictedFoodId; display names differ on nearly every log (DB name vs model phrase) = pure noise.
  const predicted = parsed.data.predictedGrams ?? null;
  const gramsChanged = predicted != null && Math.abs(parsed.data.grams - predicted) / predicted > 0.05;
  const identityChanged =
    parsed.data.predictedFoodId != null && parsed.data.predictedFoodId !== parsed.data.foodId;
  const fields: ('grams' | 'food_identity')[] = [
    ...(identityChanged ? (['food_identity'] as const) : []),
    ...(gramsChanged ? (['grams'] as const) : []),
  ];
  const corrected = fields.length > 0;

  const tz = await getProfileTimezone(ctx.userId);
  const { data: inserted, error } = await sb
    .from('food_log')
    .insert({
      company_id: ctx.companyId,
      profile_id: ctx.userId,
      name: parsed.data.name,
      food_id: parsed.data.foodId,
      meal_slot: parsed.data.mealSlot,
      log_date: localDay(tz),
      grams: effGrams,
      amount: effGrams,
      source: 'photo',
      kcal: m.kcal,
      protein_g: m.proteinG,
      carb_g: m.carbG,
      fat_g: m.fatG,
      ai_inference_id: parsed.data.aiInferenceId ?? null,
      predicted_grams: predicted,
      confidence_score: parsed.data.confidence ?? null,
      corrected_at: corrected ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('logPhotoFoodAction:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  const logId = inserted ? (inserted as { id: string }).id : null;
  if (ctx.companyId && logId) {
    emitEvent({
      companyId: ctx.companyId,
      profileId: ctx.userId,
      type: 'food_logged',
      aggregateType: 'food_log',
      aggregateId: logId,
      correlationId: parsed.data.aiInferenceId ?? null,
      payload: {
        food_id: parsed.data.foodId,
        meal_slot: parsed.data.mealSlot,
        grams: parsed.data.grams,
        kcal: m.kcal,
        source: 'photo',
        confidence: parsed.data.confidence ?? null,
      },
    });
    if (corrected) {
      emitEvent({
        companyId: ctx.companyId,
        profileId: ctx.userId,
        type: 'food_corrected',
        aggregateType: 'food_log',
        aggregateId: logId,
        idempotencyKey: `food_corrected:${logId}`,
        correlationId: parsed.data.aiInferenceId ?? null,
        payload: {
          food_id: parsed.data.foodId,
          fields,
          predicted_food_id: parsed.data.predictedFoodId ?? null,
          predicted_grams: predicted,
          corrected_grams: gramsChanged ? parsed.data.grams : null,
        },
      });
    }
    refreshChallenges(ctx.companyId, ctx.userId);
  }
  // Feed the learning loop: merge this item's outcome onto the scan's inference row. ALWAYS recorded
  // when the log links to an inference: a correction (grams and/or identity) is supervision, and an
  // unchanged log (fields=[]) is a confirmed-correct prediction, equally valuable signal.
  // Fire-and-forget - never blocks the log. Per-item detail also persists on the food_log row above.
  if (parsed.data.aiInferenceId) {
    void recordItemOutcome(parsed.data.aiInferenceId, {
      foodId: parsed.data.foodId,
      predictedFoodId: parsed.data.predictedFoodId ?? null,
      predictedName: parsed.data.predictedName,
      correctedName: identityChanged ? parsed.data.name : null,
      predictedGrams: predicted,
      correctedGrams: gramsChanged ? parsed.data.grams : null,
      fields,
    });
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

// Star / unstar a food. Returns the new state so the UI can flip optimistically.
export async function toggleFavoriteAction(foodId: unknown): Promise<{ ok: boolean; favorited?: boolean }> {
  const parsed = z.string().uuid().safeParse(foodId);
  if (!parsed.success) return { ok: false };
  const ctx = await requireAuth();
  if (!ctx.companyId) return { ok: false };
  const sb = await createClient();
  const { data: existing } = await sb
    .from('user_food_favorites')
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('food_id', parsed.data)
    .maybeSingle();
  if (existing) {
    await sb.from('user_food_favorites').delete().eq('id', (existing as { id: string }).id);
    revalidatePath('/nutrition');
    return { ok: true, favorited: false };
  }
  const { error } = await sb
    .from('user_food_favorites')
    .insert({ company_id: ctx.companyId, profile_id: ctx.userId, food_id: parsed.data });
  if (error) {
    console.error('toggleFavoriteAction:', error.message);
    return { ok: false };
  }
  revalidatePath('/nutrition');
  return { ok: true, favorited: true };
}
