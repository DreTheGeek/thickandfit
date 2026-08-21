// Program builder page. Coach-guarded. id === 'new' starts blank, otherwise loads the program.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { readCoachSettings } from '@/lib/coach/settings';
import { demoUrls } from '@/lib/exercises/demo-url';
import { ProgramBuilder, type BuilderInitial } from '@/components/coach/program-builder';

export const dynamic = 'force-dynamic';

/**
 * EVERY column, not a convenient subset.
 *
 * saveProgram deletes and re-inserts, so a field this page fails to LOAD is a field the builder
 * cannot send back, and one save erases it. See .qa-visual/program-roundtrip-test.mjs.
 */
type SessionExercise = {
  exercise_id: string;
  format: 'straight' | 'circuit' | 'superset' | null;
  sets: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  is_amrap: boolean | null;
  time_sec: number | null;
  weight: number | null;
  rest_sec: number | null;
  rounds: number | null;
  notes: string | null;
  group_key: string | null;
  group_kind: string | null;
};

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  const locale = await getLocale();
  const tEx = await getTranslations('app.exercise');
  const supabase = createServiceClient();

  // "Default training plan name" (coach settings). Applied to the English name only: the preference
  // is one string, and copying it into name_es would present a guess as a translation.
  const { defaultTrainingPlanName } = await readCoachSettings(ctx.companyId);
  let initial: BuilderInitial = {
    nameEn: id === 'new' ? defaultTrainingPlanName : '',
    nameEs: '',
    weeks: 4,
    days: [],
  };
  let subscribers: { id: string; name: string }[] = [];

  if (ctx.companyId) {
    const { data: subs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_id', ctx.companyId)
      .in('role', ['subscriber', 'free'])
      .order('created_at', { ascending: false });
    subscribers = (subs ?? []).map((s) => ({ id: s.id, name: (s.full_name ?? s.email).trim() }));

    if (id !== 'new') {
      const program = await getProgram(ctx.companyId, id);
      if (program) {
        const allIds = program.sessions.flatMap((s) => (s.exercises as SessionExercise[]).map((e) => e.exercise_id));
        const { data: exs } = allIds.length
          ? await supabase
              .from('exercises')
              .select('id, name_en, name_es, equipment, muscle_group, demo_storage_path')
              .in('id', allIds)
          : { data: [] };
        const metaById = new Map((exs ?? []).map((e) => [e.id, e]));

        // ONE round trip for every demo in the program. "What these should be is the videos that go
        // to these workouts": a builder that lists 22 movement NAMES is a spreadsheet, and the whole
        // reason this app exists rather than a spreadsheet is that she filmed 366 of them.
        //
        // Signed URLs, because the bucket is private and a storage path in the DOM is an index of
        // the library.
        const demoSigned = await demoUrls(
          (exs ?? [])
            .map((e) => e.demo_storage_path)
            .filter((p): p is string => typeof p === 'string' && p.length > 0),
        );

        initial = {
          id: program.plan.id,
          nameEn: program.plan.name_en,
          nameEs: program.plan.name_es ?? '',
          weeks: program.plan.weeks,
          // The taxonomy the starter matcher reads. Loaded so a save cannot blank it, same rule as
          // every other field on this screen.
          daysPerWeek: (program.plan as { days_per_week?: number | null }).days_per_week ?? null,
          level: (program.plan as { level?: string | null }).level ?? null,
          location: (program.plan as { location?: string | null }).location ?? null,
          isStarterCandidate:
            (program.plan as { is_starter_candidate?: boolean }).is_starter_candidate === true,
          days: program.sessions.map((s) => ({
            label: s.day_label,
            exercises: (s.exercises as SessionExercise[]).map((e) => {
              const meta = metaById.get(e.exercise_id);
              return {
                exercise_id: e.exercise_id,
                name: (locale === 'es' && meta?.name_es) || meta?.name_en || tEx('untitled'),
                equipment: meta?.equipment ?? null,
                muscle: meta?.muscle_group ?? null,
                demoUrl: demoSigned.get(meta?.demo_storage_path ?? '') ?? null,
                // Loaded as they are, nulls included. A `?? 3` here would turn "she prescribed no
                // sets" into "she prescribed three" the moment anyone opened the plan.
                format: e.format ?? 'straight',
                sets: e.sets,
                reps: e.reps,
                repsMin: e.reps_min,
                repsMax: e.reps_max,
                isAmrap: e.is_amrap === true,
                timeSec: e.time_sec,
                weight: e.weight,
                rest: e.rest_sec,
                rounds: e.rounds,
                notes: e.notes,
                groupKey: e.group_key,
                groupKind: e.group_kind,
              };
            }),
          })),
        };
      }
    }
  }

  return <ProgramBuilder initial={initial} subscribers={subscribers} />;
}
