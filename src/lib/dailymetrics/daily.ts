// Daily Move (steps) + Recover (sleep) for the TRAIN / FUEL / MOVE / RECOVER mission. Self-reported
// for now (no wearable sync yet), stored one row per member per local day in daily_metrics.
import { createClient } from '@/lib/supabase/server';

export { STEP_GOAL, SLEEP_GOAL_MIN } from '@/lib/dailymetrics/goals';

export type DailyMetrics = { steps: number | null; sleepMinutes: number | null };

/** Read the member's own row for a local day. RLS scopes it to the caller; missing row is all-null. */
export async function getDailyMetrics(profileId: string, onDate: string): Promise<DailyMetrics> {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from('daily_metrics')
      .select('steps, sleep_minutes')
      .eq('profile_id', profileId)
      .eq('on_date', onDate)
      .maybeSingle();
    const row = data as { steps: number | null; sleep_minutes: number | null } | null;
    return { steps: row?.steps ?? null, sleepMinutes: row?.sleep_minutes ?? null };
  } catch {
    return { steps: null, sleepMinutes: null };
  }
}
