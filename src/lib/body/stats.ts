// Body-progress read model for the /progress "Body" tab: the weight trend series, the goal band,
// the latest measurement per site (with change since the first entry), and a trailing 4-week rollup
// (workouts trained, nutrition days logged, weight moved). Reads the caller's own rows via the
// session client (RLS scopes to profile_id = auth.uid()); nothing here is trusted from the client.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { localToday } from '@/lib/nutrition/diary';
import {
  MEASURE_FIELDS,
  type BodyStats,
  type MeasureField,
  type MeasureStat,
  type WeekRollup,
  type WeightPoint,
} from '@/lib/body/types';

export type { BodyStats, MeasureField, MeasureStat, WeekRollup, WeightPoint };

const KG_TO_LB = 2.20462;

const FIELD_COLUMN: Record<MeasureField, string> = {
  waist: 'waist_cm',
  hips: 'hips_cm',
  chest: 'chest_cm',
  arms: 'arms_cm',
  thighs: 'thighs_cm',
  bodyFat: 'body_fat_pct',
};

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const lbOf = (kg: number): number => Math.round(kg * KG_TO_LB * 10) / 10;

type WeightRow = { weight_kg: number; recorded_on: string };
type MeasureRow = Record<string, number | string | null> & { recorded_on: string };

export async function getBodyStats(userId: string, tz: string): Promise<BodyStats> {
  const sb = await createClient();
  const today = localToday(tz);
  const windowStart = addDays(today, -89); // 90-day chart + covers the 28-day rollup lookback

  const [{ data: weights }, { data: onb }, { data: measures }, { data: workouts }, { data: meals }] =
    await Promise.all([
      sb
        .from('weight_entries')
        .select('weight_kg, recorded_on')
        .eq('profile_id', userId)
        .gte('recorded_on', windowStart)
        .order('recorded_on', { ascending: true }),
      sb.from('onboarding_responses').select('answers').eq('profile_id', userId).maybeSingle(),
      sb
        .from('body_measurements')
        .select('recorded_on, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, body_fat_pct')
        .eq('profile_id', userId)
        .order('recorded_on', { ascending: true }),
      sb
        .from('workout_logs')
        .select('performed_at')
        .eq('profile_id', userId)
        .gte('performed_at', `${addDays(today, -27)}T00:00:00Z`),
      sb
        .from('food_log')
        .select('log_date')
        .eq('profile_id', userId)
        .gte('log_date', addDays(today, -27)),
    ]);

  const weightRows = (weights ?? []) as WeightRow[];
  const weightSeries: WeightPoint[] = weightRows.map((w) => ({
    on: w.recorded_on,
    lb: lbOf(Number(w.weight_kg)),
  }));

  const answers = (onb?.answers ?? null) as { weightKg?: number; goalWeightKg?: number } | null;
  const goalLb = answers?.goalWeightKg ? Math.round(answers.goalWeightKg * KG_TO_LB) : null;
  const onbStartLb = answers?.weightKg ? Math.round(answers.weightKg * KG_TO_LB) : null;
  const startLb = weightSeries[0]?.lb ?? onbStartLb;
  const currentLb = weightSeries[weightSeries.length - 1]?.lb ?? onbStartLb;

  // Measurements: first + latest non-null per site -> change since the start.
  const measureRows = (measures ?? []) as MeasureRow[];
  const measurements: MeasureStat[] = MEASURE_FIELDS.map((field) => {
    const col = FIELD_COLUMN[field];
    let first: number | null = null;
    let latest: number | null = null;
    let recordedOn: string | null = null;
    for (const row of measureRows) {
      const raw = row[col];
      if (raw === null || raw === undefined) continue;
      const val = Number(raw);
      if (first === null) first = val;
      latest = val;
      recordedOn = row.recorded_on;
    }
    const delta = first !== null && latest !== null ? Math.round((latest - first) * 10) / 10 : null;
    return { field, latest, first, delta, recordedOn };
  });

  // Trailing 4 weeks, most recent first. Workouts bucketed by performed_at date; nutrition days by
  // distinct local log_date; weight moved via carry-forward (last entry on/before each boundary).
  const workoutDates = (workouts ?? []).map((w) => String(w.performed_at).slice(0, 10));
  const mealDates = (meals ?? []).map((m) => String(m.log_date).slice(0, 10));
  const weightOnOrBefore = (dateStr: string): number | null => {
    let val: number | null = null;
    for (const w of weightSeries) {
      if (w.on <= dateStr) val = w.lb;
      else break;
    }
    return val;
  };

  const rollups: WeekRollup[] = [];
  for (let i = 0; i < 4; i++) {
    const endOn = addDays(today, -7 * i);
    const startOn = addDays(endOn, -6);
    const workoutsInWeek = workoutDates.filter((d) => d >= startOn && d <= endOn).length;
    const daysLogged = new Set(mealDates.filter((d) => d >= startOn && d <= endOn)).size;
    const endWeight = weightOnOrBefore(endOn);
    const startWeight = weightOnOrBefore(addDays(startOn, -1));
    const weightDeltaLb =
      endWeight !== null && startWeight !== null ? Math.round((endWeight - startWeight) * 10) / 10 : null;
    rollups.push({ startOn, endOn, workouts: workoutsInWeek, daysLogged, weightDeltaLb });
  }

  return { weightSeries, goalLb, startLb, currentLb, measurements, rollups };
}
