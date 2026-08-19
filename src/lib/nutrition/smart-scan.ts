// Unified Smart Scan: one vision call decides whether the photo is a meal or packaged product.
// Nutrition truth stays deterministic:
//   - meal: vision identifies food + edible grams, the food corpus supplies macros
//   - product by name: USDA/OFF/local corpus supplies macros
//   - product label: vision transcribes printed values, then the row is cached with low authority
// Image quality and uncertainty are explicit so an unusable photo is rejected instead of guessed.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { resolvePredictedItems, type PhotoCandidate } from '@/lib/nutrition/photo';
import { groundFoodByName } from '@/lib/nutrition/external-foods';
import type { FoodLite, MacroTotals } from '@/lib/nutrition/macros';
import { AI_MODELS } from '@/lib/ai/models';
import { aiConfigured, callJson, hashInput } from '@/lib/ai/client';
import { logInference } from '@/lib/ai/inferences';
import { buildScanContext, renderScanContextForPrompt } from '@/lib/nutrition/scan-context';
import { readPopulationBias } from '@/lib/nutrition/population-bias-store';
import { renderPopulationBiasForPrompt } from '@/lib/nutrition/population-bias';

const SCAN_CHAIN = [AI_MODELS.smartScan, AI_MODELS.smartScanFallback];

// v5 (2026-08-19): image quality gate plus separate identity and portion confidence. The previous
// single confidence number mixed two independent error sources. A model can know that an item is
// chicken while having weak evidence for whether it is 90 g or 180 g. Keeping those separate lets
// the deterministic resolver ask for verification only where the uncertainty actually lives.
export const PROMPT_VERSION = 'smart-scan.v5';
const FOOD_COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

export type ScanClarifyReason = 'image_quality' | 'food_identity' | 'portion' | 'product_identity';

export type SmartScanResult =
  | {
      status: 'ok';
      candidates: PhotoCandidate[];
      totals: MacroTotals;
      verificationQuestions?: string[];
      inferenceId?: string;
      model?: string;
    }
  | { status: 'product'; food: FoodLite; clarify: string | null; inferenceId?: string; model?: string }
  | {
      status: 'clarify';
      clarify: string;
      reason?: ScanClarifyReason;
      inferenceId?: string;
      model?: string;
    }
  | { status: 'notConfigured' }
  | { status: 'noFood'; inferenceId?: string; model?: string }
  | { status: 'error'; inferenceId?: string; model?: string };

type FoodRow = {
  id: string;
  name_en: string;
  name_es: string | null;
  brand: string | null;
  category: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  density_g_per_ml: number | null;
};

function toFoodLite(r: FoodRow, locale: string): FoodLite {
  const name = (locale === 'es' ? r.name_es || r.name_en : r.name_en || r.name_es) || r.name_en;
  return {
    id: r.id,
    name,
    brand: r.brand,
    category: r.category,
    kcal: Number(r.kcal),
    proteinG: Number(r.protein_g),
    carbG: Number(r.carb_g),
    fatG: Number(r.fat_g),
    densityGPerMl: r.density_g_per_ml,
  };
}

const PROMPT = [
  'You are a nutrition vision engine for a fitness app. Inspect the photo conservatively. Never guess through bad image quality.',
  'First judge whether the image is usable for food identification and portion estimation.',
  'Return ONLY minified JSON, no prose, no markdown:',
  '{"image_quality":{"usable":boolean,"confidence":number,"issue":string|null},',
  '"kind":"meal"|"product"|"unknown",',
  '"meal":{"reference":string|null,"clarify":string|null,"items":[{"name":string,"grams":number,"identity_confidence":number,"portion_confidence":number,"confidence":number,"basis":string}]}|null,',
  '"product":{"name":string,"brand":string|null,"identity_confidence":number,"label":{"kcal":number,"protein_g":number,"carb_g":number,"fat_g":number,"serving_grams":number|null,"serving_desc":string|null}|null,"clarify":string|null}|null}',
  'IMAGE QUALITY rules: usable=false when blur, darkness, glare, severe crop, occlusion, distance, or a blocked view prevents dependable identification. A clear image can still have low portion confidence. Do not mark a clear image unusable only because portion size is difficult.',
  'MEAL rules: identify each distinct visible food. Use common searchable generic names. State cooked or raw when it materially changes nutrition. Estimate edible grams from visible geometry and any reliable size reference. If there is no reliable reference, lower portion_confidence instead of pretending the grams are exact. Add cooking oil only when visual evidence supports it. Hidden sauces, oils, fillings, and ingredients must not be invented.',
  'For each meal item, identity_confidence answers only: how sure are you what the food is? portion_confidence answers only: how sure are you about the edible grams? confidence is the conservative combined confidence and must not exceed the weaker dimension by more than 0.10. Values are 0 to 1.',
  'If two materially different foods are visually plausible and the choice would change nutrition, keep the best generic identity, lower identity_confidence, and put one short targeted question in meal.clarify.',
  'Do NOT output calories or macros for meal items. The database supplies nutrition facts after identity resolution.',
  'PRODUCT rules: if a Nutrition Facts panel is legible, transcribe the printed per-serving Calories, protein, carbohydrate, fat, and serving size exactly. Never estimate missing label numbers. If the exact product or variant is uncertain, lower identity_confidence and ask one short targeted question in product.clarify.',
  'STYLE for clarify text: warm, direct, one short sentence. Never use an em dash or en dash.',
].join('\n');

type LabelData = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  serving_grams: number | null;
  serving_desc: string | null;
};

async function groundFoodFromLabel(
  p: { name: string; brand: string | null; label: LabelData },
  locale: string,
): Promise<FoodLite | null> {
  const g = p.label.serving_grams;
  if (!g || g <= 0) return null;
  const scale = 100 / g;
  const name = `${p.brand ? `${p.brand} ` : ''}${p.name}`.trim().slice(0, 300);
  const svc = createServiceClient();

  const { data: existing } = await svc
    .from('foods')
    .select(FOOD_COLS)
    .eq('source', 'ai')
    .ilike('name_en', name)
    .limit(1)
    .maybeSingle();
  if (existing) return toFoodLite(existing as FoodRow, locale);

  const { data: inserted } = await svc
    .from('foods')
    .insert({
      source: 'ai',
      name_en: name,
      brand: p.brand ? p.brand.slice(0, 200) : null,
      kcal: Math.round(p.label.kcal * scale),
      protein_g: Math.round(p.label.protein_g * scale * 10) / 10,
      carb_g: Math.round(p.label.carb_g * scale * 10) / 10,
      fat_g: Math.round(p.label.fat_g * scale * 10) / 10,
      is_verified: false,
      search_text: name.toLowerCase(),
    })
    .select(FOOD_COLS)
    .maybeSingle();
  if (inserted) return toFoodLite(inserted as FoodRow, locale);

  const { data: winner } = await svc
    .from('foods')
    .select(FOOD_COLS)
    .eq('source', 'ai')
    .ilike('name_en', name)
    .limit(1)
    .maybeSingle();
  return winner ? toFoodLite(winner as FoodRow, locale) : null;
}

type Product = {
  name?: string;
  brand?: string | null;
  identity_confidence?: number;
  label?: {
    kcal?: number;
    protein_g?: number;
    carb_g?: number;
    fat_g?: number;
    serving_grams?: number | null;
    serving_desc?: string | null;
  } | null;
  clarify?: string | null;
};

type MealItem = {
  name?: string;
  grams?: number;
  identity_confidence?: number;
  portion_confidence?: number;
  confidence?: number;
  basis?: string;
};

type VisionOut = {
  image_quality?: { usable?: boolean; confidence?: number; issue?: string | null } | null;
  kind?: string;
  meal?: { items?: MealItem[]; clarify?: string | null; reference?: string | null } | null;
  product?: Product | null;
};

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp01(v: unknown, fallback: number): number {
  return Math.min(1, Math.max(0, num(v, fallback)));
}

function imageQualityClarify(issue: string | null | undefined): string {
  const value = (issue ?? '').toLowerCase();
  if (value.includes('blur')) return 'That photo is too blurry to log accurately. Retake it with the food in focus.';
  if (value.includes('dark') || value.includes('light')) return 'I need a brighter photo to read this accurately. Retake it in better light.';
  if (value.includes('glare')) return 'Glare is blocking the food details. Retake it from a slightly different angle.';
  if (value.includes('crop') || value.includes('cut off')) return 'Part of the meal is cut off. Retake it with the full plate in frame.';
  if (value.includes('occlu') || value.includes('block')) return 'Part of the meal is blocked from view. Retake it so the whole plate is visible.';
  if (value.includes('distance') || value.includes('far')) return 'The food is too far away to estimate reliably. Move closer and retake the photo.';
  return 'I cannot read this meal accurately from that photo. Retake it with the full meal clear and in focus.';
}

function verificationQuestions(candidates: PhotoCandidate[], modelClarify: string | null): string[] {
  const questions: string[] = [];
  if (modelClarify) questions.push(modelClarify);

  const weakestIdentity = [...candidates]
    .filter((c) => c.identityConfidence < 0.68 || c.dbMatchConfidence < 0.62)
    .sort((a, b) => Math.min(a.identityConfidence, a.dbMatchConfidence) - Math.min(b.identityConfidence, b.dbMatchConfidence))[0];
  if (weakestIdentity && questions.length === 0) {
    questions.push(`Can you confirm that the ${weakestIdentity.predictedName} is identified correctly?`);
  }

  const weakestPortion = [...candidates]
    .filter((c) => c.portionConfidence < 0.58)
    .sort((a, b) => a.portionConfidence - b.portionConfidence)[0];
  if (weakestPortion && questions.length < 2) {
    questions.push(`About how much ${weakestPortion.predictedName} did you have?`);
  }

  return [...new Set(questions)].slice(0, 2);
}

async function resolveVisionOut(
  out: VisionOut,
  locale: string,
  visionMs: number | null,
): Promise<{ result: SmartScanResult; itemCount: number; confidence: number | null }> {
  let result: SmartScanResult;
  let itemCount = 0;
  let confidence: number | null = null;

  const quality = out.image_quality;
  if (quality?.usable === false) {
    return {
      result: {
        status: 'clarify',
        clarify: imageQualityClarify(quality.issue),
        reason: 'image_quality',
      },
      itemCount: 0,
      confidence: clamp01(quality.confidence, 0),
    };
  }

  if (out.kind === 'product' && out.product) {
    const p = out.product;
    const name = (p.name ?? '').trim();
    const clarify = p.clarify?.trim() || null;
    const identityConfidence = clamp01(p.identity_confidence, name ? 0.65 : 0);
    confidence = identityConfidence;

    // If the model itself says it cannot identify the product variant, do not silently ground the
    // wrong SKU from a fuzzy name. Ask first when confidence is materially low and it supplied a
    // targeted clarification.
    if (identityConfidence < 0.58 && clarify) {
      result = { status: 'clarify', clarify, reason: 'product_identity' };
      return { result, itemCount, confidence };
    }

    let food: FoodLite | null = null;
    if (p.label && typeof p.label.kcal === 'number') {
      food = await groundFoodFromLabel(
        {
          name: name || 'Packaged food',
          brand: p.brand ?? null,
          label: {
            kcal: num(p.label.kcal),
            protein_g: num(p.label.protein_g),
            carb_g: num(p.label.carb_g),
            fat_g: num(p.label.fat_g),
            serving_grams: p.label.serving_grams ?? null,
            serving_desc: p.label.serving_desc ?? null,
          },
        },
        locale,
      );
    }
    if (!food && name) food = await groundFoodByName(name, locale);
    if (food) result = { status: 'product', food, clarify };
    else if (clarify) result = { status: 'clarify', clarify, reason: 'product_identity' };
    else result = { status: 'noFood' };
    return { result, itemCount, confidence };
  }

  if (out.kind !== 'meal' || !out.meal) {
    return {
      result: {
        status: 'clarify',
        clarify: 'I cannot tell what food is in this photo. Retake it with the meal centered and clearly visible.',
        reason: 'image_quality',
      },
      itemCount: 0,
      confidence: 0,
    };
  }

  const items = (out.meal.items ?? [])
    .map((it) => {
      const nm = (it.name ?? '').trim();
      if (!nm) return null;
      const legacy = clamp01(it.confidence, 0.5);
      const identityConfidence = clamp01(it.identity_confidence, legacy);
      const portionConfidence = clamp01(it.portion_confidence, legacy);
      const conservative = Math.min(legacy, identityConfidence + 0.1, portionConfidence + 0.1);
      return {
        name: nm,
        grams: Math.min(5000, Math.max(1, Math.round(num(it.grams, 100)))),
        confidence: Math.max(0, conservative),
        identityConfidence,
        portionConfidence,
        basis: typeof it.basis === 'string' && it.basis.trim() ? it.basis.trim() : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 12);

  itemCount = items.length;
  confidence = items.length
    ? items.reduce((sum, item) => sum + Math.min(item.identityConfidence, item.portionConfidence), 0) / items.length
    : null;

  if (!items.length) {
    const clarify = out.meal.clarify?.trim();
    result = clarify
      ? { status: 'clarify', clarify, reason: 'food_identity' }
      : { status: 'noFood' };
    return { result, itemCount, confidence };
  }

  const tResolve = Date.now();
  const resolved = await resolvePredictedItems(items, locale);
  console.log(
    `[smart-scan] vision ${visionMs === null ? 'cached' : `${visionMs}ms`}, resolve ${Date.now() - tResolve}ms, items ${items.length}`,
  );

  if (resolved.status === 'ok') {
    const questions = verificationQuestions(resolved.candidates, out.meal.clarify?.trim() || null);
    result = {
      status: 'ok',
      candidates: resolved.candidates,
      totals: resolved.totals,
      ...(questions.length ? { verificationQuestions: questions } : {}),
    };
  } else {
    if (resolved.status !== 'noFood') console.error('smart-scan resolve failed:', resolved.status);
    result = { status: resolved.status === 'noFood' ? 'noFood' : 'error' };
  }

  return { result, itemCount, confidence };
}

const SCAN_CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function findCachedScan(
  profileId: string,
  inputHash: string,
): Promise<{ id: string; rawOutput: VisionOut; model: string } | null> {
  try {
    const svc = createServiceClient();
    const since = new Date(Date.now() - SCAN_CACHE_WINDOW_MS).toISOString();
    const { data, error } = await svc
      .from('ai_inferences')
      .select('id, raw_output, model')
      .eq('feature', 'photo-scan')
      .eq('profile_id', profileId)
      .eq('input_hash', inputHash)
      .eq('prompt_version', PROMPT_VERSION)
      .in('status', ['ok', 'product'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: string; raw_output: unknown; model: string | null };
    if (!row.raw_output || typeof row.raw_output !== 'object') return null;
    return { id: row.id, rawOutput: row.raw_output as VisionOut, model: row.model ?? 'cached' };
  } catch (e) {
    console.error('smart-scan findCachedScan:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function analyzeSmartPhoto(
  image: string,
  locale: string,
  ctx?: { companyId: string; profileId: string },
): Promise<SmartScanResult> {
  if (!aiConfigured()) return { status: 'notConfigured' };
  const tVision = Date.now();
  const inputHash = hashInput(image);

  if (ctx) {
    const cached = await findCachedScan(ctx.profileId, inputHash);
    if (cached) {
      const { result } = await resolveVisionOut(cached.rawOutput, locale, null);
      console.log(`[smart-scan] cache hit ${cached.id}, total ${Date.now() - tVision}ms`);
      return result.status === 'notConfigured'
        ? result
        : { ...result, inferenceId: cached.id, model: cached.model };
    }
  }

  try {
    let memberContextText: string | null = null;
    let populationBiasText: string | null = null;
    if (ctx) {
      const [ownRes, popRes] = await Promise.allSettled([
        buildScanContext(ctx.profileId, ctx.companyId),
        readPopulationBias(ctx.companyId),
      ]);
      if (ownRes.status === 'fulfilled') memberContextText = renderScanContextForPrompt(ownRes.value);
      else console.error('smart-scan buildScanContext:', ownRes.reason);
      if (popRes.status === 'fulfilled') populationBiasText = renderPopulationBiasForPrompt(popRes.value);
      else console.error('smart-scan readPopulationBias:', popRes.reason);
    }

    const messages: { role: string; content: unknown }[] = [{ role: 'system', content: PROMPT }];
    if (populationBiasText) messages.push({ role: 'system', content: populationBiasText });
    if (memberContextText) messages.push({ role: 'system', content: memberContextText });
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Classify and read this photo. Reject it if image quality cannot support a dependable food read.' },
        { type: 'image_url', image_url: { url: image } },
      ],
    });

    const call = await callJson({
      models: SCAN_CHAIN,
      timeoutMs: 75_000,
      providerSort: 'latency',
      reasoningEffort: 'low',
      messages,
      traceFeature: 'photo-scan',
      retrievalCount: (populationBiasText ? 1 : 0) + (memberContextText ? 1 : 0),
    });
    if (call.status === 'notConfigured') return { status: 'notConfigured' };

    if (call.status !== 'ok') {
      const failed: SmartScanResult = { status: 'error' };
      if (!ctx) return failed;
      try {
        const inferenceId = await logInference({
          companyId: ctx.companyId,
          profileId: ctx.profileId,
          feature: 'photo-scan',
          model: 'none',
          promptVersion: PROMPT_VERSION,
          inputHash,
          rawOutput: null,
          confidence: null,
          latencyMs: Date.now() - tVision,
          status: 'error',
          itemCount: 0,
        });
        return inferenceId ? { status: 'error', inferenceId } : failed;
      } catch (e) {
        console.error('smart-scan call-failed logInference:', e instanceof Error ? e.message : e);
        return failed;
      }
    }

    const usedModel = call.model;
    const out = JSON.parse(call.content) as VisionOut;
    const visionMs = call.latencyMs;
    const resolvedOut = await resolveVisionOut(out, locale, visionMs);
    const { itemCount, confidence } = resolvedOut;
    let result = resolvedOut.result;

    if (result.status !== 'notConfigured') result = { ...result, model: usedModel };

    if (ctx) {
      const inferenceId = await logInference({
        companyId: ctx.companyId,
        profileId: ctx.profileId,
        feature: 'photo-scan',
        model: usedModel,
        promptVersion: PROMPT_VERSION,
        inputHash,
        rawOutput: out,
        confidence,
        latencyMs: Date.now() - tVision,
        status: result.status,
        itemCount,
      });
      if (inferenceId && result.status !== 'notConfigured') result = { ...result, inferenceId };
    }
    return result;
  } catch (e) {
    console.error('smart-scan exception:', e instanceof Error ? e.message : String(e));
    const failed: SmartScanResult = { status: 'error' };
    if (!ctx) return failed;
    try {
      const inferenceId = await logInference({
        companyId: ctx.companyId,
        profileId: ctx.profileId,
        feature: 'photo-scan',
        model: 'none',
        promptVersion: PROMPT_VERSION,
        inputHash,
        rawOutput: null,
        confidence: null,
        latencyMs: Date.now() - tVision,
        status: 'error',
        itemCount: 0,
      });
      return inferenceId ? { status: 'error', inferenceId } : failed;
    } catch (logErr) {
      console.error('smart-scan exception logInference:', logErr instanceof Error ? logErr.message : logErr);
      return failed;
    }
  }
}
