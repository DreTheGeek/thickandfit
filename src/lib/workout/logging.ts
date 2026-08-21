// Workout logging engine. Per-set rows feed progressive overload; history surfaces to the coach.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { epley1rm } from '@/lib/workout/epley';
import { recommendNext, type SetResult, type RepRange } from '@/lib/overload/recommend';
import { explainRecommendation } from '@/lib/overload/explain';
import { after } from 'next/server';
import { emitEvent } from '@/lib/events/emit';
import { recomputeChallengeProgressForProfile } from '@/lib/community/challenge-progress';

const setSchema = z.object({
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1),
  reps: z.number().int().optional(),
  weight: z.number().optional(),
  // Seconds performed on a timed movement (a 25-minute incline walk, 5 on the Stairmaster). Absent
  // on rep-based sets, where it stays null rather than 0. See lib/workout/exercise-kind.ts.
  duration_sec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  completed: z.boolean().default(true),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'failed']).optional(),
});
export const logSchema = z.object({
  session_id: z.string().uuid().optional(),
  /**
   * A client-generated id for ONE session, so the same workout can be saved repeatedly as she goes
   * and land in one row. See migration 0151 for why this exists at all.
   *
   * Length-capped rather than uuid-validated: it comes from a browser and its only job is stability,
   * so a strict format would turn a malformed client into a rejected workout for no gain.
   */
  client_session_id: z.string().min(8).max(64).optional(),
  completion_pct: z.number().int().min(0).max(100).optional(),
  enjoyment: z.number().int().min(1).max(5).optional(),
  effort: z.number().int().min(1).max(5).optional(),
  sets: z.array(setSchema),
});
export type LogInput = z.infer<typeof logSchema>;

export async function saveWorkoutLog(
  companyId: string,
  profileId: string,
  input: LogInput,
): Promise<{ workoutLogId: string; setsLogged: number }> {
  const supabase = createServiceClient();

  /**
   * ONE ROW PER SESSION, however many times she saves it.
   *
   * The player now posts after every logged set instead of once at the end, because posting once at
   * the end meant a member who left any way other than the Finish button lost the whole workout,
   * and on a phone the back gesture is how you leave. Without the upsert that autosave would create
   * a new workout_log per set: a 20-movement session would appear as 47 workouts.
   *
   * Keyed on (profile_id, client_session_id) via the partial unique index in 0151. A caller that
   * sends no id keeps the old insert-a-new-row behaviour, which is what the legacy importer and any
   * future server-side writer want.
   */
  const row = {
    company_id: companyId,
    profile_id: profileId,
    session_id: input.session_id ?? null,
    completion_pct: input.completion_pct ?? null,
    enjoyment: input.enjoyment ?? null,
    effort: input.effort ?? null,
    ...(input.client_session_id ? { client_session_id: input.client_session_id } : {}),
  };
  const { data: log, error: logErr } = input.client_session_id
    ? await supabase
        .from('workout_logs')
        .upsert(row, { onConflict: 'profile_id,client_session_id' })
        .select('id')
        .single()
    : await supabase.from('workout_logs').insert(row).select('id').single();
  // Loud. This used to be a bare `if (!log) throw new Error('Log failed')`, which discarded the
  // reason and left nothing to read when a save stopped working.
  if (logErr || !log) throw new Error(`Log failed: ${logErr?.message ?? 'no row returned'}`);

  // REPLACE, not append. Every save carries the whole session so far, so the previous save's rows
  // have to go or set 1 accumulates a copy per subsequent set.
  if (input.client_session_id) {
    await supabase.from('set_logs').delete().eq('workout_log_id', log.id);
  }

  if (input.sets.length) {
    const rows = input.sets.map((s) => ({
      company_id: companyId,
      workout_log_id: log.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      reps: s.reps ?? null,
      weight: s.weight ?? null,
      duration_sec: s.duration_sec ?? null,
      completed: s.completed,
      difficulty: s.difficulty ?? null,
    }));
    await supabase.from('set_logs').insert(rows);
  }
  await supabase
    .from('workout_completion_history')
    // ONE row per workout_log, not one per save. This table is what gamification reads to decide
    // whether she trained today and what the weekly target counts, so an autosave firing on every
    // set would inflate a single session into forty. The unique index backing this is in 0151;
    // logging.ts is the only writer in the codebase, so making it unique was safe.
    .upsert(
      { company_id: companyId, profile_id: profileId, workout_log_id: log.id, status: 'completed' },
      { onConflict: 'workout_log_id', ignoreDuplicates: true },
    );

  emitEvent({
    companyId,
    profileId,
    type: 'workout_logged',
    aggregateType: 'workout_log',
    aggregateId: log.id,
    payload: {
      session_id: input.session_id ?? null,
      sets: input.sets.length,
      completion_pct: input.completion_pct ?? null,
    },
  });

  // Live leaderboard: refresh this member's progress on any active 'workouts' challenge they joined.
  // after() so it survives the frozen lambda without delaying the response; try/catch because after()
  // is unavailable outside a request scope (tests, scripts) - fall back to a plain floating call.
  try {
    after(() => recomputeChallengeProgressForProfile(companyId, profileId));
  } catch {
    void recomputeChallengeProgressForProfile(companyId, profileId);
  }

  return { workoutLogId: log.id, setsLogged: input.sets.length };
}

export async function fetchHistory(companyId: string, profileId: string, limit = 20) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('workout_logs')
    .select('id, session_id, completion_pct, enjoyment, effort, performed_at')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .order('performed_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getExerciseHistory(
  companyId: string,
  profileId: string,
  exerciseId: string,
): Promise<SetResult[]> {
  const supabase = createServiceClient();
  const { data: logs } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId);
  const logIds = (logs ?? []).map((l) => l.id);
  if (!logIds.length) return [];

  const { data: sets } = await supabase
    .from('set_logs')
    .select('weight, reps, completed, difficulty, created_at')
    .eq('exercise_id', exerciseId)
    // Rep-based sets only. A timed movement logs duration_sec with reps null, and a null read as a
    // zero by the recommender looks like a set she failed: it would deload her off a walk.
    .not('reps', 'is', null)
    .in('workout_log_id', logIds)
    .order('created_at', { ascending: true });

  return (sets ?? []).slice(-4).map((s) => ({
    weight: s.weight,
    reps: s.reps,
    completed: s.completed,
    difficulty: (s.difficulty ?? 'moderate') as SetResult['difficulty'],
  }));
}

export async function recommendForExercise(
  companyId: string,
  profileId: string,
  exerciseId: string,
  range: RepRange,
) {
  const history = await getExerciseHistory(companyId, profileId, exerciseId);
  return { history_points: history.length, recommendation: recommendNext(history, range) };
}

export type OverloadHint = {
  exerciseId: string;
  action: 'increase_reps' | 'increase_weight' | 'hold' | 'deload';
  weight: number | null;
  reps: number;
  rationale: string;
  historyPoints: number;
  // All-time bests for client-side PR detection (Epley e1RM for weighted, max reps for bodyweight).
  bestE1rm: number | null;
  bestReps: number | null;
  // The most recent logged set, for the canonical "Last time - N x W lb" line.
  lastWeight: number | null;
  lastReps: number | null;
};

// Best weighted e1RM and best bodyweight reps across a set history (completed sets only).
function bestsFromHistory(sets: SetResult[]): { bestE1rm: number | null; bestReps: number | null } {
  let bestE1rm = 0;
  let bestReps = 0;
  for (const s of sets) {
    if (!s.completed) continue;
    const reps = s.reps ?? 0;
    const weight = s.weight ?? 0;
    if (reps > bestReps) bestReps = reps;
    if (weight > 0 && reps > 0) {
      const e = epley1rm(weight, reps);
      if (e > bestE1rm) bestE1rm = e;
    }
  }
  return { bestE1rm: bestE1rm || null, bestReps: bestReps || null };
}

type ExerciseTarget = { exerciseId: string; name: string; reps: number | null };

// Build a sensible double-progression window from the planned target reps.
function rangeFromTarget(reps: number | null): RepRange {
  if (!reps || reps <= 0) return { min: 8, max: 12 };
  return { min: reps, max: reps + 2 };
}

// One recommendation per exercise, history fetched in a single round trip, then the
// deterministic number is explained in the client's locale (AI layer falls back gracefully).
export async function recommendForSession(
  companyId: string,
  profileId: string,
  targets: ExerciseTarget[],
  locale: 'en' | 'es',
): Promise<Map<string, OverloadHint>> {
  const out = new Map<string, OverloadHint>();
  if (!targets.length) return out;

  const supabase = createServiceClient();
  const { data: logs } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId);
  const logIds = (logs ?? []).map((l) => l.id);

  const byExercise = new Map<string, SetResult[]>();
  if (logIds.length) {
    const exerciseIds = targets.map((tg) => tg.exerciseId);
    const { data: sets } = await supabase
      .from('set_logs')
      .select('exercise_id, weight, reps, completed, difficulty, created_at')
      .in('exercise_id', exerciseIds)
      // Same reason as getExerciseHistory: a timed set has no reps and must not be scored as one.
      .not('reps', 'is', null)
      .in('workout_log_id', logIds)
      .order('created_at', { ascending: true });
    for (const s of sets ?? []) {
      const list = byExercise.get(s.exercise_id) ?? [];
      list.push({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        difficulty: (s.difficulty ?? 'moderate') as SetResult['difficulty'],
      });
      byExercise.set(s.exercise_id, list);
    }
  }

  await Promise.all(
    targets.map(async (tg) => {
      const all = byExercise.get(tg.exerciseId) ?? [];
      const history = all.slice(-4);
      const rec = recommendNext(history, rangeFromTarget(tg.reps));
      const rationale = await explainRecommendation(rec, tg.name, locale);
      const { bestE1rm, bestReps } = bestsFromHistory(all);
      const lastSet = [...all].reverse().find((s) => s.completed) ?? all[all.length - 1] ?? null;
      out.set(tg.exerciseId, {
        exerciseId: tg.exerciseId,
        action: rec.action,
        weight: rec.weight,
        reps: rec.reps,
        rationale,
        historyPoints: history.length,
        bestE1rm,
        bestReps,
        lastWeight: lastSet?.weight ?? null,
        lastReps: lastSet?.reps ?? null,
      });
    }),
  );

  return out;
}
