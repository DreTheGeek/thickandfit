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

  return {
    hasOnboarded: Boolean(onb),
    macros,
    streak: 0, // workout logging lands in PRD-12
    todaysWorkout: null, // program builder / player land in PRD-10/11
    recentActivity: [], // community feed lands in Phase 2
  };
}
