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

const apiKey = process.env.OPENROUTER_API_KEY;
// The unified scan is a fast, high-frequency path (classify meal-vs-product, read items/label). gpt-5's
// heavy reasoning made it ~40s per scan, which kills logging. Gemini 2.5 Flash runs the same
// prompt-driven structured-context steps in a few seconds. (A gpt-5 "precise mode" can be an option later.)
const MODEL = 'google/gemini-2.5-flash';
const FOOD_COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

export type SmartScanResult =
  | { status: 'ok'; candidates: PhotoCandidate[]; totals: MacroTotals } // a MEAL (matches PhotoResult 'ok')
  | { status: 'product'; food: FoodLite; clarify: string | null }
  | { status: 'clarify'; clarify: string }
  | { status: 'notConfigured' }
  | { status: 'noFood' }
  | { status: 'error' };

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
    .single();
  return inserted ? toFoodLite(inserted as FoodRow, locale) : null;
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

export async function analyzeSmartPhoto(image: string, locale: string): Promise<SmartScanResult> {
  if (!apiKey) return { status: 'notConfigured' };
  const tVision = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // Bound the vision call so a slow provider response fails cleanly instead of hanging to the
      // function ceiling (which the user sees as a hard timeout error).
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: MODEL,
        // Route to the lowest-latency Gemini provider (same model + weights, so no accuracy change);
        // avoids the occasional slow-provider outlier on OpenRouter.
        provider: { sort: 'latency' },
        // Food recognition + label transcription is not a deep-reasoning task; gpt-5 defaults to heavy
        // reasoning that made a scan take ~40s. Low effort keeps the accuracy and cuts it to a few seconds.
        reasoning: { effort: 'low' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Classify and read this photo (a meal, or a single packaged product/label).' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      // Never swallow the cause: log the provider status + body so a prod failure is diagnosable
      // (401 = bad key, 402 = out of credits, 429 = rate limit, 400 = bad request/model).
      const body = await res.text().catch(() => '');
      console.error(`smart-scan vision HTTP ${res.status} (${MODEL}):`, body.slice(0, 400));
      return { status: 'error' };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.error('smart-scan vision: empty content', JSON.stringify(json).slice(0, 300));
      return { status: 'error' };
    }
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const out = JSON.parse(cleaned) as VisionOut;
    const visionMs = Date.now() - tVision;

    // --- PRODUCT ---
    if (out.kind === 'product' && out.product) {
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
      if (food) return { status: 'product', food, clarify };
      if (clarify) return { status: 'clarify', clarify };
      return { status: 'noFood' };
    }

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

    const tResolve = Date.now();
    const resolved = await resolvePredictedItems(items, locale);
    // Timing split so prod latency is attributable (vision vs food resolution) from the logs.
    console.log(`[smart-scan] vision ${visionMs}ms, resolve ${Date.now() - tResolve}ms, items ${items.length}`);
    if (resolved.status === 'ok') return { status: 'ok', candidates: resolved.candidates, totals: resolved.totals };
    if (resolved.status !== 'noFood') console.error('smart-scan resolve failed:', resolved.status);
    return { status: resolved.status === 'noFood' ? 'noFood' : 'error' };
  } catch (e) {
    console.error('smart-scan exception:', e instanceof Error ? e.message : String(e));
    return { status: 'error' };
  }
}
