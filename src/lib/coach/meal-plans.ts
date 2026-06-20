// Meal-plans Library server data layer. One read (joined to contacts for the client name), then
// filter/sort/paginate in memory. Pure types in meal-plans-types.ts (re-exported).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { MealGroupLite, MealPlanDetail, MealPlanFilters, MealPlanRow, MealPlansPage } from '@/lib/coach/meal-plans-types';

export * from '@/lib/coach/meal-plans-types';

type ContactLite = { first_name: string | null; last_name: string | null; email: string | null } | null;
type PlanRaw = {
  id: string;
  name: string;
  calorie_goal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  macro_timing_name: string | null;
  num_meal_groups: number | null;
  split_protein_pct: number | null;
  split_carb_pct: number | null;
  split_fat_pct: number | null;
  plan_jsonb: unknown;
  contact: ContactLite | ContactLite[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function clientName(c: ContactLite): string | null {
  if (!c) return null;
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || null;
}
function mapRow(p: PlanRaw): MealPlanRow {
  return {
    id: p.id,
    name: p.name,
    clientName: clientName(one(p.contact)),
    calorieGoal: p.calorie_goal,
    proteinG: p.protein_g,
    carbG: p.carb_g,
    fatG: p.fat_g,
    macroTiming: p.macro_timing_name,
    numGroups: p.num_meal_groups,
  };
}

const COLS =
  'id, name, calorie_goal, protein_g, carb_g, fat_g, macro_timing_name, num_meal_groups, split_protein_pct, split_carb_pct, split_fat_pct, contact:contacts(first_name, last_name, email)';

export async function getMealPlansPage(companyId: string, filters: MealPlanFilters): Promise<MealPlansPage> {
  const sb = createServiceClient();
  const { data, error } = await sb.from('meal_plans').select(COLS).eq('company_id', companyId).limit(2000);
  if (error) throw new Error(`getMealPlansPage: ${error.message}`);
  const all = ((data ?? []) as unknown as PlanRaw[]).map(mapRow);

  const q = filters.q.toLowerCase();
  const filtered = all.filter((r) => (q ? `${r.name} ${r.clientName ?? ''}`.toLowerCase().includes(q) : true));
  const mul = filters.dir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'calories':
        return ((a.calorieGoal ?? 0) - (b.calorieGoal ?? 0)) * mul;
      case 'name':
        return a.name.localeCompare(b.name) * mul;
      default:
        return (a.clientName ?? '').localeCompare(b.clientName ?? '') * mul;
    }
  });
  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: filtered.slice(start, start + filters.pageSize),
    total: filtered.length,
    page: filters.page,
    pageSize: filters.pageSize,
    totalAll: all.length,
  };
}

export async function getMealPlanDetail(companyId: string, id: string): Promise<MealPlanDetail | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('meal_plans')
    .select(`${COLS}, plan_jsonb`)
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getMealPlanDetail: ${error.message}`);
  if (!data) return null;
  const p = data as unknown as PlanRaw;
  const base = mapRow(p);

  const rawGroups =
    p.plan_jsonb && typeof p.plan_jsonb === 'object' && Array.isArray((p.plan_jsonb as { mealGroups?: unknown }).mealGroups)
      ? ((p.plan_jsonb as { mealGroups: unknown[] }).mealGroups)
      : [];
  const groups: MealGroupLite[] = rawGroups
    .filter((g): g is Record<string, unknown> => g != null && typeof g === 'object')
    .map((g) => ({
      name: typeof g.name === 'string' && g.name ? g.name : '',
      numberOfMeals: typeof g.numberOfMeals === 'number' ? g.numberOfMeals : null,
    }));

  return {
    id: base.id,
    name: base.name,
    clientName: base.clientName,
    calorieGoal: base.calorieGoal,
    proteinG: base.proteinG,
    carbG: base.carbG,
    fatG: base.fatG,
    macroTiming: base.macroTiming,
    numGroups: base.numGroups,
    splitProteinPct: p.split_protein_pct,
    splitCarbPct: p.split_carb_pct,
    splitFatPct: p.split_fat_pct,
    groups,
  };
}
