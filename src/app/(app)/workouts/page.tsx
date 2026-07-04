// Activities hub. Requires auth. Resolves the assigned program + today's session
// + logged history, then the client screen switches Program / Library / History.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitled } from '@/lib/auth/guards';
import { getAssignedPlans, getProgram } from '@/lib/programs/engine';
import { fetchHistory } from '@/lib/workout/logging';
import { createServiceClient } from '@/lib/supabase/service';
import {
  ActivitiesScreen,
  type ActivitiesProgram,
  type HistoryItem,
  type WorkoutStats,
} from '@/components/workout/activities-screen';

export const dynamic = 'force-dynamic';

type AssignedPlan = { id: string; name_en: string; name_es: string | null; weeks: number };
type SessionExercise = {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
};

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitled();
  const { day: dayParam } = await searchParams;
  const locale = await getLocale();
  const tEx = await getTranslations('app.exercise');

  let program: ActivitiesProgram | null = null;
  let history: HistoryItem[] = [];
  let stats: WorkoutStats | null = null;

  if (ctx.companyId) {
    const plans = (await getAssignedPlans(
      ctx.companyId,
      ctx.userId,
    )) as unknown as AssignedPlan[];
    const plan = plans[0];

    if (plan) {
      const full = await getProgram(ctx.companyId, plan.id);
      const sessions = full?.sessions ?? [];
      // Clamp the requested day into range so days 2..N are reachable and a bad value
      // safely falls back to day 1.
      const parsedDay = Number(dayParam);
      const dayIndex =
        Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay < sessions.length
          ? parsedDay
          : 0;
      const session = sessions[dayIndex];
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
            name: (locale === 'es' && meta?.name_es) || meta?.name_en || tEx('untitled'),
            sub: `${e.sets ?? '-'}${reps}`,
            hasDemo: Boolean(meta?.video_mux_id),
            done: false,
          };
        });
      }

      // Real completion state: the latest logged session for THIS day marks which exercises are done
      // and the session completion %, and the assignment date tells us which week the client is in -
      // instead of the old hardcoded week 1 / 0% / all-unchecked hero.
      let pct = 0;
      const svc2 = createServiceClient();
      if (session) {
        const { data: lastLog } = await svc2
          .from('workout_logs')
          .select('id, completion_pct')
          .eq('profile_id', ctx.userId)
          .eq('session_id', session.id)
          .order('performed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const log = lastLog as { id: string; completion_pct: number | null } | null;
        if (log) {
          const { data: setRows } = await svc2.from('set_logs').select('exercise_id').eq('workout_log_id', log.id);
          const doneIds = new Set(((setRows ?? []) as { exercise_id: string }[]).map((s) => s.exercise_id));
          exercises = exercises.map((e) => ({ ...e, done: doneIds.has(e.id) }));
          const doneCount = exercises.filter((e) => e.done).length;
          pct = log.completion_pct ?? (exercises.length ? Math.round((doneCount / exercises.length) * 100) : 0);
        }
      }
      // Week = whole weeks elapsed since the plan was assigned (1-based), clamped to the plan length.
      let week = 1;
      const { data: asn } = await svc2
        .from('plan_assignments')
        .select('assigned_at')
        .eq('profile_id', ctx.userId)
        .eq('plan_id', plan.id)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const assignedAt = (asn as { assigned_at: string | null } | null)?.assigned_at;
      if (assignedAt) {
        const elapsedWeeks = Math.floor((Date.now() - Date.parse(assignedAt)) / (7 * 86400000));
        week = Math.min(Math.max(1, elapsedWeeks + 1), plan.weeks || 1);
      }

      program = {
        planId: plan.id,
        name: (locale === 'es' && plan.name_es) || plan.name_en,
        week,
        totalWeeks: plan.weeks,
        day: dayIndex + 1,
        totalDays: sessions.length || 1,
        pct,
        days: sessions.map((s, i) => ({
          index: i,
          label: s.day_label || `Day ${i + 1}`,
        })),
        activeDay: dayIndex,
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

    // Program stats band (This week / Total / Volume lb), computed from the logged history.
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();
    const logIds = raw.map((r) => r.id);
    let volumeLb = 0;
    if (logIds.length) {
      const { data: sets } = await createServiceClient()
        .from('set_logs')
        .select('weight, reps')
        .in('workout_log_id', logIds);
      volumeLb = (sets ?? []).reduce(
        (a, s) => a + (Number(s.weight) || 0) * (Number(s.reps) || 0),
        0,
      );
    }
    stats = {
      thisWeek: raw.filter((r) => String(r.performed_at) >= weekAgoISO).length,
      total: raw.length,
      volumeLb,
    };
  }

  return <ActivitiesScreen program={program} history={history} stats={stats} locale={locale} />;
}
