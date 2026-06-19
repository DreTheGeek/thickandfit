// Program builder page. Coach-guarded. id === 'new' starts blank, otherwise loads the program.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { ProgramBuilder, type BuilderInitial } from '@/components/coach/program-builder';

export const dynamic = 'force-dynamic';

type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  rest_sec: number | null;
};

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  const locale = await getLocale();
  const supabase = createServiceClient();

  let initial: BuilderInitial = { nameEn: '', nameEs: '', weeks: 4, days: [] };
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
          ? await supabase.from('exercises').select('id, name_en, name_es').in('id', allIds)
          : { data: [] };
        const nameById = new Map((exs ?? []).map((e) => [e.id, (locale === 'es' && e.name_es) || e.name_en]));
        initial = {
          id: program.plan.id,
          nameEn: program.plan.name_en,
          nameEs: program.plan.name_es ?? '',
          weeks: program.plan.weeks,
          days: program.sessions.map((s) => ({
            label: s.day_label,
            exercises: (s.exercises as SessionExercise[]).map((e) => ({
              exercise_id: e.exercise_id,
              name: nameById.get(e.exercise_id) ?? 'Exercise',
              sets: e.sets ?? 3,
              reps: e.reps ?? 10,
              rest: e.rest_sec ?? 60,
            })),
          })),
        };
      }
    }
  }

  return <ProgramBuilder initial={initial} subscribers={subscribers} />;
}
