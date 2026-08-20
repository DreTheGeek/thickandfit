import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * What she did on each set of this movement LAST time.
 *
 * The handoff's exercise screen gives the set table a "Previous" column, and it is the most useful
 * column on it: standing at the rack, the question is not what the plan says, it is what she managed
 * a week ago. The player already surfaces one previous value through `overload.lastWeight`, but that
 * is a single number for the whole movement, and painting it down every row of a table would claim
 * she did the same thing on set 1 and set 5, which is exactly what does not happen.
 *
 * `getExerciseHistory` cannot serve this: it does not select `set_number`, so the per-set shape is
 * unrecoverable from it. Hence a separate, batched read.
 *
 * BATCHED, because the alternative is one query per movement and a leg day has fourteen.
 *
 * MOST RECENT SESSION ONLY. An average across every session she has ever done is a different and
 * less useful number: progressive overload is a comparison with the last attempt, not with her
 * career. Where a movement appears in several past sessions, the newest workout_log wins.
 */

export type PreviousSet = { setNumber: number; reps: number; weight: number };

export async function getPreviousSets(
  companyId: string,
  profileId: string,
  exerciseIds: string[],
  /** Exclude the session she is in right now, so today's own sets are never her "previous". */
  excludeWorkoutLogId?: string | null,
): Promise<Map<string, PreviousSet[]>> {
  const out = new Map<string, PreviousSet[]>();
  if (exerciseIds.length === 0) return out;

  const svc = createServiceClient();

  const { data: logs, error: logErr } = await svc
    .from('workout_logs')
    .select('id, performed_at')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .order('performed_at', { ascending: false })
    .limit(400);
  if (logErr) {
    console.error('getPreviousSets workout_logs:', logErr.message);
    return out;
  }

  const ordered = (logs ?? []).filter((l) => l.id !== excludeWorkoutLogId);
  if (ordered.length === 0) return out;

  // Newest first, so the first log that carries a movement is the one that wins.
  const rank = new Map(ordered.map((l, i) => [l.id, i]));

  const { data: sets, error: setErr } = await svc
    .from('set_logs')
    .select('workout_log_id, exercise_id, set_number, reps, weight, completed')
    .in('exercise_id', exerciseIds)
    .in('workout_log_id', [...rank.keys()])
    .limit(20000);
  if (setErr) {
    console.error('getPreviousSets set_logs:', setErr.message);
    return out;
  }

  // Pick the winning log per exercise first, then take only that log's sets. Filtering as we go
  // would let an older session's set 5 survive next to a newer session's set 1.
  const bestLogFor = new Map<string, string>();
  for (const s of sets ?? []) {
    if (s.completed === false || !s.exercise_id || !s.workout_log_id) continue;
    const current = bestLogFor.get(s.exercise_id);
    if (current === undefined || (rank.get(s.workout_log_id) ?? 1e9) < (rank.get(current) ?? 1e9)) {
      bestLogFor.set(s.exercise_id, s.workout_log_id);
    }
  }

  for (const s of sets ?? []) {
    if (s.completed === false || !s.exercise_id) continue;
    if (bestLogFor.get(s.exercise_id) !== s.workout_log_id) continue;
    const list = out.get(s.exercise_id) ?? [];
    list.push({
      setNumber: Number(s.set_number ?? 0),
      reps: Number(s.reps ?? 0),
      weight: Number(s.weight ?? 0),
    });
    out.set(s.exercise_id, list);
  }

  for (const [, list] of out) list.sort((a, b) => a.setNumber - b.setNumber);
  return out;
}
