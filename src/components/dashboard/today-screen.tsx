'use client';

// Subscriber "Today" home. Four UI states (loading / error / first-run / content),
// restyled to the design-handoff prototype. Date strip is computed server-side and
// passed in to avoid hydration drift.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Skeleton } from '@/components/states/skeleton';
import { ErrorState } from '@/components/states/error-state';
import { FirstRunState } from '@/components/states/first-run-state';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Wordmark } from '@/components/ui/wordmark';
import { Icon } from '@/components/ui/icons';
import { IconTile, ListRow } from '@/components/ui/list-row';
import { CompletionCheck } from '@/components/ui/completion';
import { SectionTitle } from '@/components/ui/section';
import { MacroRing } from '@/components/coach/macro-ring';
import { ProgressBar } from '@/components/ui/ring';
import type { DashboardSummary } from '@/lib/dashboard/summary';
import type { MacroTotals } from '@/lib/nutrition/macros';
import { toggleHabitAction } from '@/lib/habits/habit-actions';
import type { TodayHabit } from '@/lib/habits/habits';

export type TodayNutrition = { consumed: MacroTotals; target: MacroTotals };

export type WeekDay = { key: string; label: string; day: number; isToday: boolean };

export function TodayScreen({
  name,
  dateLabel: dateLabelInit,
  weekDays: weekDaysInit,
  initial,
  habits: habitsInit,
  nutrition,
}: {
  name: string;
  dateLabel: string;
  weekDays: WeekDay[];
  initial: DashboardSummary | null;
  habits: TodayHabit[];
  nutrition: TodayNutrition | null;
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
    setWeekDays(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return {
          key: String(i),
          label: narrow.format(d),
          day: d.getDate(),
          isToday: d.toDateString() === now.toDateString(),
        };
      }),
    );
  }, [locale]);

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

  const greeting = name
    ? t('today.greeting', { name })
    : locale === 'es'
      ? 'Hola'
      : 'Hey there';

  // The notification bell + messages entry live in the app top bar / rail (rendered by the layout), so
  // the home header is just the wordmark. (Previously this rendered a dead, disabled bell placeholder.)
  const header = (
    <div className="mb-[18px] flex items-center">
      <Wordmark height={20} />
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
            <ButtonLink href="mailto:hello@teamthickandfit.com" size="md">
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

  const workoutTitle = summary.todaysWorkout?.name ?? t('today.morningWorkout');
  const workoutSub = summary.todaysWorkout
    ? t('activities.todaysWorkout')
    : t('activities.noProgram');

  return (
    <div className="px-[22px] pb-7 pt-3">
      {header}

      <h1 className="tf-display text-[34px]">{greeting}</h1>
      <p className="mt-1.5 text-[14px] text-faint">{dateLabel}</p>

      {/* Nutrition first: the moat lives on the home screen. Today's intake vs. target + a log CTA. */}
      {nutrition ? <NutritionCard n={nutrition} t={t} /> : null}

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

      {/* Check-in prompt */}
      <Card dark className="mt-5 flex items-center gap-4 p-[22px]">
        <div className="flex-1">
          <div className="tf-display text-[26px] leading-[1.06]">
            {t('today.checkinTitle')}
          </div>
          <p className="mb-4 mt-2.5 text-[13px] leading-[1.5] text-white/65">
            {t('today.checkinBody')}
          </p>
          <div className="flex items-center gap-3">
            <ButtonLink href="/checkin" variant="light" size="sm">
              {t('today.checkinCta')}
            </ButtonLink>
          </div>
        </div>
        <div
          className="h-[104px] w-[84px] flex-none rounded-xl bg-cover"
          style={{
            backgroundImage: "url('/brand/img/steph-hero.avif')",
            backgroundPosition: 'center 20%',
          }}
        />
      </Card>

      {/* Week strip */}
      <div className="mt-[22px] flex justify-between">
        {weekDays.map((d) => (
          <div key={d.key} className="text-center">
            <div className="text-[11px] text-faint">{d.label}</div>
            {d.isToday ? (
              <div className="mx-auto mt-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink text-[13px] text-white">
                {d.day}
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-faint">{d.day}</div>
            )}
          </div>
        ))}
      </div>

      {/* Things to do */}
      <SectionTitle
        className="mb-2.5 mt-[26px]"
        action={<Link href="/workouts">{t('common.viewAll')}</Link>}
      >
        {t('today.todo')}
      </SectionTitle>

      <ListRow
        href="/workouts"
        leading={
          <IconTile>
            <Icon name="dumbbell" size={18} />
          </IconTile>
        }
        title={workoutTitle}
        sub={workoutSub}
        trailing={<CompletionCheck done={summary.streak > 0} />}
      />
      {habits.map((h, i) => (
        <ListRow
          key={h.id}
          divider={i < habits.length - 1}
          leading={
            <IconTile>
              <Icon name="check" size={18} />
            </IconTile>
          }
          title={h.title}
          trailing={
            <button
              type="button"
              onClick={() => void toggleHabit(h.id, !h.done)}
              className="tf-press"
              aria-label={h.title}
            >
              <CompletionCheck done={h.done} />
            </button>
          }
        />
      ))}
    </div>
  );
}

// Today's nutrition: the macro ring + calories consumed vs. target + per-macro progress. The home
// screen of a nutrition-first app must lead with this. Tapping "Log a meal" opens the diary.
function NutritionCard({
  n,
  t,
}: {
  n: TodayNutrition;
  t: ReturnType<typeof useTranslations>;
}): ReactElement {
  const { consumed, target } = n;
  const kcalLeft = Math.max(0, Math.round(target.kcal - consumed.kcal));
  const over = consumed.kcal > target.kcal;
  const rows = [
    { key: 'p', label: t('today.macroProtein'), got: Math.round(consumed.proteinG), goal: Math.round(target.proteinG), color: 'var(--color-macro-protein)' },
    { key: 'c', label: t('today.macroCarbs'), got: Math.round(consumed.carbG), goal: Math.round(target.carbG), color: 'var(--color-macro-carbs)' },
    { key: 'f', label: t('today.macroFat'), got: Math.round(consumed.fatG), goal: Math.round(target.fatG), color: 'var(--color-macro-fat)' },
  ];
  return (
    <Card className="mt-5 p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
          {t('today.nutritionTitle')}
        </span>
        <Link href="/nutrition" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
          {t('today.logMeal')}
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <MacroRing
          proteinG={consumed.proteinG}
          carbG={consumed.carbG}
          fatG={consumed.fatG}
          kcal={Math.round(consumed.kcal)}
          size={84}
        />
        <div className="min-w-0 flex-1">
          <div className="tf-display text-[24px] leading-none">
            {Math.round(consumed.kcal)}
            <span className="text-[14px] text-faint"> / {Math.round(target.kcal)} kcal</span>
          </div>
          <div className="mt-0.5 text-[12px] text-faint">
            {over
              ? t('today.kcalOver', { n: String(Math.round(consumed.kcal - target.kcal)) })
              : t('today.kcalLeft', { n: String(kcalLeft) })}
          </div>
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <div key={r.key}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-muted">{r.label}</span>
                  <span className="text-faint">
                    {r.got}/{r.goal} g
                  </span>
                </div>
                <ProgressBar pct={r.goal > 0 ? (r.got / r.goal) * 100 : 0} color={r.color} height={5} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
