// Food-resolution layer: turn predicted items [{ name, grams, confidence }] into loggable, macro-scaled
// food rows. Each predicted name is matched to the shared public.foods corpus via FTS (ilike on
// search_text), then cooked_uncooked_ratios + per-100g scaling produce real macros for the predicted
// grams. Shared by the text-to-macro pipeline; the photo path lives in smart-scan.ts. Never crashes.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { macrosForGrams, foodStateFromName, type FoodLite, type MacroTotals } from '@/lib/nutrition/macros';
import { groundFoodByName } from '@/lib/nutrition/external-foods';
import { readPreparation, preparationAgreement, contradictsPreparation } from '@/lib/nutrition/preparation';

export type PredictedItem = { name: string; grams: number; confidence: number; basis?: string };

// A predicted item resolved against the foods corpus, with macros scaled to the predicted grams.
export type PhotoCandidate = {
  predictedName: string;
  grams: number;
  confidence: number;
  matched: boolean;
  food: FoodLite | null;
  macros: MacroTotals | null;
  basis?: string; // the model's area/volume/density portion reasoning (structured-context step)
};

export type PhotoResult =
  // inferenceId/model are set by provenance-aware callers (text-to-macro) so a logged food can link
  // back to the ai_inferences row that predicted it (correction capture + eval attribution).
  | { status: 'ok'; candidates: PhotoCandidate[]; totals: MacroTotals; inferenceId?: string; model?: string }
  | { status: 'notConfigured' }
  | { status: 'noFood' }
  | { status: 'error' };

type FoodRaw = {
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

const COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

function mapFood(r: FoodRaw, locale: string): FoodLite {
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

// Stopwords stripped so "cooked white rice" still matches a "rice" row when the exact phrase misses.
const STOP = new Set(['cooked', 'raw', 'dry', 'fresh', 'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed', 'cocido', 'cocida', 'crudo', 'cruda', 'seco', 'seca', 'a', 'de', 'la', 'el', 'and', 'with', 'con', 'of']);

function keywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// PostgREST .or() splits conditions on commas, so strip them (plus wildcards, quotes, and
// backslashes - a predicted name like 6" sub would otherwise break the whole batched query,
// failing EVERY item on the plate) from user-derived terms.
function orSafe(term: string): string {
  return term.replace(/[,%*()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Rank candidate rows for a term instead of taking the first substring hit (arbitrary order made
 * "egg" able to land on "eggplant"): exact match, then whole-token match, then best-scoring.
 *
 * SHORTEST NO LONGER WINS, and that change is the whole fix for a real incident. The tie-break used
 * to be the shortest `search_text`, as a proxy for "the most generic row". For the keyword
 * "chicken" the shortest row in the corpus is `chicken, feet, boiled`, so a member who
 * photographed a KFC plate - which gpt-5 read correctly as "fried chicken thigh, cooked, breaded" -
 * had chicken FEET logged to her diary. Shortest is a proxy for generic only when the rows are
 * variations on one food; across a 400-row corpus it just finds the oddest short name.
 *
 * The row is now scored against the WHOLE predicted name rather than the single keyword that
 * happened to hit, so a row covering "chicken" + "thigh" beats one covering "chicken" alone, and a
 * row whose preparation contradicts the photo loses outright. Shortest survives only as the final
 * tie-break, where it is still the right instinct.
 */
function bestRowForTerm(
  rows: FoodRowWithSearch[],
  term: string,
  fullName: string,
): FoodRowWithSearch | null {
  const hits = rows.filter((r) => (r.search_text ?? '').includes(term));
  if (!hits.length) return null;
  const exact = hits.find((r) => (r.search_text ?? '').trim() === term);
  if (exact) return exact;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const token = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`);
  const wordHits = hits.filter((r) => token.test(r.search_text ?? ''));
  const pool = wordHits.length ? wordHits : hits;

  const wanted = readPreparation(fullName);
  // The identifying words of the predicted name, preparation words excluded: those are scored
  // separately and far more carefully by preparationAgreement.
  const contentWords = keywords(fullName);

  let best: FoodRowWithSearch | null = null;
  let bestScore = -Infinity;
  for (const r of pool) {
    const text = r.search_text ?? '';
    const covered = contentWords.filter((w) => text.includes(w)).length;
    const coverage = contentWords.length ? covered / contentWords.length : 0;
    const agreement = preparationAgreement(wanted, readPreparation(text));
    // Coverage dominates, preparation is a strong second, length only separates equals. A
    // contradicting row can still win here if nothing else covers the food at all;
    // `localMatchIsUsable` rejects that case afterwards, so the reason lives in one place.
    const score = coverage * 2 + agreement - text.length / 400;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/**
 * Is this local match good enough to log without asking USDA?
 *
 * A wrong match used to be indistinguishable from a right one, and because `resolvePredictedItems`
 * only grounds against USDA when the local match is NULL, `chicken, feet, boiled` actively blocked
 * the lookup that had the correct row (USDA carries KFC's own thigh at 309 kcal / 22.1g fat).
 * Failing to a slower, better source beats logging something she did not eat.
 */
function localMatchIsUsable(row: FoodRowWithSearch, fullName: string): boolean {
  const text = row.search_text ?? '';
  const words = keywords(fullName);
  if (words.length === 0) return true;
  const covered = words.filter((w) => text.includes(w)).length;
  // The head noun alone is not a match. "chicken" covering 1 of 3 words is how feet got logged.
  if (covered / words.length < 0.5) return false;

  const wanted = readPreparation(fullName);
  const got = readPreparation(text);
  if (contradictsPreparation(wanted, got)) return false;

  // A FRIED OR BREADED ITEM NEEDS A ROW THAT SAYS SO.
  //
  // Silence is tolerable in general and not here. This corpus is ~400 rows of mostly generic and
  // Latin foods and it holds no fried chicken at all, so the best it can offer for a KFC thigh is
  // `Chicken thigh, cooked` at 11g of fat against the ~22g she actually ate. That is half the fat
  // on the plate, still hidden, just less absurdly than chicken feet were.
  //
  // USDA has the row (`Fast Foods, Fried Chicken, Thigh, meat and skin and breading`, 18.1g, and
  // KFC's own at 22.1g), and the ONLY way to reach it is for the local match to come back null. So
  // for the one category where the corpus is known to be thin and the error is known to run in the
  // direction that hides calories, prefer the slower, better source.
  if ((wanted.fatClass === 'added-fat' || wanted.breaded) && got.fatClass !== 'added-fat' && !got.breaded) {
    return false;
  }
  return true;
}

type FoodRowWithSearch = FoodRaw & { search_text: string | null };

// BATCHED local matching for a whole plate: ONE query for every item's full phrase, then ONE query
// for every unresolved item's keywords, then JS picks per item with the same preference order the old
// per-item loop had (full phrase first, then longest keyword). The old path ran up to ~6 serial DB
// round-trips PER item (phrase + each keyword + ratio), which was the dominant scan latency after the
// vision call; this is 2 round-trips for the whole plate regardless of item count.
async function matchFoodsBatch(
  sb: Awaited<ReturnType<typeof createClient>>,
  names: string[],
  locale: string,
): Promise<(FoodLite | null)[]> {
  const phrases = names.map((n) => orSafe(n.trim().toLowerCase()));
  const results: (FoodLite | null)[] = names.map(() => null);

  // Round 1: all full phrases in one .or(ilike) query; assign in JS by substring test.
  const phraseTerms = [...new Set(phrases.filter((p) => p.length > 2))];
  if (phraseTerms.length) {
    const { data } = await sb
      .from('foods')
      .select(`${COLS}, search_text`)
      .or(phraseTerms.map((p) => `search_text.ilike.%${p}%`).join(','))
      .limit(80);
    const rows = (data ?? []) as unknown as FoodRowWithSearch[];
    for (let i = 0; i < names.length; i++) {
      const p = phrases[i];
      if (!p) continue;
      const hit = bestRowForTerm(rows, p, names[i]);
      if (hit && localMatchIsUsable(hit, names[i])) results[i] = mapFood(hit, locale);
    }
  }

  // Round 2: keywords for still-unresolved items, one query, most-specific-keyword-first per item.
  const pending = names.map((n, i) => ({ i, words: keywords(n).map(orSafe).filter((w) => w.length > 2) }))
    .filter((x) => results[x.i] === null && x.words.length > 0);
  const kwTerms = [...new Set(pending.flatMap((x) => x.words))];
  if (kwTerms.length) {
    const { data } = await sb
      .from('foods')
      .select(`${COLS}, search_text`)
      .or(kwTerms.map((w) => `search_text.ilike.%${w}%`).join(','))
      .limit(150);
    const rows = (data ?? []) as unknown as FoodRowWithSearch[];
    for (const x of pending) {
      // RAREST WORD FIRST, not longest. Length was a proxy for specificity and it picked the head
      // noun: for "fried chicken thigh, cooked, breaded" the order was [chicken, breaded, thigh],
      // so the least specific word in the name decided the answer and "chicken" alone matched
      // chicken feet. Rarity across the rows actually retrieved is what length was standing in for,
      // and it costs one pass over data already in memory.
      const rarity = new Map(
        x.words.map((w) => [w, rows.filter((r) => (r.search_text ?? '').includes(w)).length]),
      );
      const ordered = [...x.words].sort(
        (a, b) => (rarity.get(a) ?? 0) - (rarity.get(b) ?? 0) || b.length - a.length,
      );
      for (const w of ordered) {
        const hit = bestRowForTerm(rows, w, names[x.i]);
        // An unusable hit does NOT fall through to the next keyword: a vaguer word cannot produce a
        // better row than the specific one just rejected, and letting it try is how the head noun
        // wins anyway. Leaving it null is what hands the item to USDA grounding.
        if (hit) {
          if (localMatchIsUsable(hit, names[x.i])) results[x.i] = mapFood(hit, locale);
          break;
        }
      }
    }
  }
  return results;
}

// Apply the deterministic cooked/uncooked yield so per-100g macros (stated for one state) apply to
// the grams the photo estimated (the visible, cooked form). Ratios come from ONE bulk fetch (the
// table is tiny) instead of a query per item. cooked = raw * factor.
async function loadRawToCookedFactors(
  sb: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, number>> {
  const { data } = await sb
    .from('cooked_uncooked_ratios')
    .select('category, factor')
    .eq('state_from', 'raw')
    .eq('state_to', 'cooked')
    .limit(200);
  const map = new Map<string, number>();
  for (const r of (data ?? []) as { category: string; factor: number }[]) {
    if (!map.has(r.category)) map.set(r.category, Number(r.factor));
  }
  return map;
}

function effectiveGrams(
  factors: Map<string, number>,
  food: FoodLite,
  predictedName: string,
  grams: number,
): number {
  if (!food.category) return grams;
  const listed = foodStateFromName(`${food.name} ${predictedName}`);
  // The photo measures the visible (cooked) portion. If the food row is stated raw, convert down.
  if (listed !== 'raw') return grams;
  const factor = factors.get(food.category) ?? 0;
  if (factor <= 0) return grams;
  // grams here are cooked (as seen); the row is per-100g raw, so convert cooked -> raw.
  return Math.round(grams / factor);
}

// Resolve predicted items (from a photo OR a text description) against the foods corpus and scale
// macros with cooked/uncooked conversion. Shared by analyzeMealPhoto + the text-to-macro pipeline.
export async function resolvePredictedItems(
  items: PredictedItem[],
  locale: string,
): Promise<PhotoResult> {
  if (items.length === 0) return { status: 'noFood' };

  const sb = await createClient();
  const t0 = Date.now();
  // Whole-plate resolution in 3 bulk round-trips (phrase batch + keyword batch + ratio map), then
  // per-item USDA grounding ONLY for local misses (parallel, each cached into foods for next time).
  // The old shape (per-item serial phrase->keyword->ratio queries) dominated scan latency.
  const [localMatches, factors] = await Promise.all([
    matchFoodsBatch(sb, items.map((i) => i.name), locale),
    loadRawToCookedFactors(sb),
  ]);
  const tLocal = Date.now();

  const candidates: PhotoCandidate[] = await Promise.all(
    items.map(async (item, idx): Promise<PhotoCandidate> => {
      // 1) batched local corpus hit. 2) on miss, ground against USDA + cache so the next log is local.
      // The model's grams still scale the DB's per-100g macros (golden rule).
      const food = localMatches[idx] ?? (await groundFoodByName(item.name, locale));
      if (!food) {
        return { predictedName: item.name, grams: item.grams, confidence: item.confidence, matched: false, food: null, macros: null, basis: item.basis };
      }
      const effGrams = effectiveGrams(factors, food, item.name, item.grams);
      // Report the grams the user weighs/sees (the estimate), not the raw-equivalent.
      return { predictedName: item.name, grams: item.grams, confidence: item.confidence, matched: true, food, macros: macrosForGrams(food, effGrams), basis: item.basis };
    }),
  );
  console.log(`[resolve] local ${tLocal - t0}ms, ground ${Date.now() - tLocal}ms, items ${items.length}, misses ${localMatches.filter((m) => m === null).length}`);

  const totals = candidates.reduce<MacroTotals>(
    (a, c) => (c.macros ? { kcal: a.kcal + c.macros.kcal, proteinG: a.proteinG + c.macros.proteinG, carbG: a.carbG + c.macros.carbG, fatG: a.fatG + c.macros.fatG } : a),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );

  return { status: 'ok', candidates, totals };
}
