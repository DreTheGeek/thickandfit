import 'server-only';
// K3 computation: build ONE user_state snapshot for a single member from the signals already
// captured across the app. No new AI calls; deterministic aggregation. Runs nightly by the
// tf-materialize-user-state-nightly cron and (later) can be triggered on-demand from a coach action.
//
// Signal sources:
//   * onboarding_responses    → goal_type, primary goal, target kcal + protein, starting/goal weight
//   * weight_entries          → current weight + 7d/30d trends
//   * food_log                → 30d avg kcal + protein, logging days
//   * workout_logs            → 30d workout days + training days per week
//   * favorite foods          → same shape/method as scan-context (K1), so both stay coherent
//   * fetchScanQuality        → the scan-quality rollup (correction rate, portion error, top edits)
//
// Idempotent: upserts on (company_id, profile_id) so re-running the cron replaces yesterday's row.
import { createServiceClient } from '@/lib/supabase/service';
import { fetchScanQuality } from '@/lib/coach-ai/scan-quality';

const KG_TO_LB = 2.20462;
const WINDOW_DAYS = 30;
const WINDOW_7_DAYS = 7;
const FAV_LIMIT = 5;

export type ComputeResult = {
  status: 'ok' | 'noOnboarding' | 'error';
  profileId: string;
  error?: string;
};

type OnboardingRow = {
  answers: { weightKg?: number; goalWeightKg?: number; goal?: string } | null;
  goal_type: string | null;
  // The shape actually written by src/lib/onboarding/prediction.ts: `calories` (not kcal) and
  // `macros.protein_g` (not proteinG). Also carries bmr/tdee/weeklyKg/curve — grabbing only what
  // K3 surfaces today. If prediction.ts's shape ever changes, adjust here in ONE place.
  computed_targets:
    | { calories?: number; macros?: { protein_g?: number; carbs_g?: number; fat_g?: number } }
    | null;
};

type WeightRow = { weight_kg: number; recorded_on: string };

type FoodLogRow = { grams: number | null; kcal: number | null; protein_g: number | null; log_date: string; foods: { name_en: string | null; name_es: string | null }[] | null };

type WorkoutRow = { performed_at: string };

/**
 * Compute + upsert the user_state row for one member. Returns 'noOnboarding' when the member hasn't
 * completed onboarding yet (no targets to compare against — a pre-onboarding snapshot is misleading,
 * so skip; the row is created on their FIRST post-onboarding materialize).
 */
export async function computeUserState(profileId: string, companyId: string): Promise<ComputeResult> {
  const sb = createServiceClient();
  const now = new Date();
  const since30Iso = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const since7Iso = new Date(now.getTime() - WINDOW_7_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [onbRes, weightsRes, foodRes, workoutRes] = await Promise.all([
    sb
      .from('onboarding_responses')
      .select('answers, goal_type, computed_targets')
      .eq('profile_id', profileId)
      .maybeSingle(),
    // Last 40 weigh-ins is enough headroom to bracket both 7d and 30d windows for any real cadence.
    sb
      .from('weight_entries')
      .select('weight_kg, recorded_on')
      .eq('profile_id', profileId)
      .order('recorded_on', { ascending: false })
      .limit(40),
    // Last 500 logs bounds the aggregation; a hyper-tracker still gives us the 30-day picture.
    sb
      .from('food_log')
      .select('grams, kcal, protein_g, log_date, foods(name_en, name_es)')
      .eq('profile_id', profileId)
      .gte('log_date', since30Iso.slice(0, 10))
      .limit(500),
    sb
      .from('workout_logs')
      .select('performed_at')
      .eq('profile_id', profileId)
      .gte('performed_at', since30Iso)
      .limit(500),
  ]);

  const onb = (onbRes.data ?? null) as OnboardingRow | null;
  if (!onb) return { status: 'noOnboarding', profileId };

  const answers = onb.answers ?? {};
  const targets = onb.computed_targets ?? {};

  // Weight — trends are simple end-vs-earlier deltas over the window (negative = weight lost).
  const weights = (weightsRes.data ?? []) as WeightRow[];
  const currentKg = weights[0]?.weight_kg ?? null;
  const w7 = weights.find((w) => new Date(w.recorded_on).getTime() <= new Date(since7Iso).getTime());
  const w30 = weights.find((w) => new Date(w.recorded_on).getTime() <= new Date(since30Iso).getTime());
  const trend7 = currentKg != null && w7 ? Number(currentKg) - Number(w7.weight_kg) : null;
  const trend30 = currentKg != null && w30 ? Number(currentKg) - Number(w30.weight_kg) : null;

  // Food logs — 30d rollup + top habits (same aggregation as scan-context so K1 and K3 agree).
  const foodRows = (foodRes.data ?? []) as FoodLogRow[];
  const loggingDaySet = new Set<string>();
  let sumKcal = 0;
  let sumProtein = 0;
  const habitMap = new Map<string, { count: number; sumGrams: number }>();
  for (const r of foodRows) {
    if (r.log_date) loggingDaySet.add(r.log_date);
    if (r.kcal != null) sumKcal += Number(r.kcal);
    if (r.protein_g != null) sumProtein += Number(r.protein_g);
    const food = r.foods?.[0];
    const name = (food?.name_en ?? food?.name_es ?? '').trim().toLowerCase();
    const grams = Number(r.grams ?? 0);
    if (!name || !Number.isFinite(grams) || grams <= 0) continue;
    const prev = habitMap.get(name) ?? { count: 0, sumGrams: 0 };
    prev.count += 1;
    prev.sumGrams += grams;
    habitMap.set(name, prev);
  }
  const loggingDays = loggingDaySet.size;
  const avgKcal = loggingDays > 0 ? sumKcal / loggingDays : null;
  const avgProtein = loggingDays > 0 ? sumProtein / loggingDays : null;
  const favoriteFoods = Array.from(habitMap.entries())
    .map(([name, agg]) => ({ name, count: agg.count, avg_grams: Math.round(agg.sumGrams / agg.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, FAV_LIMIT);

  // Workouts — days with any workout in the window.
  const workoutRows = (workoutRes.data ?? []) as WorkoutRow[];
  const workoutDaySet = new Set<string>();
  for (const w of workoutRows) {
    if (w.performed_at) workoutDaySet.add(w.performed_at.slice(0, 10));
  }
  const workoutDays30 = workoutDaySet.size;
  const trainingPerWeek = Math.round((workoutDays30 / WINDOW_DAYS) * 7 * 10) / 10;

  // Adherence: what percentage of the target did the member hit on average, over LOGGING days. If
  // they didn't log at all, adherence is unknown (null), not zero — a zero would misread "quiet" as
  // "failed target." Capped at 300% by the DB check constraint.
  const targetKcal = typeof targets.calories === 'number' ? Math.round(targets.calories) : null;
  const targetProtein =
    typeof targets.macros?.protein_g === 'number' ? Math.round(targets.macros.protein_g) : null;
  const kcalAdherence = avgKcal != null && targetKcal != null && targetKcal > 0
    ? Math.min(300, Math.round((avgKcal / targetKcal) * 100))
    : null;
  const proteinAdherence = avgProtein != null && targetProtein != null && targetProtein > 0
    ? Math.min(300, Math.round((avgProtein / targetProtein) * 100))
    : null;

  // Scan quality (K1 also uses this signal indirectly via ai_inferences.correction, but the
  // packaged rollup lives here so any surface can read the full picture in one column).
  let scanQuality: unknown = null;
  try {
    scanQuality = await fetchScanQuality(sb, profileId, since30Iso);
  } catch (e) {
    console.error('user-state fetchScanQuality:', e instanceof Error ? e.message : e);
  }

  const patch: Record<string, unknown> = {
    company_id: companyId,
    profile_id: profileId,
    goal_type: onb.goal_type ?? null,
    primary_goal: answers.goal ?? null,
    starting_weight_kg: answers.weightKg ?? null,
    current_weight_kg: currentKg,
    goal_weight_kg: answers.goalWeightKg ?? null,
    weight_change_kg_7d: trend7,
    weight_change_kg_30d: trend30,
    logging_days_30d: loggingDays,
    avg_kcal_30d: avgKcal != null ? Math.round(avgKcal) : null,
    avg_protein_g_30d: avgProtein != null ? Math.round(avgProtein) : null,
    target_kcal: targetKcal,
    target_protein_g: targetProtein,
    kcal_adherence_pct: kcalAdherence,
    protein_adherence_pct: proteinAdherence,
    workout_days_30d: workoutDays30,
    training_days_per_week: trainingPerWeek,
    favorite_foods: favoriteFoods,
    scan_quality: scanQuality,
    computed_at: now.toISOString(),
  };

  const { error } = await sb.from('user_state').upsert(patch, { onConflict: 'company_id,profile_id' });
  if (error) {
    console.error('computeUserState upsert:', error.message);
    return { status: 'error', profileId, error: error.message };
  }
  return { status: 'ok', profileId };
}

/** Handy for surfaces that want to eyeball a computed snapshot without hitting the DB. */
export function formatWeightChange(kg: number | null): string {
  if (kg == null) return '—';
  const lb = kg * KG_TO_LB;
  return `${lb > 0 ? '+' : ''}${lb.toFixed(1)} lb`;
}
