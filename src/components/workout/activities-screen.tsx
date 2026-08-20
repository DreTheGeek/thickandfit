'use client';
// Activities hub: Program / Library / History (segmented). Program shows the
// assigned plan + today's session; Library embeds the exercise browser; History
// lists logged workouts. Re-skinned to the design-handoff prototype.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { PortalLabel } from '@/components/portal/today-cards';
import { TrainTabs, WorkoutBanner, UpNext, SplitOverview } from '@/components/portal/train-cards';
import { PageTitle } from '@/components/ui/section';
import { ListRow } from '@/components/ui/list-row';
import { CompletionCheck } from '@/components/ui/completion';
import { EmptyState } from '@/components/states/empty-state';
import { FirstSteps } from '@/components/states/first-steps';
import type { Activation } from '@/lib/member/activation';
import { PlayIcon } from '@/components/ui/icons';
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
export type HistoryItem = {
  id: string;
  date: string;
  completionPct: number | null;
  enjoyment: number | null;
  effort: number | null;
};
export type WorkoutStats = { thisWeek: number; total: number; volumeLb: number };

type Tab = 'program' | 'library' | 'history';

export function ActivitiesScreen({
  program,
  history,
  stats,
  locale,
  activation,
}: {
  program: ActivitiesProgram | null;
  history: HistoryItem[];
  stats: WorkoutStats | null;
  locale: string;
  activation: Activation;
}): ReactElement {
  const t = useTranslations('app.activities');
  const tn = useTranslations('app.nav');
  const [tab, setTab] = useState<Tab>('program');

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-4">{tn('activities')}</PageTitle>
      <TrainTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'program', label: t('program') },
          { value: 'library', label: t('library') },
          { value: 'history', label: t('history') },
        ]}
      />

      {tab === 'program' &&
        (program == null ? (
          // Not an empty state. "Your program's on the way" was a promise nothing in the system
          // kept, and it made waiting the activity on the one day she is most likely to leave.
          <FirstSteps activation={activation} />
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
                <StatCell value={String(stats.thisWeek)} label={t('statThisWeek')} divider />
                <StatCell value={String(stats.total)} label={t('statTotal')} divider />
                <StatCell value={fmtVolume(stats.volumeLb)} label={t('statVolume')} />
              </div>
            )}

            <div className="mt-[22px]" />
            {program.exercises.map((ex, i) => (
              <ListRow
                key={ex.id + i}
                href={`/workout/${program.planId}?day=${program.activeDay}`}
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

      {tab === 'library' && <ExerciseBrowser locale={locale} />}

      {tab === 'history' &&
        (history.length === 0 ? (
          <EmptyState title={t('noHistory')} />
        ) : (
          <div>
            {history.map((h, i) => (
              <div
                key={h.id}
                className={[
                  'flex items-center justify-between py-3.5',
                  i < history.length - 1 ? 'border-b border-divider' : '',
                ].join(' ')}
              >
                <span className="text-[14px] font-medium">{h.date}</span>
                <span className="text-[12px] text-faint">
                  {h.completionPct != null ? `${h.completionPct}%` : '-'}
                  {h.enjoyment != null ? ` · ♥ ${h.enjoyment}/5` : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
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
