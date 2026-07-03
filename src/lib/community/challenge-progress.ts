// Challenge progress derived from REAL activity. challenge_participants.progress was only ever
// written as 0 on join, so the leaderboard never ranked and finalize could never crown a winner.
// This module is the metric -> progress bridge:
//   workouts -> count of workout_logs inside the challenge window
//   logs     -> distinct food-diary days logged inside the window
// (steps/water/points have no data source yet; authoring no longer offers them.)
// Recomputed live (after a workout/food log, via after()) and in full before finalize, so the board
// is fresh day-to-day and the winner is ranked on real numbers.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { localDay } from '@/lib/datetime/local-day';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';

type Window = { startsOn: string; endsOn: string };

// Shift an ISO date by n days (UTC arithmetic on pure dates).
function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function metricCount(
  svc: ReturnType<typeof createServiceClient>,
  metric: string,
  companyId: string,
  profileId: string,
  w: Window,
): Promise<number | null> {
  if (metric === 'workouts') {
    // performed_at is a timestamptz INSTANT while the challenge window is calendar dates. Count by
    // the PARTICIPANT'S local day (like food_log.log_date), else an evening boundary-day workout
    // west of UTC lands outside the window. Fetch a range padded 1 day each side (covers UTC+/-14),
    // then bucket precisely in JS (DST-correct via Intl).
    const tz = await getProfileTimezone(profileId);
    const { data } = await svc
      .from('workout_logs')
      .select('performed_at')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .gte('performed_at', `${shiftDay(w.startsOn, -1)}T00:00:00Z`)
      .lt('performed_at', `${shiftDay(w.endsOn, 2)}T00:00:00Z`)
      .limit(2000);
    const rows = (data ?? []) as { performed_at: string }[];
    return rows.filter((r) => {
      const day = localDay(tz, new Date(r.performed_at));
      return day >= w.startsOn && day <= w.endsOn;
    }).length;
  }
  if (metric === 'logs') {
    // Distinct diary DAYS logged (log_date is already the user-local day), not raw row count, so
    // "log every day" challenges rank on consistency rather than volume.
    const { data } = await svc
      .from('food_log')
      .select('log_date')
      .eq('company_id', companyId)
      .eq('profile_id', profileId)
      .gte('log_date', w.startsOn)
      .lte('log_date', w.endsOn)
      .limit(2000);
    const days = new Set(((data ?? []) as { log_date: string }[]).map((r) => r.log_date));
    return days.size;
  }
  return null; // unknown/legacy metric: leave stored progress untouched
}

/**
 * Recompute one challenge's whole board (used before finalize + by the daily cron).
 * Returns the number of participant rows updated.
 */
export async function recomputeChallengeBoard(challengeId: string): Promise<number> {
  const svc = createServiceClient();
  const { data: ch } = await svc
    .from('challenges')
    .select('id, company_id, metric, starts_on, ends_on')
    .eq('id', challengeId)
    .maybeSingle();
  if (!ch) return 0;
  const c = ch as { id: string; company_id: string; metric: string; starts_on: string; ends_on: string };

  const { data: parts } = await svc
    .from('challenge_participants')
    .select('profile_id, progress')
    .eq('challenge_id', c.id)
    .limit(500);
  const rows = (parts ?? []) as { profile_id: string; progress: number | string }[];

  let updated = 0;
  for (const p of rows) {
    const n = await metricCount(svc, c.metric, c.company_id, p.profile_id, {
      startsOn: c.starts_on,
      endsOn: c.ends_on,
    });
    if (n == null || n === Number(p.progress)) continue;
    const { error } = await svc
      .from('challenge_participants')
      .update({ progress: n })
      .eq('challenge_id', c.id)
      .eq('profile_id', p.profile_id);
    if (!error) updated++;
  }
  return updated;
}

/**
 * Live hook: after a member logs a workout or food, refresh THEIR progress on every active
 * challenge they joined. Cheap (no-op when they joined nothing) and safe to fire-and-forget from
 * after() - errors are swallowed, progress self-heals on the next full recompute.
 */
export async function recomputeChallengeProgressForProfile(
  companyId: string,
  profileId: string,
): Promise<void> {
  try {
    const svc = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await svc
      .from('challenges')
      .select('id, metric, starts_on, ends_on, challenge_participants!inner(profile_id)')
      .eq('company_id', companyId)
      .eq('challenge_participants.profile_id', profileId)
      .lte('starts_on', today)
      .gte('ends_on', today)
      .limit(10);
    const active = (data ?? []) as { id: string; metric: string; starts_on: string; ends_on: string }[];
    for (const c of active) {
      const n = await metricCount(svc, c.metric, companyId, profileId, {
        startsOn: c.starts_on,
        endsOn: c.ends_on,
      });
      if (n == null) continue;
      await svc
        .from('challenge_participants')
        .update({ progress: n })
        .eq('challenge_id', c.id)
        .eq('profile_id', profileId);
    }
  } catch (e) {
    console.error('recomputeChallengeProgressForProfile:', e instanceof Error ? e.message : String(e));
  }
}
