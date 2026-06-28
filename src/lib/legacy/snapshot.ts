// Read-only "Your journey so far" snapshot (WP13). For a CLAIMED legacy client, this surfaces the
// aggregate numbers that came across from Lenus (legacy_client_snapshot, populated by import-lenus.sql
// for all 256 clients). It is deliberately read-only and aggregate: the granular per-date weight /
// workout history did NOT come across in the export, so we never fabricate a timeline.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type LegacySnapshot = {
  mealPlans: number;
  measurements: number;
  checkins: number;
  workouts: number;
  weightGoal: string | null;
  goalIntensity: string | null;
};

// Returns the snapshot for the signed-in user IF they are a claimed legacy client, else null.
// Joins profiles -> contacts (by the now-linked profile_id) -> legacy_client_snapshot.
export async function getLegacySnapshot(
  profileId: string,
  companyId: string,
): Promise<LegacySnapshot | null> {
  const svc = createServiceClient();

  // Confirm this profile is a claimed legacy client before showing anything.
  const { data: profile } = await svc
    .from('profiles')
    .select('is_legacy_client')
    .eq('id', profileId)
    .maybeSingle();
  if (!profile?.is_legacy_client) return null;

  // Find the linked contact, then its snapshot.
  const { data: contact } = await svc
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .eq('type', 'client')
    .maybeSingle();
  if (!contact?.id) return null;

  const { data: snap } = await svc
    .from('legacy_client_snapshot')
    .select('meal_plans, measurements_logged, checkins, workouts_completed, weight_goal, goal_intensity')
    .eq('contact_id', contact.id)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!snap) return null;

  return {
    mealPlans: snap.meal_plans ?? 0,
    measurements: snap.measurements_logged ?? 0,
    checkins: snap.checkins ?? 0,
    workouts: snap.workouts_completed ?? 0,
    weightGoal: (snap.weight_goal as string | null) ?? null,
    goalIntensity: (snap.goal_intensity as string | null) ?? null,
  };
}
