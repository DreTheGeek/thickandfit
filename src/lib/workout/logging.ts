// Workout logging engine. Per-set rows feed progressive overload; history surfaces to the coach.
import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { recommendNext, type SetResult, type RepRange } from '@/lib/overload/recommend';

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

export async function saveWorkoutLog(companyId: string, profileId: string, input: LogInput) {
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
