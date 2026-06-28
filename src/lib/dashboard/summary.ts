// Dashboard summary. Aggregates what exists today (onboarding targets); workout/streak/activity
// arrive in PRD-10/11/12 and the community PRDs, so each is null/empty until then.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type DashboardSummary = {
  hasOnboarded: boolean;
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  streak: number;
  todaysWorkout: { name: string } | null;
  recentActivity: { label: string; at: string }[];
  // Active weight plateau from the latest nightly insight (null when not flat / no insights yet).
  // Drives the dismissible dashboard banner. Deterministic; populated by the insight engine.
  plateau: { daysFlat: number } | null;
};

type InsightPayloadShape = {
  plateau?: { status?: string; days_flat?: number };
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

  return {
    hasOnboarded: Boolean(onb),
    macros,
    streak: 0, // workout logging lands in PRD-12
    todaysWorkout: planName ? { name: planName } : null,
    recentActivity: [], // community feed lands in Phase 2
    plateau,
  };
}
