// Pure, client-safe types + parsing for the meal-plans Library. Re-exported by meal-plans.ts.
import type { StructuredPlan } from '@/lib/coach/meal-plan-structured';

export type MealPlanSort = 'name' | 'calories' | 'client';

export type MealPlanFilters = {
  q: string;
  sort: MealPlanSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export type MealPlanRow = {
  id: string;
  name: string;
  clientName: string | null;
  calorieGoal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  macroTiming: string | null;
  numGroups: number | null;
};

export type MealGroupLite = { name: string; numberOfMeals: number | null };

export type MealPlanDetail = MealPlanRow & {
  splitProteinPct: number | null;
  splitCarbPct: number | null;
  splitFatPct: number | null;
  groups: MealGroupLite[];
  notes: string | null;
  // The full structured plan (slots -> recipes) when the plan was built/generated in-app; null for
  // legacy Lenus imports, which fall back to `groups`.
  structured: StructuredPlan | null;
};

export type MealPlansPage = { rows: MealPlanRow[]; total: number; page: number; pageSize: number; totalAll: number };

const SORTS: readonly MealPlanSort[] = ['name', 'calories', 'client'];

export function parseMealPlanFilters(raw: Record<string, string | string[] | undefined>): MealPlanFilters {
  const sortRaw = typeof raw.sort === 'string' ? raw.sort : '';
  return {
    q: typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : '',
    sort: SORTS.includes(sortRaw as MealPlanSort) ? (sortRaw as MealPlanSort) : 'client',
    dir: raw.dir === 'desc' ? 'desc' : 'asc',
    page: Math.max(1, Math.floor(Number(raw.page)) || 1),
    pageSize: Math.min(100, Math.max(20, Math.floor(Number(raw.pageSize)) || 50)),
  };
}
