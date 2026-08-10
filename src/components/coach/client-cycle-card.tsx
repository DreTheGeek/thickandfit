'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { CoachCycleView } from '@/lib/coach/client-cycle';

/**
 * The cycle, read-only, on the client's record.
 *
 * Lenus puts this on the check-in and Stephanie asked for the same information. It is deliberately
 * a READ: a coach does not log a member's symptoms, and an editable control here would invite
 * exactly that.
 *
 * NO PREDICTED DATE WHEN THE HISTORY IS IRREGULAR. The loader already withholds it, and the badge
 * says so plainly. Roughly half her book carries PCOS, endometriosis, thyroid disease or
 * perimenopause; a coach repeating a confident date to a member whose own screen never showed her
 * one is the specific harm the whole module is built to avoid.
 */
export function ClientCycleCard({ cycle, locale }: { cycle: CoachCycleView; locale: string }): ReactElement {
  const t = useTranslations('app.coach');
  const tc = useTranslations('app.cycle');

  const fmt = (d: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${d}T00:00:00`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {cycle.phase !== 'unknown' && (
          <span className="rounded-full bg-warm px-2.5 py-1 text-[12px] font-semibold text-ink">
            {cycle.dayOfCycle != null ? t('cycleDayPhase', { day: cycle.dayOfCycle, phase: tc(`phase.${cycle.phase}`) }) : tc(`phase.${cycle.phase}`)}
          </span>
        )}
        {cycle.isIrregular && (
          <span className="rounded-full bg-pending px-2.5 py-1 text-[11px] font-semibold text-pending-ink">
            {t('cycleIrregular')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-[13px]">
        {cycle.lastPeriodStart && (
          <div className="flex justify-between gap-3">
            <span className="text-faint">{t('cycleLastPeriod')}</span>
            <span className="font-medium text-ink">{fmt(cycle.lastPeriodStart)}</span>
          </div>
        )}
        {/* Only ever rendered for a regular history: the loader returns null otherwise. */}
        {cycle.predictedNextStart && (
          <div className="flex justify-between gap-3">
            <span className="text-faint">{t('cycleNextExpected')}</span>
            <span className="font-medium text-ink">{fmt(cycle.predictedNextStart)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-faint">{t('cycleDaysLogged')}</span>
          <span className="font-medium tabular-nums text-ink">{cycle.daysLogged}</span>
        </div>
      </div>

      {/* Counts, not a diary. What a coach acts on is "cramps 6 times since the last check-in", not
          which specific mornings they were. The detail stays with the member. */}
      {cycle.symptoms.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {t('cycleSymptoms')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cycle.symptoms.map((s) => (
              <span key={s.key} className="rounded-full bg-warm px-2 py-0.5 text-[11px] text-soft">
                {tc(`symptom.${s.key}`)} <span className="tabular-nums text-faint">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {cycle.moods.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {t('cycleMoods')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cycle.moods.map((m) => (
              <span key={m.key} className="rounded-full bg-warm px-2 py-0.5 text-[11px] text-soft">
                {tc(`mood.${m.key}`)} <span className="tabular-nums text-faint">{m.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
