// Coach Intelligence: how accurate the scans are and whether the learning loop is tightening.
// Correction rate + portion error trends, confidence calibration, per-feature model/prompt
// breakdown, most-corrected foods. All data from ai_inferences + food_log via the service-client
// data layer; charts are pure server-rendered SVG (recharts renders blank on React 19 here).
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { getScanIntelligence } from '@/lib/coach/intelligence';
import { PageTitle } from '@/components/ui/section';
import { ScanVolumeChart } from '@/components/coach/intelligence/scan-volume-chart';
import { CalibrationChart } from '@/components/coach/intelligence/calibration-chart';
import { RateTrendChart } from '@/components/coach/intelligence/rate-trend-chart';

export const dynamic = 'force-dynamic';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): ReactElement {
  return (
    <div className={`rounded-2xl bg-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }): ReactElement {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">{label}</div>
      <div className="mt-1 text-[26px] font-bold text-ink">{value}</div>
      {sub ? <div className="text-[12px] text-soft">{sub}</div> : null}
    </div>
  );
}

export default async function CoachIntelligencePage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const t = await getTranslations('app.coach.intelligence');
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{t('noScansBody')}</div>;

  const d = await getScanIntelligence(ctx.companyId);
  const empty = d.totals.scans30d === 0;
  const pct = (v: number | null): string => (v == null ? '–' : `${v}%`);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <PageTitle>{t('title')}</PageTitle>
      <p className="mb-6 text-[13px] text-faint">{t('subtitle')}</p>

      {empty ? (
        <Card>
          <div className="py-10 text-center">
            <div className="text-[15px] font-semibold text-ink">{t('noScansTitle')}</div>
            <p className="mt-1 text-[13px] text-soft">{t('noScansBody')}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label={t('scansPerDay')} value={String(d.totals.scansPerDay)} sub={t('last30Days')} />
            <Tile
              label={t('scanAccuracy')}
              value={pct(d.totals.correctionRatePct == null ? null : 100 - d.totals.correctionRatePct)}
              sub={t('correctionRate') + ' ' + pct(d.totals.correctionRatePct)}
            />
            <Tile label={t('portionError')} value={pct(d.totals.portionMapePct)} sub={t('last30Days')} />
            <Tile label={t('acceptedAsIs')} value={pct(d.totals.acceptedPct)} sub={t('last30Days')} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-1 text-[15px] font-semibold text-ink">{t('scanVolumeTitle')}</h3>
              <p className="mb-3 text-[12px] text-faint">{t('scanVolumeHint')}</p>
              <ScanVolumeChart data={d.scansByDay} title={t('scansUnit')} />
            </Card>
            <Card>
              <h3 className="mb-1 text-[15px] font-semibold text-ink">{t('calibrationTitle')}</h3>
              <p className="mb-3 text-[12px] text-faint">{t('calibrationHint')}</p>
              <CalibrationChart data={d.calibration} emptyLabel={t('noDataYet')} />
            </Card>
            <Card>
              <h3 className="mb-3 text-[15px] font-semibold text-ink">{t('correctionTrendTitle')}</h3>
              <RateTrendChart
                data={d.weeklyCorrection.map((w) => ({ label: w.weekStart, value: w.correctionRatePct }))}
                unit="%"
                emptyLabel={t('noDataYet')}
              />
            </Card>
            <Card>
              <h3 className="mb-3 text-[15px] font-semibold text-ink">{t('portionTrendTitle')}</h3>
              <RateTrendChart
                data={d.weeklyCorrection.map((w) => ({ label: w.weekStart, value: w.portionMapePct }))}
                unit="%"
                emptyLabel={t('noDataYet')}
              />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-[15px] font-semibold text-ink">{t('topCorrectedTitle')}</h3>
              {d.topCorrectedFoods.length === 0 ? (
                <p className="text-[13px] text-soft">{t('noDataYet')}</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                      <th className="pb-2 font-semibold">{t('colFood')}</th>
                      <th className="pb-2 font-semibold">{t('colCorrections')}</th>
                      <th className="pb-2 font-semibold">{t('colAvgAdjustment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topCorrectedFoods.map((f) => (
                      <tr key={f.name} className="border-t border-line">
                        <td className="py-2 capitalize">{f.name}</td>
                        <td className="py-2">{f.count}</td>
                        <td className="py-2">{f.avgDeltaPct > 0 ? '+' : ''}{f.avgDeltaPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h3 className="mb-3 text-[15px] font-semibold text-ink">{t('byFeatureTitle')}</h3>
              {d.byFeature.length === 0 ? (
                <p className="text-[13px] text-soft">{t('noDataYet')}</p>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                      <th className="pb-2 font-semibold">{t('colFeature')}</th>
                      <th className="pb-2 font-semibold">{t('colModel')}</th>
                      <th className="pb-2 font-semibold">{t('colScans')}</th>
                      <th className="pb-2 font-semibold">{t('colAvgLatency')}</th>
                      <th className="pb-2 font-semibold">{t('colErrors')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.byFeature.map((f) => (
                      <tr key={`${f.feature}-${f.model}-${f.promptVersion}`} className="border-t border-line">
                        <td className="py-2">{f.feature}<span className="block text-[10px] text-faint">{f.promptVersion}</span></td>
                        <td className="py-2">{f.model.split('/').pop()}</td>
                        <td className="py-2">{f.count}</td>
                        <td className="py-2">{f.avgLatencyMs == null ? '–' : `${f.avgLatencyMs}ms`}</td>
                        <td className="py-2">{f.errorPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
