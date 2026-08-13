// Coach food-diary read model for the client profile Nutrition tab (Lenus parity): the client's
// today totals vs their target, a 7-day daily-calorie series, today's logged entries, and weekly
// adherence (days logged, average kcal). Reads the client's food_log via the service client (the
// requireCoach page authorizes companyId + profileId first). Target resolves meal_plan > onboarding
// > default, matching the subscriber's own diary (src/lib/nutrition/diary.ts).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { localToday } from '@/lib/nutrition/diary';
import { sumMacros, type DiaryEntry, type MacroTotals, type MealSlot } from '@/lib/nutrition/macros';

const DEFAULT_TARGET: MacroTotals = { kcal: 2000, proteinG: 150, carbG: 200, fatG: 67 };

export type CoachDiaryDay = { date: string; kcal: number };
export type CoachDiaryWeek = {
  today: string;
  totals: MacroTotals;
  target: MacroTotals;
  targetSource: 'meal_plan' | 'onboarding' | 'default';
  entries: DiaryEntry[];
  days: CoachDiaryDay[]; // 7 days, oldest -> newest
  loggedDays: number;
  avgKcal: number | null;
};

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

type LogRaw = {
  id: string;
  log_date: string;
  name: string | null;
  meal_slot: string | null;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  source: string;
};

async function resolveTarget(
  sb: ReturnType<typeof createServiceClient>,
  profileId: string,
  companyId: string | null,
): Promise<{ target: MacroTotals; targetSource: CoachDiaryWeek['targetSource'] }> {
  if (companyId) {
    const { data: contact } = await sb.from('contacts').select('id').eq('profile_id', profileId).eq('company_id', companyId).maybeSingle();
    if (contact) {
      const { data: mp } = await sb
        .from('meal_plans')
        .select('calorie_goal, protein_g, carb_g, fat_g')
        .eq('contact_id', (contact as { id: string }).id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const plan = mp as { calorie_goal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null } | null;
      if (plan?.calorie_goal) {
        return {
          target: { kcal: plan.calorie_goal, proteinG: plan.protein_g ?? 0, carbG: plan.carb_g ?? 0, fatG: plan.fat_g ?? 0 },
          targetSource: 'meal_plan',
        };
      }
    }
  }
  const { data: ob } = await sb.from('onboarding_responses').select('computed_targets').eq('profile_id', profileId).maybeSingle();
  const ct = (ob as { computed_targets: { calories?: number; macros?: { protein_g?: number; carbs_g?: number; fat_g?: number } } | null } | null)?.computed_targets;
  if (ct?.calories) {
    return {
      target: { kcal: ct.calories, proteinG: ct.macros?.protein_g ?? 0, carbG: ct.macros?.carbs_g ?? 0, fatG: ct.macros?.fat_g ?? 0 },
      targetSource: 'onboarding',
    };
  }
  return { target: DEFAULT_TARGET, targetSource: 'default' };
}

export async function getCoachFoodDiaryWeek(profileId: string, companyId: string | null, tz: string): Promise<CoachDiaryWeek> {
  const sb = createServiceClient();
  const today = localToday(tz);
  const start = addDays(today, -6);

  // BOTH KEYS. profile_id is set only once a member claims an app account, and every one of the
  // 8,419 entries migrated from Lenus carries contact_id with a null profile. Filtering on
  // profile_id alone made her clients' entire food history invisible on this page, which is the
  // same defect that hid the check-ins and the progress photos.
  const { data: contactRow } = await sb
    .from('contacts')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle<{ id: string }>();
  const scope = contactRow?.id
    ? `profile_id.eq.${profileId},contact_id.eq.${contactRow.id}`
    : `profile_id.eq.${profileId}`;

  const { data } = await sb
    .from('food_log')
    .select('id, log_date, name, meal_slot, grams, kcal, protein_g, carb_g, fat_g, source')
    .or(scope)
    .gte('log_date', start)
    .order('logged_at', { ascending: true });
  const rows = (data ?? []) as LogRaw[];

  const entries: DiaryEntry[] = rows
    .filter((r) => r.log_date === today)
    .map((r) => ({
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

  const byDate: Record<string, number> = {};
  for (const r of rows) byDate[r.log_date] = (byDate[r.log_date] ?? 0) + Number(r.kcal);
  const days: CoachDiaryDay[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    days.push({ date: d, kcal: Math.round(byDate[d] ?? 0) });
  }
  const loggedDays = Object.values(byDate).filter((k) => k > 0).length;
  const totalKcal = Object.values(byDate).reduce((a, b) => a + b, 0);
  const avgKcal = loggedDays ? Math.round(totalKcal / loggedDays) : null;

  const { target, targetSource } = await resolveTarget(sb, profileId, companyId);
  return { today, totals, target, targetSource, entries, days, loggedDays, avgKcal };
}
