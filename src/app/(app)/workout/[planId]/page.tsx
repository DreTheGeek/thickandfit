// Workout player page. Requires auth; the plan must be assigned to this client.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { WorkoutPlayer, type PlayerExercise } from '@/components/workout/workout-player';
import { recommendForSession } from '@/lib/workout/logging';

export const dynamic = 'force-dynamic';

type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rest_sec: number | null;
  notes: string | null;
};

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ day?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const { planId } = await params;
  const { day: dayParam } = await searchParams;
  const locale = await getLocale();

  const supabase = createServiceClient();
  const { data: assigned } = await supabase
    .from('plan_assignments')
    .select('id')
    .eq('plan_id', planId)
    .eq('profile_id', ctx.userId)
    .maybeSingle();

  const program = ctx.companyId ? await getProgram(ctx.companyId, planId) : null;

  if (!assigned || !program || program.sessions.length === 0) {
    const t = await getTranslations('app.activities');
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
        <p className="text-muted">{t('noProgram')}</p>
      </div>
    );
  }

  // Clamp the requested day index into range so multi-day programs reach days 2..N
  // and a bad/out-of-range ?day= value safely falls back to the first session.
  const parsedDay = Number(dayParam);
  const dayIndex =
    Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay < program.sessions.length
      ? parsedDay
      : 0;
  const session = program.sessions[dayIndex];
  const exList = session.exercises as SessionExercise[];
  const ids = exList.map((e) => e.exercise_id);

  const [{ data: exs }, { data: muscles }] = await Promise.all([
    supabase
      .from('exercises')
      .select('id, name_en, name_es, cues_en, cues_es, muscle_group, video_mux_id')
      .in('id', ids),
    supabase.from('muscle_groups').select('key, label_en, label_es'),
  ]);
  const byId = new Map((exs ?? []).map((e) => [e.id, e]));
  const muscleLabel = new Map(
    (muscles ?? []).map((m) => [m.key, locale === 'es' ? (m.label_es ?? m.label_en) : m.label_en]),
  );

  const tEx = await getTranslations('app.exercise');

  // Progressive-overload recommendation per exercise from the client's recent set history.
  const recLocale = locale === 'es' ? 'es' : 'en';
  const overloadByExercise = ctx.companyId
    ? await recommendForSession(
        ctx.companyId,
        ctx.userId,
        exList.map((e) => ({
          exerciseId: e.exercise_id,
          name: (locale === 'es' && byId.get(e.exercise_id)?.name_es) || byId.get(e.exercise_id)?.name_en || tEx('untitled'),
          reps: e.reps,
        })),
        recLocale,
      )
    : new Map();
  const playerExercises: PlayerExercise[] = exList.map((e) => {
    const meta = byId.get(e.exercise_id);
    const hint = overloadByExercise.get(e.exercise_id) ?? null;
    return {
      exercise_id: e.exercise_id,
      name: (locale === 'es' && meta?.name_es) || meta?.name_en || tEx('untitled'),
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      rest_sec: e.rest_sec,
      notes: e.notes,
      cues: (locale === 'es' && meta?.cues_es) || meta?.cues_en || null,
      muscle: meta?.muscle_group ? (muscleLabel.get(meta.muscle_group) ?? meta.muscle_group) : null,
      video_mux_id: meta?.video_mux_id ?? null,
      overload: hint
        ? {
            action: hint.action,
            weight: hint.weight,
            reps: hint.reps,
            rationale: hint.rationale,
            historyPoints: hint.historyPoints,
            lastWeight: hint.lastWeight,
            lastReps: hint.lastReps,
          }
        : null,
      bestE1rm: hint?.bestE1rm ?? null,
      bestReps: hint?.bestReps ?? null,
    };
  });

  const programName =
    (locale === 'es' && program.plan.name_es) || program.plan.name_en;

  return (
    <div className="h-full">
      <WorkoutPlayer
        sessionId={session.id}
        programName={programName}
        dayLabel={session.day_label}
        exercises={playerExercises}
      />
    </div>
  );
}
