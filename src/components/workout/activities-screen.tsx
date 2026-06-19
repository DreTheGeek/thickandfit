'use client';
// Activities hub: Program / Library / History (segmented). Program shows the
// assigned plan + today's session; Library embeds the exercise browser; History
// lists logged workouts. Re-skinned to the design-handoff prototype.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { HeroCard } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { PageTitle, SectionTitle } from '@/components/ui/section';
import { ProgressBar } from '@/components/ui/ring';
import { ListRow } from '@/components/ui/list-row';
import { CompletionCheck } from '@/components/ui/completion';
import { EmptyState } from '@/components/states/empty-state';
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
  exercises: { id: string; name: string; sub: string; hasDemo: boolean; done: boolean }[];
};
export type HistoryItem = {
  id: string;
  date: string;
  completionPct: number | null;
  enjoyment: number | null;
  effort: number | null;
};

type Tab = 'program' | 'library' | 'history';

export function ActivitiesScreen({
  program,
  history,
  locale,
}: {
  program: ActivitiesProgram | null;
  history: HistoryItem[];
  locale: string;
}): ReactElement {
  const t = useTranslations('app.activities');
  const [tab, setTab] = useState<Tab>('program');

  return (
    <div className="px-[22px] pb-7 pt-3">
      <PageTitle className="mb-4">{t('title')}</PageTitle>
      <Segmented
        className="mb-5"
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
          <EmptyState title={t('noProgram')} message={t('noProgramBody')} />
        ) : (
          <>
            <HeroCard
              image="/brand/img/steph-about.avif"
              position="center 16%"
              className="h-[188px]"
            >
              <div className="tf-display text-[30px] leading-none">{program.name}</div>
              <div className="mt-1.5 text-[13px] text-white/70">
                {t('weekOf', { week: program.week, total: program.totalWeeks })}
              </div>
              <ProgressBar
                className="mt-3.5"
                pct={program.pct}
                color="var(--color-muted)"
                track="rgba(255,255,255,0.2)"
                height={4}
              />
              <div className="mt-2 text-[11px] text-white/65">
                {t('dayOf', { day: program.day, total: program.totalDays })}
              </div>
            </HeroCard>

            <SectionTitle className="mb-2.5 mt-[22px]">
              {t('todaysWorkout')}
            </SectionTitle>
            {program.exercises.map((ex, i) => (
              <ListRow
                key={ex.id + i}
                href={`/workout/${program.planId}`}
                divider={i < program.exercises.length - 1}
                leading={<ExerciseThumb hasDemo={ex.hasDemo} />}
                title={ex.name}
                sub={ex.sub}
                trailing={<CompletionCheck done={ex.done} />}
              />
            ))}

            <ButtonLink href={`/workout/${program.planId}`} size="block" className="mt-6">
              {t('startWorkout')}
            </ButtonLink>
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
