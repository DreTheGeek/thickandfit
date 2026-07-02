// External ground-truth food sources (the accuracy wedge). When the local `foods` corpus (329 rows)
// misses a food the model recognized, we fall back to a validated nutrition database, cache the hit
// into `foods`, and use it. The GOLDEN RULE holds: the model supplies the NAME + grams; these sources
// supply the per-100g macros. Never the LLM.
//   - By name (photo / text / search): USDA FoodData Central (free, ~400K generic foods, per-100g).
//   - By barcode: Open Food Facts (free, no key, 2.5M packaged products; sodium is grams, convert to mg).
// Cached rows carry source/source_id/source_url so a food is fetched from the vendor at most once; the
// second time anyone logs it, it is a local hit (free + instant, and respects OFF's 15 req/min limit).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { FoodLite } from '@/lib/nutrition/macros';

const USDA_KEY = process.env.USDA_API_KEY;
const UA = 'ThickAndFit/1.0 (contact@teamthickandfit.com)';
const FOOD_COLS =
  'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

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

// ---------------------------------------------------------------------------------------------
// USDA FoodData Central (name -> generic food, per-100g macros)
// ---------------------------------------------------------------------------------------------
type UsdaNutrient = { nutrientNumber?: string; nutrient?: { number?: string }; value?: number; amount?: number };
type UsdaFood = { fdcId?: number; description?: string; foodCategory?: string; foodNutrients?: UsdaNutrient[] };

// USDA nutrient numbers (per 100g): 208 kcal, 203 protein, 204 fat, 205 carbs, 291 fiber, 269 sugar, 307 sodium(mg).
const NUT = { kcal: '208', protein: '203', fat: '204', carbs: '205', fiber: '291', sugar: '269', sodium: '307' } as const;
// Micronutrient panel (0064). Numbers verified against a live FDC response 2026-07-02; note 606 is
// saturated fat (315 is manganese) and 417 is total folate (435 is the DFE variant). USDA values
// already arrive in the column's target unit (MG for minerals/C/cholesterol, UG=mcg for D/B12/A-RAE/
// folate, G for fatty acids), so usdaValue passes through unchanged.
const NUT_MICRO = {
  calcium_mg: '301',
  iron_mg: '303',
  magnesium_mg: '304',
  potassium_mg: '306',
  zinc_mg: '309',
  vitamin_c_mg: '401',
  vitamin_d_mcg: '328',
  vitamin_b12_mcg: '418',
  vitamin_a_mcg_rae: '320',
  folate_mcg: '417',
  cholesterol_mg: '601',
  sat_fat_g: '606',
  trans_fat_g: '605',
  mono_fat_g: '645',
  poly_fat_g: '646',
} as const;

function usdaMicros(f: UsdaFood): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [col, num] of Object.entries(NUT_MICRO)) out[col] = usdaValue(f, num);
  return out;
}

function usdaValue(f: UsdaFood, num: string): number | null {
  const n = (f.foodNutrients ?? []).find((x) => (x.nutrientNumber ?? x.nutrient?.number) === num);
  const v = n?.value ?? n?.amount;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// USDA's default relevance sometimes floats a supplement/oil/baby-food above the actual whole food
// (e.g. "grilled salmon" -> "Fish oil, salmon"). Re-rank: reward query-word overlap, penalize those
// off-target categories (unless the query asked for them), and prefer concise/generic descriptions.
const USDA_PENALTY = ['oil', 'supplement', 'infant', 'baby', 'formula', 'flavored'];
function pickBestUsda(query: string, foods: UsdaFood[]): UsdaFood | null {
  const ql = query.toLowerCase();
  const qWords = ql.split(/\s+/).filter((w) => w.length > 2);
  let best: UsdaFood | null = null;
  let bestScore = 0; // require a net-positive score (at least one real word match)
  for (const f of foods) {
    const desc = (f.description ?? '').toLowerCase();
    if (!desc) continue;
    let s = 0;
    for (const w of qWords) if (desc.includes(w)) s += 2;
    for (const b of USDA_PENALTY) if (desc.includes(b) && !ql.includes(b)) s -= 5;
    s -= desc.length / 200;
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return best;
}

/**
 * Ground a recognized food NAME against USDA + cache it into `foods`. Returns a loggable FoodLite
 * (per-100g macros) or null if USDA has nothing usable. Never throws.
 */
export async function groundFoodByName(name: string, locale: string): Promise<FoodLite | null> {
  if (!USDA_KEY) return null;
  const q = name.trim();
  if (q.length < 2) return null;
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}` +
      `&dataType=Foundation,SR%20Legacy&pageSize=8&api_key=${USDA_KEY}`;
    // Hard cap the external call: unmatched items ground here in parallel, and a slow USDA response
    // must never drag the whole photo scan toward the function timeout. Miss fast, log locally.
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { foods?: UsdaFood[] };
    const f = pickBestUsda(q, json.foods ?? []);
    if (!f?.fdcId || !f.description) return null;

    const svc = createServiceClient();
    // Already cached from a prior lookup? Reuse it (dedupe on source_id).
    const { data: existing } = await svc
      .from('foods')
      .select(FOOD_COLS)
      .eq('source', 'usda')
      .eq('source_id', String(f.fdcId))
      .limit(1)
      .maybeSingle();
    if (existing) return toFoodLite(existing as FoodRow, locale);

    const kcal = usdaValue(f, NUT.kcal);
    if (kcal == null) return null; // no energy -> not loggable

    const description = String(f.description).slice(0, 300);
    const { data: inserted } = await svc
      .from('foods')
      .insert({
        source: 'usda',
        source_id: String(f.fdcId),
        source_url: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
        name_en: description,
        category: f.foodCategory ?? null,
        kcal,
        protein_g: usdaValue(f, NUT.protein) ?? 0,
        carb_g: usdaValue(f, NUT.carbs) ?? 0,
        fat_g: usdaValue(f, NUT.fat) ?? 0,
        fiber_g: usdaValue(f, NUT.fiber),
        sugar_g: usdaValue(f, NUT.sugar),
        sodium_mg: usdaValue(f, NUT.sodium),
        ...usdaMicros(f),
        is_verified: true, // USDA is government-validated
        search_text: description.toLowerCase(),
      })
      .select(FOOD_COLS)
      .single();
    return inserted ? toFoodLite(inserted as FoodRow, locale) : null;
  } catch (e) {
    console.error('groundFoodByName:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Open Food Facts (barcode -> packaged product, per-100g macros)
// ---------------------------------------------------------------------------------------------
type OffNutriments = Record<string, number | string | undefined>;
type OffProduct = { product_name?: string; brands?: string; nutriments?: OffNutriments };

function offNum(nm: OffNutriments, key: string): number | null {
  const v = nm[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Ground a BARCODE against Open Food Facts + cache it into `foods`. Returns a loggable FoodLite or
 * null if the product is not in OFF. Never throws. OFF sodium is grams/100g -> stored as mg.
 */
export async function groundFoodByBarcode(barcode: string, locale: string): Promise<FoodLite | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 6) return null;
  try {
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from('foods')
      .select(FOOD_COLS)
      .eq('barcode', code)
      .limit(1)
      .maybeSingle();
    if (existing) return toFoodLite(existing as FoodRow, locale);

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const nm = p.nutriments ?? {};
    const kcal = offNum(nm, 'energy-kcal_100g');
    if (kcal == null) return null;

    const name = (p.product_name?.trim() || 'Packaged food').slice(0, 300);
    // OFF canonical *_100g values are GRAMS: minerals/vitC/cholesterol convert g -> mg (sodium
    // precedent); fatty acids stay g. Vitamins A/D/B12/folate are SKIPPED from OFF on purpose:
    // crowd-sourced unit chaos (IU vs mcg) makes a wrong 1e6-factor value worse than null; USDA
    // covers the generic foods where those matter.
    const gToMg = (v: number | null): number | null => (v != null ? Math.round(v * 1000) : null);
    const sodiumG = offNum(nm, 'sodium_100g');
    const { data: inserted } = await svc
      .from('foods')
      .insert({
        source: 'off',
        source_id: code,
        source_url: `https://world.openfoodfacts.org/product/${code}`,
        barcode: code,
        name_en: name,
        brand: p.brands ? String(p.brands).slice(0, 200) : null,
        kcal,
        protein_g: offNum(nm, 'proteins_100g') ?? 0,
        carb_g: offNum(nm, 'carbohydrates_100g') ?? 0,
        fat_g: offNum(nm, 'fat_100g') ?? 0,
        fiber_g: offNum(nm, 'fiber_100g'),
        sugar_g: offNum(nm, 'sugars_100g'),
        sodium_mg: sodiumG != null ? Math.round(sodiumG * 1000) : null,
        sat_fat_g: offNum(nm, 'saturated-fat_100g'),
        trans_fat_g: offNum(nm, 'trans-fat_100g'),
        mono_fat_g: offNum(nm, 'monounsaturated-fat_100g'),
        poly_fat_g: offNum(nm, 'polyunsaturated-fat_100g'),
        calcium_mg: gToMg(offNum(nm, 'calcium_100g')),
        iron_mg: gToMg(offNum(nm, 'iron_100g')),
        magnesium_mg: gToMg(offNum(nm, 'magnesium_100g')),
        potassium_mg: gToMg(offNum(nm, 'potassium_100g')),
        zinc_mg: gToMg(offNum(nm, 'zinc_100g')),
        vitamin_c_mg: gToMg(offNum(nm, 'vitamin-c_100g')),
        cholesterol_mg: gToMg(offNum(nm, 'cholesterol_100g')),
        is_verified: false, // crowd-sourced
        search_text: name.toLowerCase(),
      })
      .select(FOOD_COLS)
      .single();
    return inserted ? toFoodLite(inserted as FoodRow, locale) : null;
  } catch (e) {
    console.error('groundFoodByBarcode:', e instanceof Error ? e.message : e);
    return null;
  }
}
