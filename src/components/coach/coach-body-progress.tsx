'use client';

// Read-only Progress view for the coach client profile (Lenus parity): current/start/goal weight, the
// weight trend chart, per-site body measurements with change since first, and total circumference
// change. Reuses the subscriber's BodyStats model + the pure WeightTrendChart. Coach sees, never logs.
import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { WeightTrendChart } from '@/components/progress/weight-trend-chart';
import { MEASURE_FIELDS, type BodyStats, type MeasureField, type MeasureStat } from '@/lib/body/types';

const CM_TO_IN = 0.393701;
const MEASURE_KEY: Record<MeasureField, string> = {
  waist: 'mWaist', hips: 'mHips', chest: 'mChest', arms: 'mArms', thighs: 'mThighs', bodyFat: 'mBodyFat',
};

function latestLabel(m: MeasureStat): string {
  if (m.latest == null) return '-';
  if (m.field === 'bodyFat') return `${m.latest}%`;
  return `${Math.round(m.latest * CM_TO_IN * 10) / 10} in`;
}
function deltaValue(m: MeasureStat): number | null {
  if (m.delta == null || m.delta === 0) return null;
  return m.field === 'bodyFat' ? m.delta : Math.round(m.delta * CM_TO_IN * 10) / 10;
}

export function CoachBodyProgress({ stats }: { stats: BodyStats }): ReactElement {
  const t = useTranslations('app.coach');
  const { currentLb, startLb, goalLb, weightSeries, measurements } = stats;
  const change = currentLb != null && startLb != null ? Math.round((currentLb - startLb) * 10) / 10 : null;

  const circDeltas = measurements.filter((m) => m.field !== 'bodyFat' && m.delta != null).map((m) => m.delta as number);
  const totalCircIn = circDeltas.length ? Math.round(circDeltas.reduce((a, b) => a + b, 0) * CM_TO_IN * 10) / 10 : null;
  const hasMeasures = measurements.some((m) => m.latest != null);

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Weight summary + trend */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('progressWeight')}</div>
            <div className="mt-1 font-display text-[32px] leading-none">
              {currentLb != null ? `${currentLb} lb` : '-'}
            </div>
            {change != null && (
              <div className={['mt-1 text-[13px]', change < 0 ? 'text-accent' : 'text-muted'].join(' ')}>
                {change > 0 ? '+' : ''}{change} lb {t('sinceStart')}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('progressGoal')}</div>
            <div className="mt-1 font-display text-[22px] leading-none">{goalLb != null ? `${goalLb} lb` : '-'}</div>
          </div>
        </div>
        {weightSeries.length > 0 ? (
          <div className="mt-4">
            <WeightTrendChart series={weightSeries} goalLb={goalLb} goalLabel={t('progressGoal')} />
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-faint">{t('progressNoWeight')}</p>
        )}
      </Card>

      {/* Measurements */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{t('progressMeasurements')}</div>
          {totalCircIn != null && (
            <div className="text-[12px] text-muted">
              {t('progressTotalCirc')}{' '}
              <span className={['font-semibold', totalCircIn < 0 ? 'text-accent' : 'text-ink'].join(' ')}>
                {totalCircIn > 0 ? '+' : ''}{totalCircIn} in
              </span>
            </div>
          )}
        </div>
        {hasMeasures ? (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
            {MEASURE_FIELDS.map((field) => {
              const m = measurements.find((x) => x.field === field);
              if (!m) return null;
              const d = deltaValue(m);
              return (
                <div key={field}>
                  <div className="text-[11px] uppercase tracking-[0.5px] text-faint">{t(MEASURE_KEY[field])}</div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[15px] font-medium">{latestLabel(m)}</span>
                    {d != null && (
                      <span className={['text-[12px]', d < 0 ? 'text-accent' : 'text-muted'].join(' ')}>
                        {d > 0 ? '+' : ''}{d}
                        {m.field === 'bodyFat' ? '%' : ' in'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-faint">{t('progressNoMeasures')}</p>
        )}
      </Card>
    </div>
  );
}
