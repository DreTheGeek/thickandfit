import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { loadHealthProfile } from '@/lib/health-profile/data';
import { localDay, localWeekStart } from '@/lib/datetime/local-day';
import { weeklyTargetFrom, type WeeklyTarget, type WeeklyTargetSource } from '@/lib/training/weekly-target-shared';

export type { WeeklyTarget } from '@/lib/training/weekly-target-shared';

/**
 * How many days a week she is aiming to train, and where that number came from.
 *
 * THREE TIERS, in order, and the third one is the point.
 *
 *   1. HER ANSWER. Onboarding asks "how many days a week can you train?" and stores 3, 4 or 5. It
 *      already picks her program; this is the second thing it has ever been read for.
 *   2. HER PLAN. plans.days_per_week, from migration 0148. "2 of 4 this week" measured against the
 *      program she is actually on is a statement of her own plan, not a guess about her.
 *   3. NEITHER. Return null and let the caller render a bare count. Every one of the 256 migrated
 *      Lenus members lands here, and telling somebody who never set a target that she is "0 of 3"
 *      is the app inventing a failure for her.
 *
 * DELIBERATELY NOT a fourth tier: user_state.training_days_per_week looks like one and is the
 * opposite. It is workout_days_30d / 30 * 7, her OBSERVED cadence, so using it as a target would be
 * circular - she could never miss it, and it would drift down every week she trained less. Same
 * name, opposite meaning.
 */
async function resolveTarget(
  profileId: string,
  companyId: string,
): Promise<{ target: number | null; source: WeeklyTargetSource | null }> {
  const hp = await loadHealthProfile(profileId, companyId);
  if (hp.trainingDays != null) return { target: hp.trainingDays, source: 'answer' };

  const { data, error } = await createServiceClient()
    .from('plan_assignments')
    .select('plan:plan_id (days_per_week)')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .order('assigned_at', { ascending: false })
    .limit(1);
  // Fail to NO TARGET, never to a number. A read that fails must not be able to invent a goal she
  // is then measured against.
  if (error) {
    console.error('resolveTarget plan:', error.message);
    return { target: null, source: null };
  }
  const days = (data ?? [])[0]?.plan as { days_per_week?: number | null } | undefined;
  const n = days?.days_per_week ?? null;
  return n != null && n > 0 ? { target: n, source: 'plan' } : { target: null, source: null };
}

/**
 * Her week, resolved.
 *
 * @param opts.workoutDays Pass the days the caller already holds to skip a second read. The
 *   dashboard has them: recomputeGamification computes exactly this set on every load and now
 *   returns it, so Today costs no extra query at all.
 * @param opts.timezone Pass hers if already resolved; otherwise it is read here.
 */
export async function getWeeklyTarget(
  profileId: string,
  companyId: string,
  opts: { workoutDays?: readonly string[]; timezone?: string | null } = {},
): Promise<WeeklyTarget> {
  const svc = createServiceClient();

  let tz = opts.timezone ?? null;
  if (tz == null) {
    const { data } = await svc.from('profiles').select('timezone').eq('id', profileId).maybeSingle();
    tz = (data as { timezone?: string | null } | null)?.timezone ?? null;
  }

  let days = opts.workoutDays;
  if (!days) {
    const weekStart = localWeekStart(tz);
    // workout_completion_history, NOT workout_logs, and the difference matters. saveWorkoutLog
    // writes both, but gamification buckets completion instants into the member's LOCAL day, and
    // slicing workout_logs.performed_at gives a UTC day: an evening session west of UTC lands on
    // tomorrow. Same bug the week strip already had fixed. Read a little wide and let the shared
    // function do the week filtering, so both paths use identical logic.
    const since = new Date(Date.parse(`${weekStart}T00:00:00Z`) - 2 * 86_400_000).toISOString();
    const { data, error } = await svc
      .from('workout_completion_history')
      .select('changed_at')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .gte('changed_at', since);
    if (error) console.error('getWeeklyTarget history:', error.message);
    days = [...new Set(((data ?? []) as { changed_at: string }[]).map((r) => localDay(tz, new Date(r.changed_at))))];
  }

  const { target, source } = await resolveTarget(profileId, companyId);
  return weeklyTargetFrom(days, localDay(tz), localWeekStart(tz), target, source);
}
