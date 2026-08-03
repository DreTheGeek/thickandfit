// Dashboard summary. Aggregates what exists today (onboarding targets); workout/streak/activity
// arrive in PRD-10/11/12 and the community PRDs, so each is null/empty until then.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { recomputeGamification } from '@/lib/gamification/engine';

export type DashboardSummary = {
  hasOnboarded: boolean;
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  streak: number;
  todaysWorkout: { name: string; done: boolean } | null;
  recentActivity: { label: string; at: string }[];
  // Active weight plateau from the latest nightly insight (null when not flat / no insights yet).
  // Drives the dismissible dashboard banner. Deterministic; populated by the insight engine.
  plateau: { daysFlat: number } | null;
  // Goal-pace chip from the latest insight: are they on pace + the projected goal date.
  pace: { onPace: boolean | null; goalDate: string | null } | null;
  // Local ISO days the member was active (for painting the home week strip green).
  activeDays: string[];
};

type InsightPayloadShape = {
  plateau?: { status?: string; days_flat?: number };
  on_pace?: boolean | null;
  projected_goal_date?: string | null;
};

type Targets = { calories: number; macros: { protein_g: number; carbs_g: number; fat_g: number } };

export async function getDashboardSummary(companyId: string, userId: string): Promise<DashboardSummary> {
  const supabase = createServiceClient();
  const { data: onb } = await supabase
    .from('onboarding_responses')
    .select('computed_targets')
    .eq('profile_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();

  const targets = (onb?.computed_targets as Targets | null) ?? null;
  const macros = targets?.macros
    ? {
        calories: targets.calories,
        protein_g: targets.macros.protein_g,
        carbs_g: targets.macros.carbs_g,
        fat_g: targets.macros.fat_g,
      }
    : null;

  // Surface the most-recently assigned program so the dashboard reflects it (the /workouts tab
  // already reads the assignment; the home row was previously stubbed to null).
  const { data: assignment } = await supabase
    .from('plan_assignments')
    .select('plan:plan_id (name_en)')
    .eq('company_id', companyId)
    .eq('profile_id', userId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = assignment?.plan as { name_en: string } | { name_en: string }[] | null | undefined;
  const planName = Array.isArray(plan) ? plan[0]?.name_en : plan?.name_en;

  // Latest nightly insight: surface an active plateau for the dismissible dashboard banner.
  // Strictly 'plateau'. A member whose plan holds her at maintenance is recorded as 'holding', which
  // is the same flat weight meaning the opposite thing, and the banner ("we can adjust your plan to
  // get you moving again") would contradict what onboarding promised her. Do not loosen this to a
  // truthy check on plateau.
  const { data: insight } = await supabase
    .from('user_insights')
    .select('payload')
    .eq('profile_id', userId)
    .eq('company_id', companyId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = (insight?.payload ?? null) as InsightPayloadShape | null;
  const plateau =
    payload?.plateau?.status === 'plateau'
      ? { daysFlat: Math.max(0, Math.round(Number(payload.plateau.days_flat ?? 0))) }
      : null;
  const pace =
    payload && (payload.projected_goal_date || payload.on_pace != null)
      ? { onPace: payload.on_pace ?? null, goalDate: payload.projected_goal_date ?? null }
      : null;

  // Real streak from the gamification engine (safe to recompute on dashboard load; also refreshes
  // badges + fires any newly-earned confetti). Degrades to 0 on any failure, never blocks the home.
  let streak = 0;
  let activeDays: string[] = [];
  let workoutToday = false;
  try {
    const gam = await recomputeGamification(userId, companyId);
    streak = gam.snapshot.streak.currentStreak;
    activeDays = gam.activeDays;
    workoutToday = gam.workoutToday;
  } catch (e) {
    console.error('dashboard streak:', e instanceof Error ? e.message : e);
  }

  return {
    hasOnboarded: Boolean(onb),
    macros,
    streak,
    todaysWorkout: planName ? { name: planName, done: workoutToday } : null,
    recentActivity: [],
    plateau,
    pace,
    activeDays,
  };
}
