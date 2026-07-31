// K4: population-level portion bias. PURE math, no DB, no `@/` imports, so it is unit-testable on
// its own (see .qa-visual/population-bias-test.mjs).
//
// WHAT THIS IS FOR. K1 already feeds each member their OWN past corrections, so the scan gets better
// for you as you correct it. That does nothing for a member on day one, and it never notices that
// EVERY member under-reports the same food. If 40 people all correct "white rice" upward by ~35%,
// that is not 40 personal quirks, it is the model being wrong about rice, and every future scan of
// rice by anyone should start from that knowledge.
//
// This is the difference between per-person memory and a system that compounds. It is also the thing
// that only works with real traffic, which is exactly what a beta produces.
//
// SAFETY PROPERTIES, because a wrong population prior poisons EVERY member at once rather than one:
//   * MEDIAN, never mean. One member logging a 5000g bowl cannot move the number.
//   * A distinct-member floor. Eight corrections from one enthusiastic tester is that tester's bias,
//     not the population's, and it must never be promoted to a global rule.
//   * A clamp. Even with perfect evidence the prior may only nudge, never rewrite the estimate.
//   * Anonymous by construction: the output carries a food name and aggregate numbers. No profile
//     ids, no per-member rows, nothing that could identify who corrected what.

/** One member's edit to one predicted item, the raw input to the aggregate. */
export type BiasSample = {
  /** Normalized food name the model predicted. */
  food: string;
  /** Grams the model predicted. */
  predictedGrams: number;
  /** Grams the member actually logged. */
  correctedGrams: number;
  /** Who made the edit. Used ONLY to count distinct members; never stored on the output. */
  profileId: string;
};

export type BiasRow = {
  food: string;
  /** correctedGrams / predictedGrams, median across samples. >1 means the model UNDER-estimates. */
  ratio: number;
  samples: number;
  members: number;
};

/** Below this many samples the number is noise. */
export const MIN_SAMPLES = 6;
/** ...and they must come from at least this many DIFFERENT members, or it is one person's habit. */
export const MIN_MEMBERS = 3;
/** A prior may nudge the estimate, never rewrite it. 0.5x-2.0x is already a large correction. */
export const MIN_RATIO = 0.5;
export const MAX_RATIO = 2.0;
/** Ignore ratios this close to 1: a 10% median drift is not worth a prompt line. */
export const MIN_DEVIATION = 0.12;

/** Lowercase + collapse whitespace so "White Rice" and "white  rice" aggregate together. */
export function normalizeFoodKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Roll raw edits up into per-food priors, dropping everything that does not clear the floors.
 *
 * Returned rows are the ONLY thing that should ever reach a prompt. Everything filtered out here is
 * filtered out for a reason, and callers must not "helpfully" fall back to the raw samples.
 */
export function aggregateBias(samples: BiasSample[]): BiasRow[] {
  const byFood = new Map<string, { ratios: number[]; members: Set<string> }>();

  for (const s of samples) {
    const food = normalizeFoodKey(s.food);
    if (!food) continue;
    const p = Number(s.predictedGrams);
    const c = Number(s.correctedGrams);
    if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= 0) continue;
    const ratio = c / p;
    // Drop absurd edits before they reach the median. A 20x ratio is a member fixing a
    // misidentification (the model said "almonds", they logged a whole meal), not a portion signal.
    if (ratio < 0.1 || ratio > 10) continue;
    const entry = byFood.get(food) ?? { ratios: [], members: new Set<string>() };
    entry.ratios.push(ratio);
    entry.members.add(s.profileId);
    byFood.set(food, entry);
  }

  const out: BiasRow[] = [];
  for (const [food, e] of byFood) {
    if (e.ratios.length < MIN_SAMPLES) continue;
    if (e.members.size < MIN_MEMBERS) continue;
    const raw = median(e.ratios);
    if (Math.abs(raw - 1) < MIN_DEVIATION) continue; // model is already close enough on this food
    const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw));
    out.push({ food, ratio: Math.round(ratio * 100) / 100, samples: e.ratios.length, members: e.members.size });
  }
  // Strongest signal first: the caller takes a small top-N into the prompt.
  return out.sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
}

/**
 * Render priors as a prompt addendum. Returns null when there is nothing worth saying, so a
 * fresh install adds zero tokens and a ctx-less eval run is completely unaffected.
 *
 * Phrased as a correction to apply to ITS OWN estimate rather than a target weight, because the
 * photo is still the evidence. The model must not read "rice is 180g" and stop looking at the plate.
 */
export function renderPopulationBiasForPrompt(rows: BiasRow[], limit = 6): string | null {
  const top = rows.slice(0, limit);
  if (top.length === 0) return null;
  const lines = [
    'MEASURED PORTION BIAS (aggregated across many members correcting this engine; apply only when the photo is consistent with it):',
  ];
  for (const r of top) {
    const pct = Math.round(Math.abs(r.ratio - 1) * 100);
    const dir = r.ratio > 1 ? 'UNDER-estimates' : 'OVER-estimates';
    lines.push(`  - "${r.food}": this engine ${dir} by ~${pct}% (n=${r.samples}). Adjust your own estimate accordingly.`);
  }
  return lines.join('\n');
}
