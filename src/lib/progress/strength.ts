import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Her strongest set per movement, and how it has moved.
 *
 * The handoff gives Progress a Strength tab. `detectPRs` in the workout player cannot feed it: that
 * compares one session against an all-time best passed in from the server and is client-side and
 * single-session by construction. This is the history behind it.
 *
 * READS set_logs, WHICH IS ALMOST EMPTY TODAY: 25 sets across 4 movements for one member, because
 * the app is pre-launch and her 256 migrating clients arrive with session-level Lenus history
 * (`client_workout_history` has completion, enjoyment and exhaustion) and no set-level loads at all.
 * That is why `hasEnough` exists and why the screen hides the tab until it passes. A Strength tab
 * that renders an empty state on day one, for every migrating member, on the screen whose whole job
 * is to show progress, is worse than no tab: this app fails open everywhere, so an empty tab and a
 * broken query look identical, and she has no way to tell which she is looking at.
 *
 * It resolves itself. Members log sets from the first workout, so the tab appears on its own once
 * there is a story to tell.
 */

/** Below this there is no trend to draw, only a scatter of first attempts. */
const MIN_SETS = 12;
const MIN_EXERCISES = 3;

export type StrengthPoint = { on: string; e1rm: number; weight: number; reps: number };

export type StrengthMovement = {
  exerciseId: string;
  name: string;
  /** Best set ever, by Epley e1RM for weighted work and by reps for bodyweight. */
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  bestOn: string;
  /** Chronological best-per-day, for a sparkline. */
  points: StrengthPoint[];
  /** Change from her first logged session to her best, in lb. Null when there is only one session. */
  gainLb: number | null;
};

export type StrengthSummary = {
  hasEnough: boolean;
  totalSets: number;
  movements: StrengthMovement[];
};

/** Epley. The same formula detectPRs uses, so the two can never disagree about what "best" means. */
function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export async function getStrength(profileId: string, limit = 8): Promise<StrengthSummary> {
  const svc = createServiceClient();

  // set_logs has no profile_id: a set belongs to a workout_log, which belongs to a member. Two
  // steps rather than a join, because PostgREST embedding across a filter on the parent is the kind
  // of query that silently returns [] when the relationship name changes.
  const { data: logs, error: logErr } = await svc
    .from('workout_logs')
    .select('id, performed_at')
    .eq('profile_id', profileId)
    .order('performed_at', { ascending: true })
    .limit(2000);
  if (logErr) {
    console.error('getStrength workout_logs:', logErr.message);
    return { hasEnough: false, totalSets: 0, movements: [] };
  }
  const dayByLog = new Map((logs ?? []).map((l) => [l.id, String(l.performed_at).slice(0, 10)]));
  if (dayByLog.size === 0) return { hasEnough: false, totalSets: 0, movements: [] };

  const { data: sets, error: setErr } = await svc
    .from('set_logs')
    .select('workout_log_id, exercise_id, reps, weight, completed')
    .in('workout_log_id', [...dayByLog.keys()])
    .limit(20000);
  if (setErr) {
    console.error('getStrength set_logs:', setErr.message);
    return { hasEnough: false, totalSets: 0, movements: [] };
  }

  // Only sets she actually finished. An abandoned set is not evidence of strength.
  const done = (sets ?? []).filter((s) => s.completed !== false && (s.reps ?? 0) > 0);
  if (done.length === 0) return { hasEnough: false, totalSets: 0, movements: [] };

  // Best set per (exercise, day). A day's top set is the honest data point; plotting every set makes
  // a sawtooth that reads as her getting weaker within each session, which is just fatigue.
  const byExercise = new Map<string, Map<string, StrengthPoint>>();
  for (const s of done) {
    const day = dayByLog.get(s.workout_log_id);
    if (!day || !s.exercise_id) continue;
    const weight = Number(s.weight ?? 0);
    const reps = Number(s.reps ?? 0);
    const score = weight > 0 ? e1rm(weight, reps) : reps;
    const days = byExercise.get(s.exercise_id) ?? new Map<string, StrengthPoint>();
    const prev = days.get(day);
    if (!prev || score > prev.e1rm) days.set(day, { on: day, e1rm: score, weight, reps });
    byExercise.set(s.exercise_id, days);
  }

  const ids = [...byExercise.keys()];
  const { data: exRows } = await svc.from('exercises').select('id, name_en, name_es').in('id', ids);
  const nameById = new Map((exRows ?? []).map((e) => [e.id, e.name_en]));

  const movements: StrengthMovement[] = ids
    .map((id) => {
      const points = [...(byExercise.get(id) ?? new Map()).values()].sort((a, b) => a.on.localeCompare(b.on));
      const best = points.reduce((a, p) => (p.e1rm > a.e1rm ? p : a), points[0]);
      const first = points[0];
      return {
        exerciseId: id,
        name: nameById.get(id) ?? id,
        bestE1rm: Math.round(best.e1rm * 10) / 10,
        bestWeight: best.weight,
        bestReps: best.reps,
        bestOn: best.on,
        points,
        // Only meaningful across sessions, and only for weighted work: "+0 lb" on a bodyweight
        // movement she has done once reads as a failure to improve rather than as no data.
        gainLb: points.length > 1 && best.weight > 0 && first.weight > 0 ? Math.round((best.weight - first.weight) * 10) / 10 : null,
      };
    })
    // Most-trained first: the movements she has the most history on are the ones with a trend.
    .sort((a, b) => b.points.length - a.points.length || b.bestE1rm - a.bestE1rm)
    .slice(0, limit);

  return {
    hasEnough: done.length >= MIN_SETS && byExercise.size >= MIN_EXERCISES,
    totalSets: done.length,
    movements,
  };
}
