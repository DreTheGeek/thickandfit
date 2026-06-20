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
