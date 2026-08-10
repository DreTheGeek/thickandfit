'use client';
// Cycle tracker UI. The whole screen is built around one job: log the day your period started, in
// one tap, because a tracker that takes effort is a tracker nobody uses past week two.
//
// The prediction copy is deliberately careful. This app's members skew toward PCOS, endometriosis
// and perimenopause, so when the history is irregular we show a RANGE and say so, rather than naming
// a date she will then measure herself against. `predictedNextStart` is null in that case by design.
import { useState, useTransition, type ReactElement } from 'react';
import { CycleDayLogger } from '@/components/cycle/day-logger';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  logPeriodStartAction,
  setPeriodEndAction,
  deleteCycleLogAction,
} from '@/lib/cycle/actions';
import type { CycleSummary } from '@/lib/cycle/data';

function fmt(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function CycleScreen({
  summary,
  today,
}: {
  summary: CycleSummary;
  today: string;
}): ReactElement {
  const t = useTranslations('app.cycle');
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean }>): void => {
    setErr(false);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setErr(true);
    });
  };

  const { phase, cycleDay, daysUntilNext } = summary.phase;
  const open = summary.logs.find((l) => !l.endedOn) ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Where she is right now. */}
      <Card className="p-5">
        {phase === 'unknown' ? (
          <>
            <div className="font-display text-[22px]">{t('noDataTitle')}</div>
            <p className="mt-1 text-[13px] leading-[1.5] text-soft">{t('noDataBody')}</p>
          </>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
              {t('dayLabel', { day: cycleDay ?? 0 })}
            </div>
            <div className="mt-1 font-display text-[26px]">{t(`phase.${phase}`)}</div>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-soft">{t(`phaseBody.${phase}`)}</p>
          </>
        )}
      </Card>

      {/* Symptoms and mood for today, collapsed. Sits under the phase card and above the period
          button so the common action stays the most prominent one. */}
      <CycleDayLogger
        today={today}
        initialSymptoms={(summary.todayLog?.symptoms ?? []) as Parameters<typeof CycleDayLogger>[0]['initialSymptoms']}
        initialMoods={(summary.todayLog?.moods ?? []) as Parameters<typeof CycleDayLogger>[0]['initialMoods']}
        initialEnergy={summary.todayLog?.energy ?? null}
      />

      {/* One tap to log. This is the only thing most members will ever do here. */}
      <Button size="block" disabled={pending} onClick={() => run(() => logPeriodStartAction({ startedOn: today }))}>
        {pending ? '…' : t('logToday')}
      </Button>
      {open ? (
        <Button
          variant="outline"
          size="block"
          disabled={pending}
          onClick={() => run(() => setPeriodEndAction({ id: open.id, endedOn: today }))}
        >
          {t('endToday')}
        </Button>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] text-alert-ink">
          {t('saveError')}
        </p>
      ) : null}

      {/* What we will and will not predict. */}
      {summary.averageLength ? (
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
            {t('rhythmLabel')}
          </div>
          <div className="mt-1 text-[15px]">{t('avgLength', { days: summary.averageLength })}</div>
          {summary.isIrregular ? (
            <>
              <p className="mt-2 text-[13px] leading-[1.5] text-soft">{t('irregularNote')}</p>
              {summary.predictedRange ? (
                <div className="mt-1 text-[14px] font-semibold">
                  {t('expectedBetween', {
                    from: fmt(summary.predictedRange.from, locale),
                    to: fmt(summary.predictedRange.to, locale),
                  })}
                </div>
              ) : null}
            </>
          ) : summary.predictedNextStart ? (
            <div className="mt-2 text-[14px]">
              {t('nextExpected', { date: fmt(summary.predictedNextStart, locale) })}
              {daysUntilNext != null && daysUntilNext >= 0 ? (
                <span className="text-faint"> · {t('inDays', { days: daysUntilNext })}</span>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* History, with delete: a wrong start date poisons every average above. */}
      {summary.logs.length ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-faint">
            {t('historyLabel')}
          </div>
          <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-divider bg-divider">
            {summary.logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between bg-surface px-4 py-3">
                <span className="text-[14px]">
                  {fmt(l.startedOn, locale)}
                  {l.endedOn ? <span className="text-faint"> → {fmt(l.endedOn, locale)}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteCycleLogAction(l.id))}
                  className="tf-press text-[12px] text-faint hover:text-alert-ink disabled:opacity-50"
                >
                  {t('remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
