// Food diary read layer (server). Owner-scoped food_log via RLS; daily target derived from the
// client's most recent meal plan (service-side lookup) falling back to a sensible default.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { localDay } from '@/lib/datetime/local-day';
import { type DiaryDay, type DiaryEntry, type MacroTotals, type MealSlot, sumMacros } from '@/lib/nutrition/macros';

const DEFAULT_TARGET: MacroTotals = { kcal: 2000, proteinG: 150, carbG: 200, fatG: 67 };

type LogRaw = {
  id: string;
  name: string | null;
  meal_slot: string | null;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  source: string;
};

/**
 * The user's LOCAL calendar day (YYYY-MM-DD) for their timezone. Replaces the old UTC todayIso():
 * a US/LATAM evening logger must see the right diary day, not tomorrow's empty one.
 */
export function localToday(timeZone: string | null | undefined): string {
  return localDay(timeZone);
}

export async function getDiary(userId: string, companyId: string | null, date: string): Promise<DiaryDay> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('food_log')
    .select('id, name, meal_slot, grams, kcal, protein_g, carb_g, fat_g, source')
    .eq('profile_id', userId)
    .eq('log_date', date)
    .order('logged_at', { ascending: true });
  if (error) throw new Error(`getDiary: ${error.message}`);
  const entries: DiaryEntry[] = ((data ?? []) as LogRaw[]).map((r) => ({
    id: r.id,
    name: r.name ?? 'Food',
    mealSlot: (r.meal_slot as MealSlot) ?? null,
    grams: r.grams != null ? Number(r.grams) : null,
    kcal: Number(r.kcal),
    proteinG: Number(r.protein_g),
    carbG: Number(r.carb_g),
    fatG: Number(r.fat_g),
    source: r.source,
  }));
  const totals = sumMacros(entries);

  let target: MacroTotals = DEFAULT_TARGET;
  let targetSource: DiaryDay['targetSource'] = 'default';
  if (companyId) {
    const svc = createServiceClient();
    const { data: contact } = await svc.from('contacts').select('id').eq('profile_id', userId).eq('company_id', companyId).maybeSingle();
    if (contact) {
      const { data: mp } = await svc
        .from('meal_plans')
        .select('calorie_goal, protein_g, carb_g, fat_g')
        .eq('contact_id', (contact as { id: string }).id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const plan = mp as { calorie_goal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null } | null;
      if (plan?.calorie_goal) {
        target = { kcal: plan.calorie_goal, proteinG: plan.protein_g ?? 0, carbG: plan.carb_g ?? 0, fatG: plan.fat_g ?? 0 };
        targetSource = 'meal_plan';
      }
    }
  }

  return { date, entries, totals, target, targetSource };
}
