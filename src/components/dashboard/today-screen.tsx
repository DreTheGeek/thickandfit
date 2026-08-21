'use client';

// Subscriber "Today" home. Four UI states (loading / error / first-run / content),
// restyled to the design-handoff prototype. Date strip is computed server-side and
// passed in to avoid hydration drift.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import type { WeeklyTarget } from '@/lib/training/weekly-target-shared';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { STEP_GOAL, SLEEP_GOAL_MIN, formatSleep } from '@/lib/dailymetrics/goals';
import { FirstRunState } from '@/components/states/first-run-state';
import { Card } from '@/components/ui/card';
import { TransformCard, PlanCard, SmallCard, type PlanRow } from '@/components/portal/today-cards';
import { CaptureSheet, type CaptureKind } from '@/components/portal/capture-sheet';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { CompletionCheck } from '@/components/ui/completion';
import { SectionTitle } from '@/components/ui/section';
import { ProgressRing, ProgressBar } from '@/components/ui/ring';
import type { DashboardSummary } from '@/lib/dashboard/summary';
import type { MacroTotals } from '@/lib/nutrition/macros';
import { toggleHabitAction } from '@/lib/habits/habit-actions';
import type { TodayHabit } from '@/lib/habits/habits';

export type TodayNutrition = { consumed: MacroTotals; target: MacroTotals };

export type CatchUp = {
  broadcast: { author: string; body: string } | null;
  challenge: { title: string; progress: number; goal: number | null; daysLeft: number } | null;
};

export type WeekDay = { key: string; label: string; day: number; isToday: boolean; completed?: boolean };
export type WeightGoal = { startLb: number; currentLb: number; goalLb: number; pct: number };
export type TodayCoach = { name: string };

export function TodayScreen({
  dateLabel: dateLabelInit,
  weekDays: weekDaysInit,
  initial,
  habits: habitsInit,
  nutrition,
  catchUp,
  weightGoal,
  coach,
  supportEmail,
  daily,
  weekly,
  intelligence,
  tour,
}: {
  dateLabel: string;
  weekDays: WeekDay[];
  initial: DashboardSummary | null;
  habits: TodayHabit[];
  nutrition: TodayNutrition | null;
  catchUp: CatchUp | null;
  weightGoal: WeightGoal | null;
  coach: TodayCoach | null;
  supportEmail: string;
  daily: { steps: number | null; sleepMinutes: number | null };
  /** Her training week against the days she said she can manage. Null when there is no read. */
  weekly?: WeeklyTarget | null;
  /** K9: server-rendered intelligence strip, passed in as a slot. It is a SERVER component (all of
   *  its data is derived server-side and none of it is interactive), so it cannot be imported here
   *  in a 'use client' module and arrives as a prop instead. */
  intelligence?: ReactNode;
  /** The first-run checklist. Server-rendered and passed in, same as `intelligence`. */
  tour?: ReactNode;
}): ReactElement {
  const t = useTranslations('app');
  const locale = useLocale();
  const [summary, setSummary] = useState<DashboardSummary | null>(initial);
  const [habits, setHabits] = useState<TodayHabit[]>(habitsInit);

  // Optimistic habit check-off; revert on server failure.
  async function toggleHabit(id: string, done: boolean): Promise<void> {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, done } : h)));
    const res = await toggleHabitAction(id, done);
    if (!res.ok) setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, done: !done } : h)));
  }
  // A null summary is a companyless / not-yet-provisioned session, not a fetch error.
  // Start idle and surface a dedicated "account setup pending" state below.
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  // Which capture sheet is open, if any. Steps and sleep have no sync source, so the plan card's
  // MOVE and RECOVER rows open this rather than navigating.
  const [capture, setCapture] = useState<CaptureKind | null>(null);

  // The server computes the date strip in UTC, which mislabels "today" for the LATAM evening audience
  // (UTC-5/-6). SSR uses the server props as a stable placeholder (no hydration drift); after mount we
  // recompute from the browser's local timezone so the date label + highlighted day are correct.
  const [dateLabel, setDateLabel] = useState(dateLabelInit);
  const [weekDays, setWeekDays] = useState(weekDaysInit);
  useEffect(() => {
    const now = new Date();
    setDateLabel(
      new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    );
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const active = new Set(summary?.activeDays ?? []);
    const isoOf = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setWeekDays(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return {
          key: String(i),
          label: narrow.format(d),
          day: d.getDate(),
          isToday: d.toDateString() === now.toDateString(),
          completed: active.has(isoOf(d)),
        };
      }),
    );
  }, [locale, summary]);

  // Plateau banner dismissal. We key the dismissed flag by the plateau span so a freshly-extended
  // plateau re-surfaces the banner instead of staying hidden forever. Persisted in localStorage so
  // a dismissal survives navigation/refresh. Hydration-safe: starts hidden, reveals after mount.
  const plateau = summary?.plateau ?? null;
  const plateauKey = plateau ? `tf:plateau-dismissed:${plateau.daysFlat}` : null;
  const [plateauDismissed, setPlateauDismissed] = useState(true);
  useEffect(() => {
    if (!plateauKey) return;
    setPlateauDismissed(window.localStorage.getItem(plateauKey) === '1');
  }, [plateauKey]);

  function dismissPlateau(): void {
    if (plateauKey) window.localStorage.setItem(plateauKey, '1');
    setPlateauDismissed(true);
  }

  async function refresh(): Promise<void> {
    setState('loading');
    try {
      const res = await fetch('/api/dashboard/summary');
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        setSummary(json.data);
        setState('idle');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }


  // Header: wordmark only. The streak now lives in the dark hero (canonical), and the bell +
  // messages entry live in the app top bar / rail (rendered by the layout).
  const header = (
    <div className="mb-[18px] flex items-center justify-between">
      <div>
        <h1 className="tf-display text-[25px] font-black leading-none tracking-[-1px]">
          {t('nav.today')}
        </h1>
        <small className="mt-0.5 block text-muted">{dateLabel}</small>
      </div>
      <Link
        href="/you"
        aria-label={t('nav.you')}
        className="tf-press grid h-9 w-9 place-items-center rounded-full bg-warm text-ink"
      >
        <Icon name="user" size={16} />
      </Link>
    </div>
  );
  if (state === 'loading') {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-5 h-36 rounded-2xl" />
        <Skeleton className="mt-5 h-14" />
        <Skeleton className="mt-3 h-14" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <ErrorState onRetry={refresh} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <FirstRunState
          title={t('today.setupPendingTitle')}
          message={t('today.setupPendingBody')}
          action={
            <ButtonLink href={`mailto:${supportEmail}`} size="md">
              {t('today.setupPendingCta')}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!summary.hasOnboarded) {
    return (
      <div className="px-[22px] pb-7 pt-3">
        {header}
        <FirstRunState
          title={locale === 'es' ? 'Crea tu plan' : 'Build your plan'}
          message={
            locale === 'es'
              ? 'Responde unas preguntas para tus macros y un programa que se ajuste a tu vida.'
              : 'Answer a few questions to get your custom macros and a program that fits your life.'
          }
          action={
            <ButtonLink href="/onboarding" size="md">
              {locale === 'es' ? 'Empezar' : 'Start onboarding'}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  // Today's mission: the four pillars TRAIN / FUEL / MOVE / RECOVER, matching the marketing. Train
  // and Fuel derive from the assigned workout and the food diary; Move and Recover are self-reported
  // via daily_metrics (tap the row to log steps / sleep). Habits still appears when the member has
  // habits set. Nothing invented: an unlogged Move/Recover row prompts to log, never shows a fake.


  // The handoff's four rows, from data this screen already holds. Green only where a target is hit,
  // which is the functional-only rule the light system had and 8.0 keeps.
  const proteinLeft = nutrition
    ? Math.max(0, Math.round(nutrition.target.proteinG - nutrition.consumed.proteinG))
    : 0;
  const steps = daily.steps;
  const sleepMin = daily.sleepMinutes;
  const planRows: PlanRow[] = [
    {
      key: 'train',
      title: t('today.missionTrain'),
      // HER WEEK, in front of the session name.
      //
      // Nothing on this app has ever been able to tell a member following her programme correctly
      // that she is on track. The streak cannot: it counts an any-activity union, so it says nothing
      // about training. And training is not a daily act - by her own answer it happens 3, 4 or 5
      // days out of 7 - so a daily ladder is the wrong instrument for it entirely.
      //
      // Falls back to the plan name alone when she has no target, rather than printing "0 of 3" at
      // somebody who never set one.
      sub: weekly
        ? [
            weekly.mode === 'target'
              ? t('today.weekTarget', { done: weekly.done, target: weekly.target ?? 0 })
              : t('today.weekCount', { done: weekly.done }),
            summary.todaysWorkout?.name ?? t('activities.noProgram'),
          ].join(' · ')
        : (summary.todaysWorkout?.name ?? t('activities.noProgram')),
      hit: weekly?.met === true,
      href: '/workouts',
      action: t('activities.startWorkout'),
    },
    {
      key: 'fuel',
      title: t('today.missionFuel'),
      sub: nutrition
        ? `${Math.round(nutrition.consumed.proteinG)} / ${Math.round(nutrition.target.proteinG)}g`
        : t('today.logMeal'),
      href: '/nutrition',
      action: t('today.actionLog'),
    },
    {
      key: 'move',
      title: t('today.missionMove'),
      // NOT `(steps ?? 0)`. That rendered "0 / 10,000" to a member who had simply not told us yet,
      // which is a measurement she never gave presented as one she did: a woman who walked 12,000
      // steps was shown a zero. Nothing syncs steps, so absent means unknown, and the honest row
      // asks instead of asserting.
      sub:
        steps == null
          ? t('today.missionLogSteps')
          : `${steps.toLocaleString(locale)} / ${STEP_GOAL.toLocaleString(locale)}`,
      value: steps == null ? undefined : steps.toLocaleString(locale),
      hit: steps != null && steps >= STEP_GOAL,
      onCapture: () => setCapture('steps'),
    },
    {
      key: 'recover',
      title: t('today.missionRecover'),
      sub: sleepMin == null ? t('today.missionLogSleep') : formatSleep(sleepMin),
      value: sleepMin == null ? undefined : formatSleep(sleepMin),
      hit: sleepMin != null && sleepMin >= SLEEP_GOAL_MIN,
      onCapture: () => setCapture('sleep'),
    },
  ];

  return (
    <div className="px-[22px] pb-7 pt-3">
      {header}

      {/* ABOVE the transformation card, and only while it has anything to say.
          On day one every number below is a zero: 0% to goal, 0 of 197g protein, an empty week
          strip. A wall of zeroes is not a dashboard, it is an empty room, and it is the first thing
          a new member sees. This is what belongs there until she has filled it in. */}
      {tour}

      {/* 8.0 Today: transformation status, the day's four asks, then the two-up. This is the whole
          screen the handoff draws. The modules below it (habits, nutrition detail, catch-up) are
          features the handoff simply does not depict; they are kept, restyled, rather than deleted. */}
      {weightGoal ? (
        <TransformCard
          labelStatus={t('today.transformStatus')}
          labelToGoal={t('today.toGoal')}
          labelStart={t('today.goalStart')}
          labelCurrent={t('today.goalCurrent')}
          labelGoal={t('today.goalGoal')}
          pct={weightGoal.pct}
          startLb={weightGoal.startLb}
          currentLb={weightGoal.currentLb}
          goalLb={weightGoal.goalLb}
        />
      ) : null}

      <PlanCard title={t('today.planTitle')} rows={planRows} />

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {proteinLeft > 0 ? (
          <SmallCard
            label={t('today.nextBest')}
            heading={t('today.proteinLeft', { n: proteinLeft })}
          >
            <Link href="/nutrition" className="tf-press text-[10px] font-semibold text-accent">
              {t('today.logMeal')}
            </Link>
          </SmallCard>
        ) : null}

        {catchUp?.challenge ? (
          <SmallCard label={t('today.challenge')} heading={catchUp.challenge.title}>
            <div className="text-[10px] text-soft">
              {t('today.daysLeft', { n: catchUp.challenge.daysLeft })}
            </div>
          </SmallCard>
        ) : null}
      </div>


      {/* Nutrition first: the moat lives on the home screen. Cal-AI-style calories-left hero. */}
      {nutrition ? <NutritionCard n={nutrition} t={t} /> : null}

      {/* Catch-up: newest coach broadcast + active challenge progress, so home feels alive. */}
      {intelligence}
      {catchUp && (catchUp.broadcast || catchUp.challenge) ? <CatchUpCard c={catchUp} t={t} /> : null}

      {/* Plateau nudge: dismissible, only when the latest insight flags an active plateau. */}
      {plateau && !plateauDismissed ? (
        <Card className="mt-5 flex items-start gap-3 p-[18px]">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent/15 text-accent">
            <Icon name="pulse" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="tf-display text-[18px] leading-[1.1]">
              {t('today.plateauTitle')}
            </div>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-faint">
              {t('today.plateauBody', { days: plateau.daysFlat })}
            </p>
            <Link
              href="/coach-chat"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent"
            >
              {t('today.plateauCta')}
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissPlateau}
            aria-label={t('common.dismiss')}
            className="tf-press -mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center text-faint"
          >
            <Icon name="x" size={16} />
          </button>
        </Card>
      ) : null}

      {/* Week strip */}
      <div className="mt-[22px] flex justify-between">
        {weekDays.map((d) => (
          <div key={d.key} className="text-center">
            <div className="text-[11px] text-faint">{d.label}</div>
            {d.isToday ? (
              // text-bg, not text-white: bg-ink is #ffffff inside .tf-portal, so a literal white
              // number sat invisible inside a white circle and today had no date on it.
              <div className="mx-auto mt-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[13px] text-bg">
                {d.day}
              </div>
            ) : d.completed ? (
              <div className="mx-auto mt-1 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-accent text-[13px] font-semibold text-ink">
                {d.day}
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-faint">{d.day}</div>
            )}
          </div>
        ))}
      </div>

      {/* "Things to do" lived here: one row pointing at today's workout, which is exactly the
          TRAIN row in the plan card above. */}

      {/* Your habits (canonical card with a done count) */}
      {habits.length > 0 && (
        <div className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              {t('today.habitsTitle')}
            </span>
            <span className="text-[12px] font-semibold text-accent">
              {habits.filter((h) => h.done).length}/{habits.length}
            </span>
          </div>
          <Card className="divide-y divide-divider p-0">
            {habits.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-[14px] font-medium">{h.title}</span>
                <button
                  type="button"
                  onClick={() => void toggleHabit(h.id, !h.done)}
                  // -m-2 p-2 expands the tap area to ~40px around the 24px check without shifting the
                  // row layout (the negative margin cancels the padding). Was a 24px target.
                  className="tf-press -m-2 p-2"
                  aria-label={h.title}
                >
                  <CompletionCheck done={h.done} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* The old goal card lived here. TransformCard above is the same three numbers in the
          8.0 treatment, so keeping both showed her weight twice on one screen. */}

      {/* Coach card -> messages */}
      {coach && (
        <Link href="/inbox" className="tf-press mt-6 block">
          <Card className="flex items-center gap-3.5 p-4">
            <Avatar initials={initialsOf(coach.name)} size={44} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
                {t('today.coachLabel')}
              </div>
              <div className="truncate text-[15px] font-semibold">{coach.name}</div>
            </div>
            <span className="flex flex-none items-center gap-1 text-[13px] font-semibold text-accent">
              {t('today.messageCoach')}
              <Icon name="chevronRight" size={14} />
            </span>
          </Card>
        </Link>
      )}

      {capture && <CaptureSheet kind={capture} onClose={() => setCapture(null)} />}
    </div>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

// Today's nutrition, Cal-AI style: a big calories-LEFT ring that depletes as you log, plus three macro
// rings that count DOWN to zero (and flip to "+Xg over" when you blow the target). The moat, on home.
function NutritionCard({
  n,
  t,
}: {
  n: TodayNutrition;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  const { consumed, target } = n;
  const kcalLeft = Math.round(target.kcal - consumed.kcal);
  const kcalPct = target.kcal > 0 ? (consumed.kcal / target.kcal) * 100 : 0;
  const kcalOver = kcalLeft < 0;
  const macros = [
    { key: 'p', label: t('today.macroProtein'), got: consumed.proteinG, goal: target.proteinG, color: 'var(--color-macro-protein)' },
    { key: 'c', label: t('today.macroCarbs'), got: consumed.carbG, goal: target.carbG, color: 'var(--color-macro-carbs)' },
    { key: 'f', label: t('today.macroFat'), got: consumed.fatG, goal: target.fatG, color: 'var(--color-macro-fat)' },
  ];
  return (
    <Card className="mt-5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
          {t('today.nutritionTitle')}
        </span>
        <Link href="/nutrition" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
          {t('today.logMeal')}
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
      <div className="flex items-center gap-5">
        <ProgressRing
          pct={Math.min(100, kcalPct)}
          size={116}
          thickness={9}
          color={kcalOver ? 'var(--c-alert)' : 'var(--c-ink)'}
        >
          <div className="text-center">
            <div className="tf-display text-[28px] leading-none">{Math.abs(kcalLeft)}</div>
            <div className="text-[10px] uppercase tracking-[1.5px] text-faint">
              {kcalOver ? t('today.kcalOverLabel') : t('today.kcalLeftLabel')}
            </div>
          </div>
        </ProgressRing>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {macros.map((m) => {
            const left = Math.round(m.goal - m.got);
            const pct = m.goal > 0 ? (m.got / m.goal) * 100 : 0;
            return (
              <div key={m.key} className="flex flex-col items-center gap-1.5">
                <ProgressRing pct={Math.min(100, pct)} size={58} thickness={6} color={m.color}>
                  <span className="text-[13px] font-bold">{left < 0 ? `+${-left}` : left}</span>
                </ProgressRing>
                <span className="text-[11px] text-faint">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// Catch-up: the newest coach broadcast + the active challenge progress. Makes the home feel alive
// (the AI Junkies "mission control" pattern) instead of a static form. Taps through to /community.
function CatchUpCard({
  c,
  t,
}: {
  c: CatchUp;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  return (
    <div className="mt-6">
      <SectionTitle className="mb-2.5" action={<Link href="/community">{t('common.viewAll')}</Link>}>
        {t('today.catchUpTitle')}
      </SectionTitle>
      <div className="flex flex-col gap-2">
        {c.broadcast ? (
          <Link href="/community" className="tf-press block">
            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[1px] text-accent">
                {c.broadcast.author}
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed">{c.broadcast.body}</p>
            </Card>
          </Link>
        ) : null}
        {c.challenge ? (
          <Link href="/community" className="tf-press block">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">{c.challenge.title}</span>
                <span className="shrink-0 text-[12px] text-faint">
                  {t('today.daysLeft', { n: String(c.challenge.daysLeft) })}
                </span>
              </div>
              {c.challenge.goal ? (
                <div className="mt-2.5">
                  <ProgressBar
                    pct={c.challenge.goal > 0 ? (c.challenge.progress / c.challenge.goal) * 100 : 0}
                    color="var(--c-accent)"
                    height={6}
                  />
                  <div className="mt-1 text-[12px] text-faint">
                    {Math.round(c.challenge.progress)} / {c.challenge.goal}
                  </div>
                </div>
              ) : null}
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

