'use client';
// Activities hub: Program / Library / History (segmented). Program shows the
// assigned plan + today's session; Library embeds the exercise browser; History
// lists logged workouts. Re-skinned to the design-handoff prototype.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WeeklyTarget } from '@/lib/training/weekly-target-shared';
import type { ReactElement } from 'react';
import { PortalLabel } from '@/components/portal/today-cards';
import { WorkoutBanner, UpNext, SplitOverview } from '@/components/portal/train-cards';
import { PortalTabs } from '@/components/portal/portal-chrome';
import { PageTitle } from '@/components/ui/section';
import { ListRow } from '@/components/ui/list-row';
import { CompletionCheck } from '@/components/ui/completion';
import { EmptyState } from '@/components/states/empty-state';
import { FirstSteps } from '@/components/states/first-steps';
import type { Activation } from '@/lib/member/activation';
import { Icon, PlayIcon } from '@/components/ui/icons';
import { ExerciseBrowser } from '@/components/exercises/exercise-browser';

export type ActivitiesProgram = {
  planId: string;
  name: string;
  week: number;
  totalWeeks: number;
  day: number;
  totalDays: number;
  pct: number;
  days: { index: number; label: string }[];
  activeDay: number;
  exercises: { id: string; name: string; sub: string; hasDemo: boolean; done: boolean }[];
  /** She is on the auto-assigned starting week, not a plan anybody wrote for her yet. */
  isStarter?: boolean;
};
/** One movement inside a logged session, as she performed it. */
export type HistoryExercise = {
  name: string;
  sets: number;
  reps: number[];
  /** Heaviest completed set in lb, or null for the banded and bodyweight work that is most of the plan. */
  topWeightLb: number | null;
};

/**
 * A row in History.
 *
 * IT USED TO BE A DATE AND A PERCENTAGE, and that is all. A member who had just finished 32 sets
 * across 11 movements saw "Sat, Aug 22    100% . 2/5" and could not tell you a single thing she had
 * lifted. The sets were in `set_logs` and no screen read them.
 *
 * "I can't see what I did as far as workouts" is the whole complaint, and it was accurate.
 */
export type HistoryItem = {
  id: string;
  date: string;
  completionPct: number | null;
  enjoyment: number | null;
  effort: number | null;
  setCount: number;
  volumeLb: number;
  exercises: HistoryExercise[];
};
export type WorkoutStats = { total: number; volumeLb: number };

/**
 * The contract's three tabs come first and in its order: My Plan, Programs, Favorites.
 *
 * Library and History follow rather than being replaced by them. Both are real, used features over
 * 1,305 movements and her logged sessions, and the contract is a static mock whose tab row was
 * never asked to carry them. Dropping working screens to match the count would be matching a
 * picture at the member's expense. The row scrolls, so five costs nothing.
 *
 * `program` keeps its VALUE so nothing that links here breaks; the contract's wording is on the
 * label.
 */
type Tab = 'program' | 'programs' | 'favorites' | 'library' | 'history';

export function ActivitiesScreen({
  program,
  history,
  stats,
  weekly,
  locale,
  activation,
  hasStarterProgram = false,
  allPlans = [],
}: {
  program: ActivitiesProgram | null;
  history: HistoryItem[];
  stats: WorkoutStats | null;
  /** Her week against the days she said she can train. Null when the read failed. */
  weekly: WeeklyTarget | null;
  locale: string;
  activation: Activation;
  /** STARTER_PROGRAM_ID is set, so onboarding already assigned her a plan. */
  hasStarterProgram?: boolean;
  /** Every plan ever assigned to her, newest first, for the Programs tab. */
  allPlans?: { id: string; name: string; weeks: number | null }[];
}): ReactElement {
  const t = useTranslations('app.activities');
  const tn = useTranslations('app.nav');
  const [tab, setTab] = useState<Tab>('program');

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-4">{tn('activities')}</PageTitle>
      <PortalTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'program', label: t('myPlan') },
          { value: 'programs', label: t('programs') },
          { value: 'favorites', label: t('favorites') },
          { value: 'library', label: t('library') },
          { value: 'history', label: t('history') },
        ]}
      />

      {tab === 'program' &&
        (program == null ? (
          // Not an empty state. "Your program's on the way" was a promise nothing in the system
          // kept, and it made waiting the activity on the one day she is most likely to leave.
          <FirstSteps activation={activation} hasStarterProgram={hasStarterProgram} />
        ) : (
          <>
            <PortalLabel>{t('todaysWorkout')}</PortalLabel>
            <WorkoutBanner
              title={program.name}
              meta={`${t('weekOf', { week: program.week, total: program.totalWeeks })} · ${t('dayOf', { day: program.day, total: program.totalDays })}`}
              href={`/workout/${program.planId}?day=${program.activeDay}`}
              cta={t('startWorkout')}
              imageIndex={program.activeDay}
            />

            {/* The one line that keeps "Steph writes your plan by hand" honest once auto-assign is
                on. She has a program on day one now, which is the improvement; being allowed to
                believe a generic starting week is her personalised plan is not. Renders only while
                she is actually on the starter, and disappears the moment a coach assigns her
                something real. */}
            {program.isStarter && (
              <p className="mt-3 rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-soft">
                {t('starterNote')}
              </p>
            )}

            {/* Canonical stats band: sessions this week / total / lifted volume */}
            {stats && (
              <div className="mt-4 flex border border-divider">
                {/* HER WEEK, against what she said she can manage.
                    This cell used to be a rolling 7-day count with no denominator, so "3" meant
                    nothing: three out of what? A member training three days a week BY DESIGN had no
                    surface anywhere that could tell her she was on track. Falls back to a bare
                    count when she has neither an answer nor a plan to measure against, because a
                    target she never set is not a target she is failing. */}
                <StatCell
                  value={
                    weekly && weekly.mode === 'target'
                      ? `${weekly.done}/${weekly.target}`
                      : String(weekly?.done ?? 0)
                  }
                  label={t('statThisWeek')}
                  divider
                />
                <StatCell value={String(stats.total)} label={t('statTotal')} divider />
                <StatCell value={fmtVolume(stats.volumeLb)} label={t('statVolume')} />
              </div>
            )}

            <div className="mt-[22px]" />
            {/* ?preview=1, not straight into the session. Every one of these rows used to link to
                the live player, so tapping a movement to see what it was started her workout: the
                timer running, the first set staged, no way back that did not look like quitting.
                The banner's START WORKOUT still goes straight in, because by then she has decided. */}
            {program.exercises.map((ex, i) => (
              <ListRow
                key={ex.id + i}
                href={`/workout/${program.planId}?day=${program.activeDay}&preview=1`}
                divider={i < program.exercises.length - 1}
                leading={<ExerciseThumb hasDemo={ex.hasDemo} />}
                title={ex.name}
                sub={ex.sub}
                trailing={<CompletionCheck done={ex.done} />}
              />
            ))}

            <UpNext
              label={t('upNext')}
              rows={program.days
                .filter((d) => d.index > program.activeDay)
                .slice(0, 3)
                .map((d) => ({
                  key: String(d.index),
                  title: d.label,
                  sub: t('dayOf', { day: d.index + 1, total: program.totalDays }),
                  href: `/workouts?day=${d.index}`,
                  imageIndex: d.index,
                }))}
            />

            <SplitOverview
              label={t('splitOverview')}
              days={program.days}
              activeIndex={program.activeDay}
              hrefFor={(i) => `/workouts?day=${i}`}
            />
          </>
        ))}

      {/* Every program she has been given, newest first. /workouts renders plans[0] and nothing
          showed the rest, so a member on her third block had no way to look back at the first two. */}
      {tab === 'programs' &&
        (allPlans.length === 0 ? (
          <EmptyState title={t('noPrograms')} />
        ) : (
          <div>
            {allPlans.map((pl, i) => (
              <ListRow
                key={pl.id}
                href={`/workout/${pl.id}`}
                divider={i < allPlans.length - 1}
                title={pl.name}
                sub={pl.weeks ? t('weeksN', { n: pl.weeks }) : ''}
                trailing={
                  i === 0 ? (
                    <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-soft">
                      {t('current')}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ))}

      {/* Starred movements. The table and its actions already existed for the coach console; this
          is the member's half of the same feature, not a new one. */}
      {tab === 'favorites' && <ExerciseBrowser locale={locale} onlyFavorites />}

      {tab === 'library' && <ExerciseBrowser locale={locale} />}

      {tab === 'history' &&
        (history.length === 0 ? (
          <EmptyState title={t('noHistory')} />
        ) : (
          <div>
            {history.map((h, i) => (
              <HistoryRow key={h.id} item={h} last={i === history.length - 1} t={t} />
            ))}
          </div>
        ))}
    </div>
  );
}

/**
 * One session, openable.
 *
 * A summary line first, because "11 movements, 32 sets, 1.2k lb" answers "what did I do" at a
 * glance and the old row answered nothing. Tapping opens the movements with the reps and the load
 * she actually used, which is the part a member checks when she wants to beat last week.
 *
 * A real <button> rather than a div with a handler: this is the only way into the detail, and the
 * client list in the coach console has already cost this repo one keyboard-inaccessible table.
 */
function HistoryRow({
  item,
  last,
  t,
}: {
  item: HistoryItem;
  last: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const has = item.exercises.length > 0;

  return (
    <div className={last ? '' : 'border-b border-divider'}>
      <button
        type="button"
        onClick={() => has && setOpen((v) => !v)}
        aria-expanded={has ? open : undefined}
        disabled={!has}
        className="tf-press flex w-full items-center justify-between gap-3 py-3.5 text-left disabled:cursor-default"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">{item.date}</span>
          {has && (
            <span className="mt-0.5 block text-[12px] text-faint">
              {t('historySummary', {
                moves: item.exercises.length,
                sets: item.setCount,
              })}
              {item.volumeLb > 0 ? ` · ${fmtVolume(item.volumeLb)} lb` : ''}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-faint">
          <span>
            {item.completionPct != null ? `${item.completionPct}%` : '-'}
            {item.enjoyment != null ? ` · ♥ ${item.enjoyment}/5` : ''}
          </span>
          {has && (
            <Icon
              name="chevronRight"
              size={14}
              className={`transition-transform ${open ? 'rotate-90' : ''}`}
            />
          )}
        </span>
      </button>

      {open && (
        <ul className="pb-3.5">
          {item.exercises.map((e) => (
            <li key={e.name} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-[13px]">{e.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-faint">
                {e.reps.length ? e.reps.join('/') : `${e.sets}x`}
                {/* No load is printed for bodyweight and banded work. The player writes 0 for those
                    and "0 lb" reads as a broken number rather than as a push-up. */}
                {e.topWeightLb != null ? ` · ${e.topWeightLb} lb` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtVolume(v: number): string {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v));
}

function StatCell({
  value,
  label,
  divider = false,
}: {
  value: string;
  label: string;
  divider?: boolean;
}): ReactElement {
  return (
    <div className={['flex-1 py-3.5 text-center', divider ? 'border-r border-divider' : ''].join(' ')}>
      <div className="font-display text-[22px] leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[1.5px] text-faint">{label}</div>
    </div>
  );
}

function ExerciseThumb({ hasDemo }: { hasDemo: boolean }): ReactElement {
  return (
    <div
      className="relative h-[46px] w-[46px] flex-none rounded-[10px]"
      style={{ background: 'linear-gradient(135deg,#3a3a3a,#111)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-bg/90">
          <PlayIcon size={9} className="text-ink" />
        </div>
      </div>
      {hasDemo && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
      )}
    </div>
  );
}
