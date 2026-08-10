/**
 * Macro planning maths for the meal builder. PURE: no clock, no DB, no server-only.
 *
 * TWO BUGS IN HER LENUS THAT THIS DELIBERATELY DOES NOT REPRODUCE, both visible in the screenshots
 * she sent:
 *
 *  1. `28.099999999999998 g` of fat. Float arithmetic printed raw. Grams are rounded at the
 *     boundary here so a display can never show binary noise, and a target is stored as the rounded
 *     number so the stored plan and the printed plan agree.
 *
 *  2. A per-meal macro row that does not add up to the daily target. Splitting 151g of carbs across
 *     5 meals gives 30.2 each; rounding every slot independently gives 5 x 30 = 150 and loses a
 *     gram. Here the LAST slot absorbs the remainder, so the column always sums to the target
 *     exactly. A coach who adds up her own plan and finds it short stops trusting the tool, and
 *     she is right to.
 */

export type Macros = { proteinG: number; carbG: number; fatG: number };

/** Atwater factors. Alcohol is deliberately absent: it is not a macro she programmes. */
export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;

export function kcalFromMacros(m: Macros): number {
  return Math.round(m.proteinG * KCAL_PER_G.protein + m.carbG * KCAL_PER_G.carb + m.fatG * KCAL_PER_G.fat);
}

/**
 * Split templates, as percentages of calories.
 *
 * Named for what a coach would say out loud, not for the ratio. These are the four Stephanie's own
 * plans cluster around: her anti-inflammatory protocol is 35/39/23 by calories, which is closest to
 * Balanced, and her recomp plans run protein-forward.
 */
export const SPLIT_TEMPLATES = [
  { key: 'balanced', protein: 30, carb: 40, fat: 30 },
  { key: 'highProtein', protein: 40, carb: 35, fat: 25 },
  { key: 'lowerCarb', protein: 35, carb: 25, fat: 40 },
  { key: 'performance', protein: 25, carb: 50, fat: 25 },
] as const;

export type SplitKey = (typeof SPLIT_TEMPLATES)[number]['key'];

/**
 * Percent split -> grams for a calorie target.
 *
 * Protein and carbs are rounded normally; FAT ABSORBS THE REMAINDER so the grams multiply back to
 * the calorie target instead of landing 3 kcal short. Fat is the right one to carry it because a
 * gram of fat is 9 kcal, so it needs the smallest adjustment to close the gap.
 */
export function splitToGrams(calories: number, split: { protein: number; carb: number; fat: number }): Macros {
  const proteinG = Math.round((calories * (split.protein / 100)) / KCAL_PER_G.protein);
  const carbG = Math.round((calories * (split.carb / 100)) / KCAL_PER_G.carb);
  const spent = proteinG * KCAL_PER_G.protein + carbG * KCAL_PER_G.carb;
  const fatG = Math.max(0, Math.round((calories - spent) / KCAL_PER_G.fat));
  return { proteinG, carbG, fatG };
}

/** Grams -> percent of calories, for showing the split of a hand-typed plan. */
export function gramsToSplit(m: Macros): { protein: number; carb: number; fat: number } {
  const total = kcalFromMacros(m);
  if (total <= 0) return { protein: 0, carb: 0, fat: 0 };
  const protein = Math.round(((m.proteinG * KCAL_PER_G.protein) / total) * 100);
  const carb = Math.round(((m.carbG * KCAL_PER_G.carb) / total) * 100);
  // Same remainder trick, so the three percentages always read 100 rather than 99 or 101.
  return { protein, carb, fat: Math.max(0, 100 - protein - carb) };
}

/**
 * The tolerance band a member is allowed to land in.
 *
 * Strict (1%) is for a competitor peaking; flexible (10%) is for someone who will otherwise give up
 * on a Tuesday. Stephanie's own protocol states "<1600 kcal" against meals summing to 1,555, which
 * is roughly 3%, so the middle of this range is where her real work sits.
 */
export const FLEX_MIN = 1;
export const FLEX_MAX = 10;

export type Range = { min: number; max: number };

export function flexRange(grams: number, flexPct: number): Range {
  const pct = Math.min(FLEX_MAX, Math.max(FLEX_MIN, flexPct));
  const delta = (grams * pct) / 100;
  // Floor/ceil rather than round: a stated range should never be narrower than the tolerance it
  // claims to represent.
  return { min: Math.max(0, Math.floor(grams - delta)), max: Math.ceil(grams + delta) };
}

export type SlotShare = {
  /** 0-100, what share of the day's calories this meal carries. */
  pct: number;
  kcal: number;
  macros: Macros;
};

/**
 * Split a daily target across N meals by percentage share.
 *
 * THE LAST SLOT ABSORBS EVERY REMAINDER, which is the fix for the Lenus bug where a per-meal column
 * does not sum to the daily total. Rounding each slot independently loses grams; carrying the
 * difference into the final meal means the column always adds up exactly.
 */
export function distribute(target: Macros, calories: number, shares: number[]): SlotShare[] {
  if (shares.length === 0) return [];
  const totalShare = shares.reduce((s, n) => s + n, 0) || 1;
  const out: SlotShare[] = [];
  const running = { proteinG: 0, carbG: 0, fatG: 0, kcal: 0 };

  shares.forEach((share, i) => {
    const isLast = i === shares.length - 1;
    const frac = share / totalShare;
    if (isLast) {
      out.push({
        pct: Math.round(frac * 100),
        kcal: Math.max(0, calories - running.kcal),
        macros: {
          proteinG: Math.max(0, target.proteinG - running.proteinG),
          carbG: Math.max(0, target.carbG - running.carbG),
          fatG: Math.max(0, target.fatG - running.fatG),
        },
      });
      return;
    }
    const macros: Macros = {
      proteinG: Math.round(target.proteinG * frac),
      carbG: Math.round(target.carbG * frac),
      fatG: Math.round(target.fatG * frac),
    };
    const kcal = Math.round(calories * frac);
    running.proteinG += macros.proteinG;
    running.carbG += macros.carbG;
    running.fatG += macros.fatG;
    running.kcal += kcal;
    out.push({ pct: Math.round(frac * 100), kcal, macros });
  });

  return out;
}

export type Reconciliation = {
  /** What the slots actually add up to. */
  actual: Macros & { kcal: number };
  /** Signed difference from target: positive means the plan is over. */
  delta: Macros & { kcal: number };
  /** True when every macro is inside the flexibility band. */
  withinTolerance: boolean;
};

/**
 * Does the plan she has built actually hit the target she set?
 *
 * The point of surfacing this is that Lenus does not: a coach can save a plan whose meals do not
 * sum to the header, and nothing tells her. Showing the signed difference makes a discrepancy a
 * decision rather than an accident.
 *
 * CALORIES ARE MEASURED, NOT DERIVED, and this took a failing test to get right. Her own
 * anti-inflammatory protocol is 134P / 151C / 39F and 1,555 kcal. Atwater on those grams gives
 * 1,491, a 64 kcal gap, because both numbers come from food labels and labels round, declare fibre
 * inconsistently, and do not have to agree with 4/4/9. An earlier version of this function computed
 * actual calories FROM the macros, which meant it reported her real protocol as 64 calories wrong.
 *
 * So a slot carries its own kcal alongside its macros, and the two are reconciled independently.
 * Forcing them to agree would be the tool telling a coach her own arithmetic is broken when it is
 * the model that is.
 */
export type SlotTotals = Macros & { kcal: number };

export function reconcile(target: Macros, calories: number, slots: SlotTotals[], flexPct: number): Reconciliation {
  const actual = slots.reduce(
    (a, s) => ({ proteinG: a.proteinG + s.proteinG, carbG: a.carbG + s.carbG, fatG: a.fatG + s.fatG }),
    { proteinG: 0, carbG: 0, fatG: 0 },
  );
  const actualKcal = slots.reduce((a, s) => a + s.kcal, 0);
  const delta = {
    proteinG: actual.proteinG - target.proteinG,
    carbG: actual.carbG - target.carbG,
    fatG: actual.fatG - target.fatG,
    kcal: actualKcal - calories,
  };
  const inBand = (value: number, goal: number): boolean => {
    if (goal <= 0) return value === 0;
    const { min, max } = flexRange(goal, flexPct);
    return value >= min && value <= max;
  };
  return {
    actual: { ...actual, kcal: actualKcal },
    delta,
    withinTolerance:
      inBand(actual.proteinG, target.proteinG) &&
      inBand(actual.carbG, target.carbG) &&
      inBand(actual.fatG, target.fatG),
  };
}
