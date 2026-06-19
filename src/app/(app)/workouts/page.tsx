// Activities hub. Requires auth. Resolves the assigned program + today's session
// + logged history, then the client screen switches Program / Library / History.
import type { ReactElement } from 'react';
import { getLocale } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { getAssignedPlans, getProgram } from '@/lib/programs/engine';
import { fetchHistory } from '@/lib/workout/logging';
import { createServiceClient } from '@/lib/supabase/service';
import {
  ActivitiesScreen,
  type ActivitiesProgram,
  type HistoryItem,
} from '@/components/workout/activities-screen';

export const dynamic = 'force-dynamic';

type AssignedPlan = { id: string; name_en: string; name_es: string | null; weeks: number };
type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
};

export default async function WorkoutsPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const locale = await getLocale();

  let program: ActivitiesProgram | null = null;
  let history: HistoryItem[] = [];

  if (ctx.companyId) {
    const plans = (await getAssignedPlans(
      ctx.companyId,
      ctx.userId,
    )) as unknown as AssignedPlan[];
    const plan = plans[0];

    if (plan) {
      const full = await getProgram(ctx.companyId, plan.id);
      const session = full?.sessions[0];
      let exercises: ActivitiesProgram['exercises'] = [];

      if (session) {
        const exList = session.exercises as SessionExercise[];
        const ids = exList.map((e) => e.exercise_id);
        const supabase = createServiceClient();
        const { data: exs } = await supabase
          .from('exercises')
          .select('id, name_en, name_es, video_mux_id')
          .in('id', ids);
        const byId = new Map((exs ?? []).map((e) => [e.id, e]));
        exercises = exList.map((e) => {
          const meta = byId.get(e.exercise_id);
          const reps = e.reps != null ? ` x ${e.reps}` : '';
          return {
            id: e.exercise_id,
            name: (locale === 'es' && meta?.name_es) || meta?.name_en || 'Exercise',
            sub: `${e.sets ?? '-'}${reps}`,
            hasDemo: Boolean(meta?.video_mux_id),
            done: false,
          };
        });
      }

      program = {
        planId: plan.id,
        name: (locale === 'es' && plan.name_es) || plan.name_en,
        week: 1,
        totalWeeks: plan.weeks,
        day: 1,
        totalDays: full?.sessions.length ?? 1,
        pct: 0,
        exercises,
      };
    }

    const raw = await fetchHistory(ctx.companyId, ctx.userId);
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    history = raw.map((h) => ({
      id: h.id,
      date: fmt.format(new Date(h.performed_at)),
      completionPct: h.completion_pct,
      enjoyment: h.enjoyment,
      effort: h.effort,
    }));
  }

  return <ActivitiesScreen program={program} history={history} locale={locale} />;
}
