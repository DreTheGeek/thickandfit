// Pure scoring for the smart-scan eval harness: no server-only, no IO, deterministic. Grades one
// case's prediction against its human label with food-ID F1 (token-set match, bilingual stopwords
// mirroring the resolve pipeline's philosophy in photo.ts) + portion MAPE over matched pairs.
// Thresholds are module constants so tuning is one diff.

export type ExpectedItem = { name: string; grams: number; fat_g?: number };
export type ExpectedCase = {
  kind: 'meal' | 'product';
  items: ExpectedItem[];
  /**
   * Whole-plate label fat. Oily plates are exactly where per-item attribution is hardest (how much
   * of the pan oil ended up on the chicken vs the vegetables is not knowable), so a plate-level
   * number is often the only honest label. Takes precedence over summing per-item fat_g.
   */
  total_fat_g?: number;
  /** Whether oil was visibly used, so the report can split oil plates from dry plates. */
  oil_used?: boolean;
};
export type PredictedEvalItem = {
  name: string;
  grams: number;
  confidence: number;
  /**
   * Resolved fat grams for this predicted item, scaled to its predicted portion. Supplied by the
   * RUNNER, which owns the foods-corpus lookup: resolution is IO, and this module stays pure so it
   * can be reasoned about and unit-tested without a database.
   */
  fatG?: number | null;
};

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
  /**
   * SIGNED fat error in grams: predicted total fat minus expected total fat. Null when the case
   * carries no fat label.
   *
   * Signed, not absolute, on purpose. The July 2026 NIH/NIDDK controlled-kitchen result is that
   * every tested competitor UNDERESTIMATES by ~250-345 kcal/meal, driven by ~30g/meal of invisible
   * fat (oil, butter, dressing). That is a directional bias, not noise, and an absolute error like
   * MAPE would average a -20g miss and a +20g miss into "fine". The direction IS the finding.
   */
  fatBiasG: number | null;
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
  return {
    passed,
    score,
    kindMatch,
    f1: Math.round(f1 * 1000) / 1000,
    matchedPairs: pairs,
    mape,
    fatBiasG: fatBias(expected, predicted),
  };
}

/**
 * Signed fat error for a case, or null when it carries no fat label.
 *
 * Deliberately NOT part of `passed` or `score`. A baseline has to exist before a bar can be set,
 * and tuning a threshold in the same change that introduces the metric means neither number can be
 * trusted afterwards. This reports; a later PRD decides what is acceptable.
 *
 * Uses ALL predicted items, not just matched pairs: predicted cooking oil usually has no label to
 * match against, and excluding it would erase exactly the correction the prompt was written to make.
 */
export function fatBias(expected: ExpectedCase, predicted: PredictedEvalItem[]): number | null {
  const expectedFat =
    typeof expected.total_fat_g === 'number'
      ? expected.total_fat_g
      : expected.items.some((it) => typeof it.fat_g === 'number')
        ? expected.items.reduce((a, it) => a + (typeof it.fat_g === 'number' ? it.fat_g : 0), 0)
        : null;
  if (expectedFat === null) return null;

  // A case labeled with fat but whose predictions carry no resolved macros cannot be scored: 0
  // would read as "predicted no fat at all", which is a measurement gap masquerading as a finding.
  if (!predicted.some((p) => typeof p.fatG === 'number')) return null;

  const predictedFat = predicted.reduce((a, p) => a + (typeof p.fatG === 'number' ? p.fatG : 0), 0);
  return Math.round((predictedFat - expectedFat) * 10) / 10;
}
