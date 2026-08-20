// Activities hub. Requires auth. Resolves the assigned program + today's session
// + logged history, then the client screen switches Program / Library / History.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireEntitledOrPaused } from '@/lib/auth/guards';
import { getAssignedPlans, getProgram } from '@/lib/programs/engine';
import { fetchHistory } from '@/lib/workout/logging';
import { createServiceClient } from '@/lib/supabase/service';
import { getActivation } from '@/lib/member/activation';
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

/** Which week of the program `assignedAt` puts us in, 1-based and clamped to the plan length.
 *  Module scope, NOT the render body: the purity rule bans clock reads inside a component, and a
 *  component that reads a moving clock while rendering is not idempotent. Same shape as
 *  weeksSince() in dashboard/page.tsx. */
function programWeek(assignedAt: string, totalWeeks: number | null): number {
  const elapsed = Math.floor((Date.now() - Date.parse(assignedAt)) / (7 * 86_400_000));
  return Math.min(Math.max(1, elapsed + 1), totalWeeks || 1);
}

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireEntitledOrPaused();
  const { day: dayParam } = await searchParams;
  const locale = await getLocale();
  const tEx = await getTranslations('app.exercise');

  let program: ActivitiesProgram | null = null;
  let history: HistoryItem[] = [];
  let stats: WorkoutStats | null = null;
  // Hoisted: `plans` is scoped to the entitled branch, and the Programs tab needs it at render.
  let allPlans: { id: string; name: string; weeks: number | null }[] = [];

  if (ctx.companyId) {
    // On a break, the program half of this screen is closed and the history half is not. Skipping
    // the lookup rather than hiding the result: a paused member should not be told which plan she
    // is not allowed to open. ActivitiesScreen already renders a null program (it has to — a member
    // waiting on her first plan sees the same thing).
    const plans = ctx.onBreak
      ? []
      : ((await getAssignedPlans(
          ctx.companyId,
          ctx.userId,
        )) as unknown as AssignedPlan[]);
    allPlans = plans.map((pl) => ({
      id: pl.id,
      name: (locale === 'es' && pl.name_es) || pl.name_en || '',
      weeks: pl.weeks ?? null,
    }));
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
          // Resolves a COMMITTED exercise by id. NEVER add .is('archived_at', null) here:
          // curation (0105) must not erase history, and filtering this fails SILENTLY as an
          // untitled card with no demo rather than throwing.
          .from('exercises')
          // demo_storage_path, not video_mux_id alone: her 366 filmed demos live in storage and
          // only 2 rows carry a Mux id, so the play badge on this list appeared on 2 of 1,305
          // movements. Same root cause as the player. No signed URL is minted here, because this
          // screen only needs to know a demo EXISTS; the player signs it when she opens the day.
          .select('id, name_en, name_es, video_mux_id, demo_storage_path')
          .in('id', ids);
        const byId = new Map((exs ?? []).map((e) => [e.id, e]));
        exercises = exList.map((e) => {
          const meta = byId.get(e.exercise_id);
          const reps = e.reps != null ? ` x ${e.reps}` : '';
          return {
            id: e.exercise_id,
            name: (locale === 'es' && meta?.name_es) || meta?.name_en || tEx('untitled'),
            sub: `${e.sets ?? '-'}${reps}`,
            hasDemo: Boolean(
              meta?.video_mux_id || (meta as { demo_storage_path?: string | null } | undefined)?.demo_storage_path,
            ),
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
        week = programWeek(assignedAt, plan.weeks);
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
        // TRUE only while she is on the auto-assigned starter.
        //
        // Compared against the env var rather than a column on plan_assignments: the starter IS
        // that plan id, so the comparison cannot drift, and a coach assigning her something real
        // turns this off by doing so, with nothing to remember to clear.
        //
        // Without it, flipping STARTER_PROGRAM_ID on makes "Steph writes your plan by hand" a
        // half-truth. She opens the app on day one, sees a program, and reasonably concludes that
        // generic starting week is the plan a human wrote for her.
        isStarter: plan.id === (process.env.STARTER_PROGRAM_ID ?? '').trim(),
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

  // Derived, never stored: the checklist ticks itself from her real rows.
  const activation = await getActivation(ctx.userId);
  return (
    // hasStarterProgram is read HERE because STARTER_PROGRAM_ID is server-only by design. The
    // first-run copy has to move with the flag: "Steph writes your plan by hand ... she will
    // message you when it is ready" is true today and becomes a half-truth the moment auto-assign
    // puts a plan there before she asks.
    <ActivitiesScreen
      program={program}
      history={history}
      stats={stats}
      locale={locale}
      activation={activation}
      hasStarterProgram={(process.env.STARTER_PROGRAM_ID ?? '').trim().length > 0}
      // Every plan ever assigned, for the Programs tab. getAssignedPlans already returned them all
      // and the page used only plans[0], so a member on her third block could not look back.
      allPlans={allPlans}
    />
  );
}
