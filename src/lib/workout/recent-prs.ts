import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Her recent personal records, for the card the handoff embeds in the coach thread.
 *
 * NOT STORED AS A MESSAGE, and that is the design decision worth keeping. The obvious build is to
 * insert a row into `messages` when a PR lands, which is what the mock's card looks like. Two
 * things are wrong with it: `messages` is the HUMAN thread with Stephanie and the coach console
 * reads the same table, so every PR would arrive in her client inbox as something to read; and a
 * row in a conversation is a thing somebody said, so writing one nobody said is a small lie told in
 * her name.
 *
 * This reads the training data instead and the thread interleaves it by time. The card is then a
 * rendered fact about her week rather than a fabricated message, it cannot desync from set_logs,
 * and deleting it is not a thing anyone needs to do.
 *
 * EPLEY, matching detectPRs in the player and getStrength on Progress, so the three cannot disagree
 * about what "best" means. It is defined three times now, which is two too many; the honest fix is
 * one shared module, and that is a refactor of the player's client-side path rather than something
 * to smuggle into this change.
 */

export type RecentPR = {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  /** True when the movement is bodyweight, so the record is reps rather than load. */
  bodyweight: boolean;
  achievedAt: string;
};

function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export async function getRecentPRs(
  companyId: string,
  profileId: string,
  withinDays = 30,
  limit = 3,
): Promise<RecentPR[]> {
  const svc = createServiceClient();

  const { data: logs, error: logErr } = await svc
    .from('workout_logs')
    .select('id, performed_at')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .order('performed_at', { ascending: true })
    .limit(2000);
  if (logErr) {
    console.error('getRecentPRs workout_logs:', logErr.message);
    return [];
  }
  const at = new Map((logs ?? []).map((l) => [l.id, String(l.performed_at)]));
  if (at.size === 0) return [];

  const { data: sets, error: setErr } = await svc
    .from('set_logs')
    .select('workout_log_id, exercise_id, reps, weight, completed')
    .in('workout_log_id', [...at.keys()])
    .limit(20000);
  if (setErr) {
    console.error('getRecentPRs set_logs:', setErr.message);
    return [];
  }

  // Walk in chronological order and keep the running best. A set that beats everything before it
  // IS the record at that moment, which is what makes it worth telling her about; comparing against
  // an all-time best computed afterwards would mark only the single heaviest set she has ever done.
  const bestSoFar = new Map<string, number>();
  const prs: RecentPR[] = [];
  const chronological = (sets ?? [])
    .filter((s) => s.completed !== false && s.exercise_id && (s.reps ?? 0) > 0)
    .sort((a, b) => String(at.get(a.workout_log_id)).localeCompare(String(at.get(b.workout_log_id))));

  for (const s of chronological) {
    const weight = Number(s.weight ?? 0);
    const reps = Number(s.reps ?? 0);
    const bodyweight = weight <= 0;
    const score = bodyweight ? reps : e1rm(weight, reps);
    const prev = bestSoFar.get(s.exercise_id);
    bestSoFar.set(s.exercise_id, Math.max(prev ?? 0, score));
    // No prior history is a BASELINE, not a record. Telling somebody their first ever set of an
    // exercise is a personal best is technically true and reads as a participation trophy.
    if (prev === undefined || score <= prev) continue;
    prs.push({
      exerciseId: s.exercise_id,
      name: s.exercise_id,
      weight,
      reps,
      bodyweight,
      achievedAt: String(at.get(s.workout_log_id)),
    });
  }

  const cutoff = Date.now() - withinDays * 86_400_000;
  const recent = prs
    .filter((p) => new Date(p.achievedAt).getTime() >= cutoff)
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, limit);
  if (recent.length === 0) return [];

  const { data: names } = await svc
    .from('exercises')
    .select('id, name_en')
    .in('id', [...new Set(recent.map((p) => p.exerciseId))]);
  const nameById = new Map((names ?? []).map((e) => [e.id, e.name_en]));
  return recent.map((p) => ({ ...p, name: nameById.get(p.exerciseId) ?? p.name }));
}
