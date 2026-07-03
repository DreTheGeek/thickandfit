// Pure scoring for the smart-scan eval harness: no server-only, no IO, deterministic. Grades one
// case's prediction against its human label with food-ID F1 (token-set match, bilingual stopwords
// mirroring the resolve pipeline's philosophy in photo.ts) + portion MAPE over matched pairs.
// Thresholds are module constants so tuning is one diff.

export type ExpectedItem = { name: string; grams: number };
export type ExpectedCase = { kind: 'meal' | 'product'; items: ExpectedItem[] };
export type PredictedEvalItem = { name: string; grams: number; confidence: number };

export type MatchedPair = {
  expected: string;
  predicted: string;
  expectedGrams: number;
  predictedGrams: number;
};

export type CaseScore = {
  passed: boolean;
  score: number; // 0-100 composite int for ai_eval_runs.score
  kindMatch: boolean;
  f1: number; // food-ID detection F1 over expected vs predicted item sets
  matchedPairs: MatchedPair[];
  mape: number | null; // mean absolute portion error over matched pairs; null with no matches
};

// Pass bars: kind right, most foods found (F1 >= 0.6), portions within 40% on average.
export const PASS_F1 = 0.6;
export const PASS_MAPE = 0.4;
// Composite: food-ID is weighted over portion accuracy (a missed food is worse than a loose portion).
export const WEIGHT_F1 = 0.6;
export const WEIGHT_PORTION = 0.4;
// Minimum token overlap (Jaccard) for two names to count as the same food.
const MIN_JACCARD = 0.2;

const STOP = new Set([
  'cooked', 'raw', 'dry', 'fresh', 'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed',
  'cocido', 'cocida', 'crudo', 'cruda', 'seco', 'seca', 'a', 'de', 'la', 'el', 'and', 'with', 'con', 'of',
]);

// Light singularization so "breadsticks" matches "breadstick" and "tortillas" matches "tortilla".
// Deliberately minimal English/Spanish plural stripping (no stemming library: deterministic + pure).
function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`; // berries -> berry
  if (w.length > 3 && w.endsWith('es') && !w.endsWith('ees')) return w.slice(0, -2); // tomatoes -> tomato
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1); // eggs -> egg
  return w;
}

export function normalizeFoodName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents so "platano" matches "plátano"
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(singular);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

// Greedy best-pair matching: highest token-Jaccard first, one match per item on each side,
// requiring at least one shared significant token (MIN_JACCARD floor).
export function matchItems(
  expected: ExpectedItem[],
  predicted: PredictedEvalItem[],
): MatchedPair[] {
  const candidates: { e: number; p: number; sim: number }[] = [];
  const eTokens = expected.map((it) => normalizeFoodName(it.name));
  const pTokens = predicted.map((it) => normalizeFoodName(it.name));
  for (let e = 0; e < expected.length; e++) {
    for (let p = 0; p < predicted.length; p++) {
      const sim = jaccard(eTokens[e], pTokens[p]);
      if (sim >= MIN_JACCARD) candidates.push({ e, p, sim });
    }
  }
  candidates.sort((a, b) => b.sim - a.sim);
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs: MatchedPair[] = [];
  for (const c of candidates) {
    if (usedE.has(c.e) || usedP.has(c.p)) continue;
    usedE.add(c.e);
    usedP.add(c.p);
    pairs.push({
      expected: expected[c.e].name,
      predicted: predicted[c.p].name,
      expectedGrams: expected[c.e].grams,
      predictedGrams: predicted[c.p].grams,
    });
  }
  return pairs;
}

export function scoreCase(
  expected: ExpectedCase,
  actualKind: 'meal' | 'product' | 'other',
  predicted: PredictedEvalItem[],
): CaseScore {
  const kindMatch = expected.kind === actualKind;
  const pairs = kindMatch ? matchItems(expected.items, predicted) : [];
  // The scan prompt REQUIRES a hidden "cooking oil" item on pan-fried/roasted plates. Labels rarely
  // include it, so an unmatched predicted cooking-oil must not count as a false positive (that would
  // double-punish mandated behavior). It still matches normally when the label DOES include oil.
  const matchedPredicted = new Set(pairs.map((p) => p.predicted));
  const effectivePredicted = predicted.filter(
    (p) => matchedPredicted.has(p.name) || !/\b(cooking |)oil\b/i.test(p.name),
  );
  const precision = effectivePredicted.length ? pairs.length / effectivePredicted.length : 0;
  const recall = expected.items.length ? pairs.length / expected.items.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const mape = pairs.length
    ? pairs.reduce(
        (a, p) => a + Math.abs(p.predictedGrams - p.expectedGrams) / Math.max(1, p.expectedGrams),
        0,
      ) / pairs.length
    : null;
  const passed = kindMatch && f1 >= PASS_F1 && (mape === null || mape <= PASS_MAPE);
  const score = Math.round(
    100 * (WEIGHT_F1 * f1 + WEIGHT_PORTION * (1 - Math.min(1, mape ?? 1))),
  );
  return { passed, score, kindMatch, f1: Math.round(f1 * 1000) / 1000, matchedPairs: pairs, mape };
}
