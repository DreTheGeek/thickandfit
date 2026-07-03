// Workout logging engine. Per-set rows feed progressive overload; history surfaces to the coach.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
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
  completed: z.boolean().default(true),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'failed']).optional(),
});
export const logSchema = z.object({
  session_id: z.string().uuid().optional(),
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
  const { data: log } = await supabase
    .from('workout_logs')
    .insert({
      company_id: companyId,
      profile_id: profileId,
      session_id: input.session_id ?? null,
      completion_pct: input.completion_pct ?? null,
      enjoyment: input.enjoyment ?? null,
      effort: input.effort ?? null,
    })
    .select('id')
    .single();
  if (!log) throw new Error('Log failed');

  if (input.sets.length) {
    const rows = input.sets.map((s) => ({
      company_id: companyId,
      workout_log_id: log.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      reps: s.reps ?? null,
      weight: s.weight ?? null,
      completed: s.completed,
      difficulty: s.difficulty ?? null,
    }));
    await supabase.from('set_logs').insert(rows);
  }
  await supabase
    .from('workout_completion_history')
    .insert({ company_id: companyId, profile_id: profileId, workout_log_id: log.id, status: 'completed' });

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

// Epley estimated 1-rep max. Normalizes weight x reps so "more reps at the same load"
// and "more load" both register as progress.
function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

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
      const e = epley(weight, reps);
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
