// Pure nutrition math + types (client-safe). Per-100g food macros scale by grams; cooked/uncooked
// conversion uses the deterministic USDA-seeded ratios, never an estimate.

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type FoodLite = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  densityGPerMl: number | null;
};

export type FoodPortion = { id: string; label: string; grams: number; isCooked: boolean; isDefault: boolean };

export type DiaryEntry = {
  id: string;
  name: string;
  mealSlot: MealSlot | null;
  grams: number | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  source: string;
};

export type MacroTotals = { kcal: number; proteinG: number; carbG: number; fatG: number };

export type DiaryDay = {
  date: string;
  entries: DiaryEntry[];
  totals: MacroTotals;
  target: MacroTotals | null;
  targetSource: 'meal_plan' | 'onboarding' | 'default' | null;
};

export const ZERO: MacroTotals = { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };

// Macros for a given gram amount of a per-100g food.
export function macrosForGrams(food: Pick<FoodLite, 'kcal' | 'proteinG' | 'carbG' | 'fatG'>, grams: number): MacroTotals {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcal * k),
    proteinG: Math.round(food.proteinG * k),
    carbG: Math.round(food.carbG * k),
    fatG: Math.round(food.fatG * k),
  };
}

// Human amount ("1 cup", "8 fl oz") -> grams. Volume units use the food's density (g/mL), defaulting
// to water (1 g/mL) when unknown, so "1 cup of juice" logs a sane weight. `oz` here is the WEIGHT
// ounce; fluid volume is `floz`. Everything downstream (macrosForGrams, the log) works in grams.
export type ServingUnit = 'g' | 'oz' | 'ml' | 'floz' | 'cup' | 'tbsp';
export const SERVING_UNITS: ServingUnit[] = ['g', 'oz', 'ml', 'floz', 'cup', 'tbsp'];
const ML_PER_UNIT: Record<'ml' | 'floz' | 'cup' | 'tbsp', number> = {
  ml: 1,
  floz: 29.5735,
  cup: 240,
  tbsp: 14.7868,
};

export function gramsFromAmount(qty: number, unit: ServingUnit, densityGPerMl: number | null): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (unit === 'g') return qty;
  if (unit === 'oz') return qty * 28.3495; // weight ounce
  const d = densityGPerMl && densityGPerMl > 0 ? densityGPerMl : 1;
  return Math.round(qty * ML_PER_UNIT[unit] * d);
}

// A gentle, goal-aware 1-10 "how well today fits your plan" score. Rewards protein adherence and
// staying in the calorie budget; never shaming (bounded, positive; the UI colors it accent/neutral,
// never alert). Returns null when there's nothing to score yet (no target or nothing logged).
export function dayScore(consumed: MacroTotals, target: MacroTotals): number | null {
  if (target.kcal <= 0 || consumed.kcal <= 0) return null;
  const proteinRatio = target.proteinG > 0 ? consumed.proteinG / target.proteinG : 1;
  const kcalRatio = consumed.kcal / target.kcal;
  let s = 6;
  s += Math.min(1, proteinRatio) * 3; // up to +3 for hitting protein (the biggest lever for the goal)
  if (kcalRatio <= 1.05) s += 1; // on or under target
  else s -= Math.min(3, (kcalRatio - 1.05) * 8); // over budget, gently
  return Math.max(1, Math.min(10, Math.round(s)));
}

export function sumMacros(rows: MacroTotals[]): MacroTotals {
  return rows.reduce(
    (a, r) => ({ kcal: a.kcal + r.kcal, proteinG: a.proteinG + r.proteinG, carbG: a.carbG + r.carbG, fatG: a.fatG + r.fatG }),
    { ...ZERO },
  );
}

// Convert a weight between raw and cooked using a deterministic yield factor (cooked = raw * factor).
export function convertCookedRaw(grams: number, factor: number, to: 'cooked' | 'raw'): number {
  return Math.round(to === 'cooked' ? grams * factor : grams / factor);
}

export type FoodState = 'raw' | 'cooked';

// Infer whether a food row's macros are stated for the raw or cooked form, from its name (EN/ES).
//
// Returning null is a REAL answer, not a failure: it means the raw/cooked distinction does not apply
// to this food, so the diary hides the conversion toggle. That is correct for prepared and packaged
// items. A bagel, a tortilla, protein powder and canned beans all sit in categories that HAVE a yield
// factor, but applying one would be badly wrong (the grain factor is 3.0, so a "raw" bagel would
// triple). Only widen the vocabulary below with words that genuinely describe a cooking transform.
//
// The cooked list covers method words, not just the literal "cooked", because a food library names
// things the way a person would: "Chicken breast, grilled", "Rotisserie chicken", "Turkey breast,
// roasted". Those were being missed, so a member weighing raw chicken got no way to convert.
//
// Word boundaries matter here: \b keeps "refried" (already-prepared beans) from matching "fried".
export function foodStateFromName(name: string): FoodState | null {
  const n = name.toLowerCase();
  if (/\b(raw|dry|crud|cruda|crudo|seca|seco)\b/.test(n)) return 'raw';
  if (
    /\b(cooked|cocid|cocida|cocido|grilled|roasted|rotisserie|baked|boiled|steamed|fried|braised|sauteed|sautéed|seared|poached|asado|asada|horneado|horneada|hervido|hervida|plancha|frito|frita|salteado|salteada|vapor)\b/.test(
      n,
    )
  ) {
    return 'cooked';
  }
  return null;
}

// Convert the weight the user actually measured into the grams of the food's stated state, so the
// per-100g macros apply correctly. factor = raw->cooked weight multiplier (cooked = raw * factor).
export function effectiveGrams(entered: number, weighed: FoodState, listed: FoodState, factor: number): number {
  if (weighed === listed || factor <= 0) return entered;
  if (listed === 'cooked' && weighed === 'raw') return Math.round(entered * factor);
  if (listed === 'raw' && weighed === 'cooked') return Math.round(entered / factor);
  return entered;
}
