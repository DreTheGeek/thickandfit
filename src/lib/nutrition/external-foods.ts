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
// Pure matching rules live in their own module so they can be unit-tested without a network call or
// a service-role client. See .qa-visual/usda-brand-guard-test.mjs.
import { brandConflicts, isPlausiblePer100g, penaltyApplies, usdaBrandOf } from '@/lib/nutrition/usda-match';

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
type UsdaFood = {
  fdcId?: number;
  description?: string;
  foodCategory?: string;
  foodNutrients?: UsdaNutrient[];
  // Present on Branded rows. brandOwner is the company ("Chipotle Mexican Grill"), brandName the
  // label. SR Legacy has neither and instead embeds the chain in description ("TACO BELL, ...").
  brandOwner?: string | null;
  brandName?: string | null;
  dataType?: string | null;
};

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
    // Fail closed BEFORE scoring: a brand mismatch is disqualifying, not a penalty to be outweighed
    // by enough generic word overlap. That outweighing is exactly how Chipotle became Taco Bell.
    if (brandConflicts(query, f)) continue;
    // Macros that cannot be true per 100g are rejected here rather than at insert, so a bad row
    // cannot beat a good one on score and then vanish, leaving the food unresolved.
    const kcal = usdaValue(f, NUT.kcal);
    if (kcal != null) {
      const ok = isPlausiblePer100g(
        kcal,
        usdaValue(f, NUT.protein) ?? 0,
        usdaValue(f, NUT.carbs) ?? 0,
        usdaValue(f, NUT.fat) ?? 0,
      );
      if (!ok) continue;
    }
    let s = 0;
    for (const w of qWords) if (desc.includes(w)) s += 2;
    // penaltyApplies, NOT desc.includes: the substring form matched "oil" inside "broiler" and
    // penalised every canonical USDA chicken row by -5. See usda-match.ts for the measurement.
    for (const b of USDA_PENALTY) if (penaltyApplies(desc, b) && !ql.includes(b)) s -= 5;
    s -= desc.length / 200;
    // Prefer a generic row over a branded one at equal relevance. A member typing "chicken breast"
    // wants the food, not somebody's frozen entree that happens to share the words.
    if (usdaBrandOf(f)) s -= 1;
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
    // TWO PASSES, generic first. Branded is NOT merged into the primary query on purpose.
    //
    // Branded outnumbers the generic datasets by ~60x on a restaurant-shaped query ("chicken burrito
    // bowl": 25,931 vs 415). Merged into one call it would dominate the result page by relevance, and
    // since the brand guard rejects branded rows for a query that names no brand, an ordinary search
    // for "chicken breast" could come back with a page of branded entrees, have all of them
    // discarded, and resolve to NOTHING. That would break the common case to fix the rare one.
    //
    // Sequencing instead makes this change strictly additive: pass 1 is byte-identical to the
    // behavior that shipped before today, and pass 2 can only turn a former miss into a hit.
    const search = async (dataType: string, pageSize: number, timeoutMs: number): Promise<UsdaFood[]> => {
      const url =
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}` +
        `&dataType=${dataType}&pageSize=${pageSize}&api_key=${USDA_KEY}`;
      // Hard cap the external call: unmatched items ground here in parallel, and a slow USDA response
      // must never drag the whole photo scan toward the function timeout. Miss fast, log locally.
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) return [];
      const j = (await r.json()) as { foods?: UsdaFood[] };
      return j.foods ?? [];
    };

    let f = pickBestUsda(q, await search('Foundation,SR%20Legacy', 8, 6000));
    if (!f?.fdcId) {
      // Only on a miss, and on a tighter budget: this path previously returned null outright, so the
      // worst case trades a guaranteed no-match for a slower possible match. Restaurant and packaged
      // items live almost entirely here (SR Legacy carries legacy fast-food rows but was last
      // refreshed around 2018, so current menus are absent). pageSize is larger because the brand
      // guard discards most candidates before scoring.
      f = pickBestUsda(q, await search('Branded', 25, 4000));
    }
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

    // Belt and braces. pickBestUsda already filtered on this, but the corpus is permanent: a bad row
    // cached here is served to every future member, so it is worth paying the check twice.
    const pProtein = usdaValue(f, NUT.protein) ?? 0;
    const pCarb = usdaValue(f, NUT.carbs) ?? 0;
    const pFat = usdaValue(f, NUT.fat) ?? 0;
    if (!isPlausiblePer100g(kcal, pProtein, pCarb, pFat)) {
      console.error(`groundFoodByName: implausible macros for fdcId ${f.fdcId}, not caching`);
      return null;
    }

    // Keep the brand on the row so the name a member sees says which chain it came from, and so a
    // later search can tell "Chipotle chicken bowl" from a generic one.
    const brand = (f.brandOwner ?? f.brandName ?? '').trim() || null;
    const description = String(f.description).slice(0, 300);
    // Race-tolerant via the (source, source_id) unique index (0067): a concurrent scan of the same
    // unknown food no longer inserts a duplicate corpus row - the loser re-reads the winner's row.
    const { data: inserted } = await svc
      .from('foods')
      .upsert(
        {
          source: 'usda',
          source_id: String(f.fdcId),
          source_url: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
          name_en: description,
          brand,
          category: f.foodCategory ?? null,
          kcal,
          protein_g: pProtein,
          carb_g: pCarb,
          fat_g: pFat,
          fiber_g: usdaValue(f, NUT.fiber),
          sugar_g: usdaValue(f, NUT.sugar),
          sodium_mg: usdaValue(f, NUT.sodium),
          ...usdaMicros(f),
          is_verified: true, // USDA is government-validated
          search_text: description.toLowerCase(),
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true },
      )
      .select(FOOD_COLS)
      .maybeSingle();
    if (inserted) return toFoodLite(inserted as FoodRow, locale);
    // Concurrent insert won the race: return its row.
    const { data: winner } = await svc
      .from('foods')
      .select(FOOD_COLS)
      .eq('source', 'usda')
      .eq('source_id', String(f.fdcId))
      .maybeSingle();
    return winner ? toFoodLite(winner as FoodRow, locale) : null;
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
    // Race-tolerant via the (source, source_id) unique index (0067).
    const { data: inserted } = await svc
      .from('foods')
      .upsert({
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
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })
      .select(FOOD_COLS)
      .maybeSingle();
    if (inserted) return toFoodLite(inserted as FoodRow, locale);
    // Concurrent insert won the race: return its row.
    const { data: winner } = await svc
      .from('foods')
      .select(FOOD_COLS)
      .eq('source', 'off')
      .eq('source_id', code)
      .maybeSingle();
    return winner ? toFoodLite(winner as FoodRow, locale) : null;
  } catch (e) {
    console.error('groundFoodByBarcode:', e instanceof Error ? e.message : e);
    return null;
  }
}
