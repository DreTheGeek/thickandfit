// Activities hub. Requires auth. Resolves the assigned program + today's session
// + logged history, then the client screen switches Program / Library / History.
import type { ReactElement } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { getWeeklyTarget } from '@/lib/training/weekly-target';
import { requireEntitledOrPaused } from '@/lib/auth/guards';
import { getAssignedPlans, getProgram } from '@/lib/programs/engine';
import { fetchHistory } from '@/lib/workout/logging';
import { createServiceClient } from '@/lib/supabase/service';
import { getActivation } from '@/lib/member/activation';
import {
  ActivitiesScreen,
  type ActivitiesProgram,
  type HistoryExercise,
  type HistoryItem,
  type WorkoutStats,
} from '@/components/workout/activities-screen';

export const dynamic = 'force-dynamic';

type AssignedPlan = {
  id: string;
  name_en: string;
  name_es: string | null;
  weeks: number;
  /** NULL means the matcher chose this plan rather than a coach. Drives the first-run copy. */
  assignedBy: string | null;
};
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
  /** A set_logs row as this page selects it; `exercises` is an array in the generated types. */
  type SetRow = {
    workout_log_id: string | null;
    weight: number | string | null;
    reps: number | null;
    completed: boolean | null;
    exercises: { name_en: string | null } | { name_en: string | null }[] | null;
  };
  let history: HistoryItem[] = [];
  let stats: WorkoutStats | null = null;
  // Hoisted: `plans` is scoped to the entitled branch, and the Programs tab needs it at render.
  let allPlans: { id: string; name: string; weeks: number | null }[] = [];
  let autoAssignedPlanIds = new Set<string>();

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
    // The plans SHE was given without a human choosing them. Drives the first-run copy: see
    // isStarter below.
    autoAssignedPlanIds = new Set(
      plans.filter((pl) => pl.assignedBy == null).map((pl) => pl.id),
    );
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
        // TRUE only while she is on a program the SOFTWARE chose.
        //
        // Read from plan_assignments.assigned_by (0149), not from STARTER_PROGRAM_ID. The env var
        // stopped being the right signal the moment the matcher could assign without it being set:
        // it would have said "a coach wrote this by hand" about a plan nobody had looked at.
        // A coach assigning her something turns this off by doing so, with nothing to remember to
        // clear, which is the property the old comparison was reaching for and no longer had.
        //
        // Without it, "Steph writes your plan by hand, she will message you when it is ready"
        // becomes a half-truth: she opens the app on day one, sees a program, and reasonably
        // concludes that generic starting week is the plan a human wrote for her.
        isStarter: autoAssignedPlanIds.has(plan.id),
      };
    }

    const raw = await fetchHistory(ctx.companyId, ctx.userId);
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    /**
     * THE SETS, per session. Same single query that already computed the volume band, widened.
     *
     * History used to render a date and a percentage, so a member who had just done 32 sets across
     * 11 movements could not see one thing she had lifted. The rows were always here; this query
     * was already reading them and throwing away everything except weight x reps.
     *
     * `exercises(name_en)` comes back as an ARRAY from the generated types even though the foreign
     * key makes it at most one row, so it is normalised rather than cast.
     */
    const logIds = raw.map((r) => r.id);
    let volumeLb = 0;
    const detail = new Map<string, { setCount: number; volumeLb: number; moves: Map<string, HistoryExercise> }>();
    if (logIds.length) {
      const { data: sets } = await createServiceClient()
        .from('set_logs')
        .select('workout_log_id, weight, reps, completed, exercises(name_en)')
        .in('workout_log_id', logIds)
        .order('set_number', { ascending: true })
        .limit(3000);

      for (const row of (sets ?? []) as SetRow[]) {
        const w = Number(row.weight) || 0;
        const reps = Number(row.reps) || 0;
        volumeLb += w * reps;

        // A skipped set is not something she did, so it counts toward neither the movement list nor
        // the set count. It still counts toward volume above, where the old behaviour is preserved
        // rather than quietly changed: the stats band is a separate claim from this list.
        if (row.completed === false) continue;
        const logId = row.workout_log_id;
        if (!logId) continue;
        const embedded = row.exercises;
        const one = Array.isArray(embedded) ? embedded[0] : embedded;
        const name = (one?.name_en ?? '').trim();
        if (!name) continue;

        const d = detail.get(logId) ?? { setCount: 0, volumeLb: 0, moves: new Map() };
        d.setCount += 1;
        d.volumeLb += w * reps;
        const mv = d.moves.get(name) ?? { name, sets: 0, reps: [], topWeightLb: null };
        mv.sets += 1;
        if (reps > 0) mv.reps.push(reps);
        // 0 is what the player writes for banded and bodyweight work, and "0 lb" on screen reads as
        // a data error rather than as a push-up. Null means no external load.
        if (w > 0 && (mv.topWeightLb == null || w > mv.topWeightLb)) mv.topWeightLb = w;
        d.moves.set(name, mv);
        detail.set(logId, d);
      }
    }

    history = raw.map((h) => {
      const d = detail.get(h.id);
      return {
        id: h.id,
        date: fmt.format(new Date(h.performed_at)),
        completionPct: h.completion_pct,
        enjoyment: h.enjoyment,
        effort: h.effort,
        setCount: d?.setCount ?? 0,
        volumeLb: Math.round(d?.volumeLb ?? 0),
        exercises: d ? [...d.moves.values()] : [],
      };
    });
    stats = {
      // Was a ROLLING 7 DAYS off workout_logs.performed_at, which is two separate problems: it is a
      // different number from the calendar week every other surface uses, and slicing that column
      // gives a UTC day, so an evening session west of UTC counted as tomorrow. Now her actual
      // week, in her timezone, against the days she said she can train.
      total: raw.length,
      volumeLb,
    };
  }

  // Derived, never stored: the checklist ticks itself from her real rows.
  const activation = await getActivation(ctx.userId);

  // Her week. Resolved here rather than inside the screen because it reads her health profile and
  // her assignment, and because a clock read belongs in the page body, not in a render.
  //
  // Fails to NULL, never to a number: a read that broke must not be able to invent a goal she is
  // then measured against. The stat cell falls back to a bare count.
  const weekly = ctx.companyId ? await getWeeklyTarget(ctx.userId, ctx.companyId).catch((e: unknown) => {
    console.error('workouts weekly target:', e instanceof Error ? e.message : e);
    return null;
  }) : null;
  return (
    // hasStarterProgram now answers "did a human choose any of this", read from assigned_by rather
    // than from an env var. The first-run copy has to move with the reality: "Steph writes your plan
    // by hand ... she will message you when it is ready" is true when a coach assigned it, and a
    // half-truth the moment the matcher put a plan there before she asked.
    <ActivitiesScreen
      program={program}
      history={history}
      stats={stats}
      weekly={weekly}
      locale={locale}
      activation={activation}
      hasStarterProgram={autoAssignedPlanIds.size > 0}
      // Every plan ever assigned, for the Programs tab. getAssignedPlans already returned them all
      // and the page used only plans[0], so a member on her third block could not look back.
      allPlans={allPlans}
    />
  );
}
