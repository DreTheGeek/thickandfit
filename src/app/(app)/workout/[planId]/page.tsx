// Workout player page. Requires auth; the plan must be assigned to this client.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { WorkoutPlayer, type PlayerExercise } from '@/components/workout/workout-player';
import { recommendForSession } from '@/lib/workout/logging';
import { readCoachSettings } from '@/lib/coach/settings';
import { demoUrls } from '@/lib/exercises/demo-url';
import { normalizeRestSeconds } from '@/lib/workout/rest';
import { SessionPreview, type PreviewExercise } from '@/components/workout/session-preview';
import { loadCycleLogs } from '@/lib/cycle/data';
import { currentPhase } from '@/lib/cycle/phase';

export const dynamic = 'force-dynamic';

type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  weight: number | null;
  rest_sec: number | null;
  notes: string | null;
  group_key: string | null;
  group_kind: string | null;
  is_amrap: boolean | null;
};

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ day?: string; preview?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const { planId } = await params;
  const { day: dayParam, preview: previewParam } = await searchParams;
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
      // Resolves a COMMITTED exercise by id. NEVER add .is('archived_at', null) here:
      // curation (0105) must not erase history, and filtering this fails SILENTLY as an
      // untitled card with no demo rather than throwing.
      .from('exercises')
      // demo_storage_path carries HER filmed demo (366 of 367 movements). It is selected here and
      // resolved to a signed URL below; the path itself must never reach the browser, because the
      // bucket is private and a path in the DOM is an index of the library.
      .select('id, name_en, name_es, cues_en, cues_es, muscle_group, equipment, video_mux_id, demo_storage_path')
      .in('id', ids),
    supabase.from('muscle_groups').select('key, label_en, label_es'),
  ]);
  const byId = new Map((exs ?? []).map((e) => [e.id, e]));

  // ONE round trip for the whole session's demos rather than one per movement. A 12-exercise day
  // would otherwise mint 12 signed URLs serially on the server before the page could render.
  const demoSigned = await demoUrls(
    (exs ?? [])
      .map((e) => (e as { demo_storage_path?: string | null }).demo_storage_path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0),
  );
  const muscleLabel = new Map(
    (muscles ?? []).map((m) => [m.key, locale === 'es' ? (m.label_es ?? m.label_en) : m.label_en]),
  );

  const tEx = await getTranslations('app.exercise');
  const { isExerciseGuideShown: showExerciseGuides } = await readCoachSettings(ctx.companyId);

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
      repsMin: e.reps_min,
      repsMax: e.reps_max,
      isAmrap: e.is_amrap === true,
      groupKey: e.group_key,
      groupKind: e.group_kind,
      // "Include exercise instructions in client app" (coach settings). Dropped at the boundary
      // rather than hidden in the player, so the coaching cues are not sitting in the page payload
      // for anyone who opens the network tab after she turned them off.
      cues: showExerciseGuides ? (locale === 'es' && meta?.cues_es) || meta?.cues_en || null : null,
      muscle: meta?.muscle_group ? (muscleLabel.get(meta.muscle_group) ?? meta.muscle_group) : null,
      muscleKey: meta?.muscle_group ?? null,
      video_mux_id: meta?.video_mux_id ?? null,
      demoUrl:
        demoSigned.get((meta as { demo_storage_path?: string | null } | undefined)?.demo_storage_path ?? '') ??
        null,
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

  const dayLabel = session.day_label ?? tEx('untitled');
  const weekLine = `${tEx('day')} ${dayIndex + 1} / ${program.sessions.length}`;

  /**
   * The pre-start screen, reusing this loader rather than owning a route of its own.
   *
   * Everything it needs is already resolved above, so a separate route would mean a second copy of
   * the assignment check, the day clamp and the exercise join, and two places for those to drift.
   * The player is still the default: ?preview=1 is what the exercise rows on Train link to, while
   * the banner's START WORKOUT goes straight to training, because by then she has decided.
   */
  if (previewParam === '1') {
    const previewExercises: PreviewExercise[] = exList.map((e) => {
      const meta = byId.get(e.exercise_id);
      return {
        exercise_id: e.exercise_id,
        name: (locale === 'es' && meta?.name_es) || meta?.name_en || tEx('untitled'),
        sets: e.sets,
        reps: e.reps,
        repsMin: e.reps_min,
        repsMax: e.reps_max,
        restSec: normalizeRestSeconds(e.rest_sec),
        equipment: (meta as { equipment?: string | null } | undefined)?.equipment ?? null,
        // The same three-source test the player applies, so the play badge here and the video there
        // can never disagree about whether a movement has footage.
        hasDemo:
          !!meta?.video_mux_id ||
          !!demoSigned.get((meta as { demo_storage_path?: string | null } | undefined)?.demo_storage_path ?? ''),
        groupKey: e.group_key,
        groupKind: e.group_kind,
      };
    });
    return (
      <SessionPreview
        day={dayIndex}
        dayLabel={dayLabel}
        programName={programName}
        weekLine={weekLine}
        exercises={previewExercises}
        startHref={`/workout/${planId}?day=${dayIndex}`}
      />
    );
  }

  // HER CYCLE, WHERE IT IS ACTIONABLE.
  //
  // The phase guidance already existed and was already bilingual — it just never reached the one
  // screen where it changes a decision. She saw it on /you/cycle, and the AI coach knew it if she
  // thought to ask; standing at a machine choosing a weight, the app said nothing. "Go lighter if
  // you need to" read three days ago on a different tab is not the same sentence as read now.
  //
  // Opt-in by behaviour, exactly as the coach context is: no logged period means no phase, which
  // means no line. Nobody is asked to declare anything to use the workout player.
  //
  // Wrapped and best-effort. A tracker failure must never stop her training.
  let cyclePhase: string | null = null;
  try {
    const cycleLogs = await loadCycleLogs(ctx.userId, 12);
    if (cycleLogs.length) {
      const { phase } = currentPhase(cycleLogs, new Date().toISOString().slice(0, 10));
      if (phase !== 'unknown') cyclePhase = phase;
    }
  } catch (e) {
    console.warn('workout cycle phase (non-fatal):', e instanceof Error ? e.message : String(e));
  }
  // Reuses app.cycle.phaseBody, the member-voiced copy her cycle page already shows. A second
  // wording of the same advice is how two screens start disagreeing about what a phase means.
  const tCycle = await getTranslations('app.cycle');
  const cycleNote = cyclePhase ? tCycle(`phaseBody.${cyclePhase}` as never) : null;

  return (
    <div className="h-full">
      <WorkoutPlayer
        sessionId={session.id}
        programName={programName}
        dayLabel={session.day_label}
        exercises={playerExercises}
        cycleNote={cycleNote}
      />
    </div>
  );
}
