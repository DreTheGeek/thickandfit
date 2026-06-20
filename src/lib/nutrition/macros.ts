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
  targetSource: 'meal_plan' | 'default' | null;
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
export function foodStateFromName(name: string): FoodState | null {
  const n = name.toLowerCase();
  if (/\b(raw|dry|crud|seca|seco)\b/.test(n)) return 'raw';
  if (/\b(cooked|cocid|cocida)\b/.test(n)) return 'cooked';
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
