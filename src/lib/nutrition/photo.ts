// Food-resolution layer: turn predicted food identities + portions into authoritative, macro-scaled
// rows. Smart Scan never trusts the vision model for nutrition facts. It resolves each identity through
// the local food corpus, then scales the corpus's per-100g nutrition by the estimated edible grams.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { macrosForGrams, foodStateFromName, type FoodLite, type MacroTotals } from '@/lib/nutrition/macros';
import { groundFoodByName } from '@/lib/nutrition/external-foods';
import { matchFoodsHybrid, type FoodMatchMethod } from '@/lib/nutrition/food-retrieval';

export type PredictedItem = {
  name: string;
  grams: number;
  // Backward-compatible aggregate confidence from smart-scan.v4 and text-to-macro.
  confidence: number;
  // Newer callers can separate "what is it?" from "how much is there?". They are deliberately
  // optional so cached v4 inferences replay through the same deterministic resolver.
  identityConfidence?: number;
  portionConfidence?: number;
  basis?: string;
};

export type PhotoCandidate = {
  predictedName: string;
  grams: number;
  confidence: number;
  identityConfidence: number;
  portionConfidence: number;
  dbMatchConfidence: number;
  nutritionConfidence: number;
  overallConfidence: number;
  needsVerification: boolean;
  resolutionMethod: FoodMatchMethod;
  matched: boolean;
  food: FoodLite | null;
  macros: MacroTotals | null;
  basis?: string;
};

export type PhotoResult =
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

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

// Legacy local matcher stays as a deployment-safe fallback. Once 0145 is live, hybrid retrieval is
// always attempted first. If the RPC or embedding provider is unavailable, a scan still resolves via
// this path and then USDA rather than becoming a hard outage.
const STOP = new Set(['cooked', 'raw', 'dry', 'fresh', 'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed', 'cocido', 'cocida', 'crudo', 'cruda', 'seco', 'seca', 'a', 'de', 'la', 'el', 'and', 'with', 'con', 'of']);

function keywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function orSafe(term: string): string {
  return term.replace(/[,%*()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

type FoodRowWithSearch = FoodRaw & { search_text: string | null };

function bestRowForTerm(rows: FoodRowWithSearch[], term: string): FoodRowWithSearch | null {
  const hits = rows.filter((r) => (r.search_text ?? '').includes(term));
  if (!hits.length) return null;
  const exact = hits.find((r) => (r.search_text ?? '').trim() === term);
  if (exact) return exact;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const token = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`);
  const wordHits = hits.filter((r) => token.test(r.search_text ?? ''));
  const pool = wordHits.length ? wordHits : hits;
  return pool.reduce((a, b) => ((a.search_text ?? '').length <= (b.search_text ?? '').length ? a : b));
}

async function matchFoodsLegacy(
  sb: Awaited<ReturnType<typeof createClient>>,
  names: string[],
  locale: string,
): Promise<(FoodLite | null)[]> {
  const phrases = names.map((n) => orSafe(n.trim().toLowerCase()));
  const results: (FoodLite | null)[] = names.map(() => null);

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
      const hit = bestRowForTerm(rows, p);
      if (hit) results[i] = mapFood(hit, locale);
    }
  }

  const pending = names
    .map((n, i) => ({ i, words: keywords(n).map(orSafe).filter((w) => w.length > 2) }))
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
      const ordered = [...x.words].sort((a, b) => b.length - a.length);
      for (const w of ordered) {
        const hit = bestRowForTerm(rows, w);
        if (hit) {
          results[x.i] = mapFood(hit, locale);
          break;
        }
      }
    }
  }
  return results;
}

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
  if (listed !== 'raw') return grams;
  const factor = factors.get(food.category) ?? 0;
  if (factor <= 0) return grams;
  return Math.round(grams / factor);
}

function confidenceFor(
  item: PredictedItem,
  dbMatchConfidence: number,
  nutritionConfidence: number,
): {
  identity: number;
  portion: number;
  overall: number;
  needsVerification: boolean;
} {
  const identity = clamp01(item.identityConfidence ?? item.confidence);
  const portion = clamp01(item.portionConfidence ?? item.confidence);
  const db = clamp01(dbMatchConfidence);
  const nutrition = clamp01(nutritionConfidence);

  // Identity is the strongest factor for "what is this?". Portion is deliberately separate because a
  // model can be certain it sees rice while being uncertain whether that mound is 120g or 190g.
  const overall = clamp01(identity * 0.38 + portion * 0.24 + db * 0.23 + nutrition * 0.15);
  return { identity, portion, overall, needsVerification: identity < 0.7 || portion < 0.58 || db < 0.62 || overall < 0.7 };
}

export async function resolvePredictedItems(
  items: PredictedItem[],
  locale: string,
): Promise<PhotoResult> {
  if (items.length === 0) return { status: 'noFood' };

  const sb = await createClient();
  const names = items.map((i) => i.name);
  const t0 = Date.now();

  // Hybrid lookup and deployment-safe legacy fallback run concurrently with the tiny yield table.
  // USDA is only called after both local paths miss.
  const [hybridMatches, legacyMatches, factors] = await Promise.all([
    matchFoodsHybrid(names, locale),
    matchFoodsLegacy(sb, names, locale),
    loadRawToCookedFactors(sb),
  ]);
  const tLocal = Date.now();

  const candidates: PhotoCandidate[] = await Promise.all(
    items.map(async (item, idx): Promise<PhotoCandidate> => {
      const hybrid = hybridMatches[idx];
      const legacy = legacyMatches[idx];

      let food: FoodLite | null = hybrid?.food ?? legacy;
      let method: FoodMatchMethod = hybrid?.method ?? (legacy ? 'legacy' : 'external');
      let dbMatchConfidence = hybrid?.dbMatchConfidence ?? (legacy ? 0.7 : 0);
      let nutritionConfidence = hybrid?.nutritionConfidence ?? (legacy ? 0.8 : 0);

      if (!food) {
        food = await groundFoodByName(item.name, locale);
        if (food) {
          method = 'external';
          // USDA grounding performs its own relevance, brand-conflict and plausible-macro guards.
          dbMatchConfidence = 0.86;
          nutritionConfidence = 0.99;
        }
      }

      if (!food) {
        const c = confidenceFor(item, 0, 0);
        return {
          predictedName: item.name,
          grams: item.grams,
          confidence: c.overall,
          identityConfidence: c.identity,
          portionConfidence: c.portion,
          dbMatchConfidence: 0,
          nutritionConfidence: 0,
          overallConfidence: c.overall,
          needsVerification: true,
          resolutionMethod: method,
          matched: false,
          food: null,
          macros: null,
          basis: item.basis,
        };
      }

      const c = confidenceFor(item, dbMatchConfidence, nutritionConfidence);
      const effGrams = effectiveGrams(factors, food, item.name, item.grams);
      return {
        predictedName: item.name,
        grams: item.grams,
        confidence: c.overall,
        identityConfidence: c.identity,
        portionConfidence: c.portion,
        dbMatchConfidence,
        nutritionConfidence,
        overallConfidence: c.overall,
        needsVerification: c.needsVerification,
        resolutionMethod: method,
        matched: true,
        food,
        macros: macrosForGrams(food, effGrams),
        basis: item.basis,
      };
    }),
  );

  console.log(
    `[resolve] hybrid/local ${tLocal - t0}ms, ground ${Date.now() - tLocal}ms, items ${items.length}, ` +
      `hybrid ${hybridMatches.filter(Boolean).length}, unresolved ${candidates.filter((c) => !c.matched).length}, ` +
      `verify ${candidates.filter((c) => c.needsVerification).length}`,
  );

  const totals = candidates.reduce<MacroTotals>(
    (a, c) =>
      c.macros
        ? {
            kcal: a.kcal + c.macros.kcal,
            proteinG: a.proteinG + c.macros.proteinG,
            carbG: a.carbG + c.macros.carbG,
            fatG: a.fatG + c.macros.fatG,
          }
        : a,
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );

  return { status: 'ok', candidates, totals };
}
