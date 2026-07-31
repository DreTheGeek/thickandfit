// Unified "smart scan": ONE vision call decides whether the photo is a MEAL/plate or a single packaged
// PRODUCT (incl. its Nutrition Facts label) and resolves each correctly. The golden rule holds:
//   - MEAL: the model gives name + grams; the food DB supplies the macros (resolvePredictedItems).
//   - PRODUCT by name: grounded against USDA + cached.
//   - PRODUCT with a legible LABEL: the model TRANSCRIBES the printed per-serving numbers (reading, not
//     inventing) and we convert to per-100g + cache it.
// Ambiguity -> a `clarify` question the UI asks the user. No OPENROUTER_API_KEY -> clean notConfigured.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { resolvePredictedItems, type PhotoCandidate } from '@/lib/nutrition/photo';
import { groundFoodByName } from '@/lib/nutrition/external-foods';
import type { FoodLite, MacroTotals } from '@/lib/nutrition/macros';
import { AI_MODELS } from '@/lib/ai/models';
import { aiConfigured, callJson, hashInput } from '@/lib/ai/client';
import { logInference } from '@/lib/ai/inferences';
import { buildScanContext, renderScanContextForPrompt } from '@/lib/nutrition/scan-context';

// Model routing lives in the central router (AI_MODELS), NOT hardcoded here, so the eval harness can
// A/B models and swap in one place. The scan tries the primary (smartScan = gpt-5, benchmarked faster +
// more accurate), then a distinct fallback (gemini), so a provider outage or a model-specific rejection
// degrades to a proven model instead of failing every meal log. The shared client dedupes the chain.
const SCAN_CHAIN = [AI_MODELS.smartScan, AI_MODELS.smartScanFallback];
// Bump when PROMPT changes so replay/eval can group inferences by prompt generation. Exported so the
// eval harness records the version under test instead of duplicating the string.
// v2 (2026-07-24): adds K1 member-context injection when ctx is provided. Base PROMPT unchanged,
// so a ctx-less eval run (the golden-set harness) hits the exact same v1 behavior and its score
// cannot regress from this wire. The v2 bump lets the trace show WHICH prompt generation ran.
export const PROMPT_VERSION = 'smart-scan.v2';
const FOOD_COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

export type SmartScanResult =
  // `model` = which chain entry actually answered (a mid-run 429 fallback would otherwise silently
  // contaminate eval attribution). Set on loggable outcomes even without ctx.
  | { status: 'ok'; candidates: PhotoCandidate[]; totals: MacroTotals; inferenceId?: string; model?: string } // a MEAL
  | { status: 'product'; food: FoodLite; clarify: string | null; inferenceId?: string; model?: string }
  // inferenceId on the FAILURE variants too (PRD-A). The route stores the scan image keyed by
  // inference id, and it could only ever see an id on ok/product, so the photos that FAILED were
  // discarded. Those are precisely the replay set worth keeping: when a better model ships, the
  // interesting question is what the current one could not read, not what it already got right.
  | { status: 'clarify'; clarify: string; inferenceId?: string; model?: string }
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
  'You are a nutrition vision engine for a fitness app. Look at the photo and decide what it shows.',
  'It is EITHER (A) a MEAL: a plate/bowl/spread of one or more prepared foods, OR (B) a single packaged PRODUCT or its Nutrition Facts label (a bottle, can, box, wrapper).',
  'Return ONLY minified JSON, no prose, no markdown:',
  '{"kind":"meal"|"product",',
  '"meal":{"reference":string,"items":[{"name":string,"grams":number,"confidence":number,"basis":string}]}|null,',
  '"product":{"name":string,"brand":string|null,"label":{"kcal":number,"protein_g":number,"carb_g":number,"fat_g":number,"serving_grams":number|null,"serving_desc":string|null}|null,"clarify":string|null}|null}',
  'MEAL rules: identify each distinct food; estimate edible weight in grams using a size reference (dinner plate ~26cm, fork ~19cm) via area x height x density; add a "cooking oil" item if it looks pan-fried/roasted; state cooked or raw in the name when it matters; use common searchable generic names. Do NOT output calories or macros for meal items - those are looked up.',
  'PRODUCT rules: if a Nutrition Facts panel is legible, TRANSCRIBE the printed per-serving Calories + protein/carbohydrate/fat grams and the serving size into "label" (serving_grams = the gram weight shown in parentheses, e.g. "1 cup (240g)" -> 240; serving_desc = the household measure). Read the printed numbers EXACTLY; never estimate label numbers. If no label is legible, set label=null and give the product name + brand from the packaging. If you cannot tell which specific product it is, put a short question in "clarify" (e.g. "Is this the original or the light version?").',
].join('\n');

// A transcribed Nutrition Facts label -> a per-100g food row, cached. Needs serving_grams to convert.
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
  if (!g || g <= 0) return null; // can't convert per-serving -> per-100g without the gram weight
  const scale = 100 / g;
  const name = `${p.brand ? `${p.brand} ` : ''}${p.name}`.trim().slice(0, 300);
  const svc = createServiceClient();
  // Dedupe: scanning the same label twice previously inserted a NEW row every time, growing
  // near-duplicate corpus rows that the ilike matcher then hit at random. Reuse the cached row;
  // the uq_foods_ai_name partial unique index (0067) closes the concurrent-scan race.
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
      is_verified: false, // read by the model, not a validated DB
      search_text: name.toLowerCase(),
    })
    .select(FOOD_COLS)
    .maybeSingle();
  if (inserted) return toFoodLite(inserted as FoodRow, locale);
  // Unique-index race: a concurrent scan inserted it first - reuse that row.
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
type MealItem = { name?: string; grams?: number; confidence?: number; basis?: string };
type VisionOut = { kind?: string; meal?: { items?: MealItem[] } | null; product?: Product | null };

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function analyzeSmartPhoto(
  image: string,
  locale: string,
  ctx?: { companyId: string; profileId: string },
): Promise<SmartScanResult> {
  if (!aiConfigured()) return { status: 'notConfigured' };
  const tVision = Date.now();
  const inputHash = hashInput(image);
  try {
    // K1 loop-close: retrieve this member's structured history (habits + past corrections) and
    // fold it in as an ADDITIONAL system message. Base PROMPT stays untouched so eval attribution
    // is clean and a member with no history gets the exact same v1 behavior. Fire-and-forget SQL:
    // a failed context read logs and returns empty rather than blocking the scan.
    let memberContextText: string | null = null;
    if (ctx) {
      try {
        const context = await buildScanContext(ctx.profileId, ctx.companyId);
        memberContextText = renderScanContextForPrompt(context);
      } catch (e) {
        console.error('smart-scan buildScanContext:', e instanceof Error ? e.message : String(e));
      }
    }
    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: PROMPT },
    ];
    if (memberContextText) messages.push({ role: 'system', content: memberContextText });
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Classify and read this photo (a meal, or a single packaged product/label).' },
        { type: 'image_url', image_url: { url: image } },
      ],
    });
    // The shared client runs the chain: primary then fallback, each attempt bounded to 75s so the
    // fallback still fits the route's 300s ceiling; latency-sorted provider + low reasoning effort
    // keep gpt-5 sub-second (its default heavy reasoning was the old ~40s cost). Provenance is
    // DEFERRED: the ai_inferences row needs the final pipeline status + itemCount + confidence, so
    // this module enriches and logs it after the resolve step (exactly the pre-client behavior).
    const call = await callJson({
      models: SCAN_CHAIN,
      timeoutMs: 75_000,
      providerSort: 'latency',
      reasoningEffort: 'low',
      messages,
      // Provenance is deferred (enriched + logged after resolve), so label the trace explicitly here
      // or the scan - the moat surface - aggregates under 'unknown' on /admin/traces.
      traceFeature: 'photo-scan',
    });
    if (call.status === 'notConfigured') return { status: 'notConfigured' };
    // PRD-A: a provider outage (every model in the chain failed) used to return here with no
    // provenance row at all, so the scan left no trace anywhere. Log it, then return. `model: 'none'`
    // because no chain entry answered; callJson does not surface which one was tried last on the
    // error path, and inventing an attribution would be worse than recording that none succeeded.
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

    // Build the result first, then write ONE provenance row for the whole scan and thread its id back so
    // a logged food links to the inference that produced it (enables correction capture + replay).
    let result: SmartScanResult;
    let itemCount = 0;
    let confidence: number | null = null;

    if (out.kind === 'product' && out.product) {
      // --- PRODUCT ---
      const p = out.product;
      const name = (p.name ?? '').trim();
      const clarify = p.clarify?.trim() || null;
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
      else if (clarify) result = { status: 'clarify', clarify };
      else result = { status: 'noFood' };
    } else {
      // --- MEAL --- (reuse the grounded resolve pipeline)
      const items = (out.meal?.items ?? [])
        .map((it) => {
          const nm = (it.name ?? '').trim();
          if (!nm) return null;
          return {
            name: nm,
            grams: Math.min(5000, Math.max(1, Math.round(num(it.grams, 100)))),
            confidence: Math.min(1, Math.max(0, num(it.confidence, 0.5))),
            basis: typeof it.basis === 'string' && it.basis.trim() ? it.basis.trim() : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 12);
      itemCount = items.length;
      confidence = items.length ? items.reduce((s, it) => s + it.confidence, 0) / items.length : null;

      const tResolve = Date.now();
      const resolved = await resolvePredictedItems(items, locale);
      // Timing split so prod latency is attributable (vision vs food resolution) from the logs.
      console.log(`[smart-scan] vision ${visionMs}ms, resolve ${Date.now() - tResolve}ms, items ${items.length}`);
      if (resolved.status === 'ok') result = { status: 'ok', candidates: resolved.candidates, totals: resolved.totals };
      else {
        if (resolved.status !== 'noFood') console.error('smart-scan resolve failed:', resolved.status);
        result = { status: resolved.status === 'noFood' ? 'noFood' : 'error' };
      }
    }

    // Which model answered, on every outcome (with or without ctx): the eval harness runs ctx-less
    // and must attribute a mid-run fallback (gpt-5 429 -> gemini) to the right model. Applied to
    // failures too now, so "gemini could not read this photo" is answerable from the row alone.
    if (result.status !== 'notConfigured') result = { ...result, model: usedModel };

    // Provenance: one row per scan (fire-after, needs the final status). Only when we know the
    // tenant/member (ctx). Thread the id back onto EVERY outcome so a correction can attach to it
    // and, more importantly, so the route can store the pixels for a failed scan.
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
      // notConfigured is the only variant with no id field: it returns before any model call, so
      // there is nothing to attribute and no pixels worth keeping.
      if (inferenceId && result.status !== 'notConfigured') result = { ...result, inferenceId };
    }
    return result;
  } catch (e) {
    // PRD-A: this catch used to return {status:'error'} with no provenance row, so a scan that threw
    // (a JSON.parse of model garbage lands here) was invisible: no row, no image, nothing on
    // /admin/traces. That is the fallback chain's "the model returned nonsense" signal and the eval
    // wants it. Telemetry never throws, hence the nested try (house contract, see inferences.ts).
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
