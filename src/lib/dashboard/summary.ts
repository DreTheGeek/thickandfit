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
  const macros = targets
    ? {
        calories: targets.calories,
        protein_g: targets.macros.protein_g,
        carbs_g: targets.macros.carbs_g,
        fat_g: targets.macros.fat_g,
      }
    : null;

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
    todaysWorkout: null, // program builder / player land in PRD-10/11
    recentActivity: [], // community feed lands in Phase 2
    plateau,
  };
}
