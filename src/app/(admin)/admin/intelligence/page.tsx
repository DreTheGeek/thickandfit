// Scan intelligence: how accurate the photo scanner is and whether the learning loop is tightening.
// Correction rate + portion error trends, confidence calibration, per-model runs/latency/errors,
// most-corrected foods. All from ai_inferences + food_log via the service-client data layer; charts
// are pure server-rendered SVG (recharts renders blank on React 19 here).
//
// Lived at /coach/intelligence until it was moved here. A fitness coach has no use for
// "gemini-2.5-flash 1841ms 0% errors": model names, prompt versions and latency are operator
// telemetry, and putting them in her console made it read as a dashboard she was failing.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getScanIntelligence } from '@/lib/admin/scan-intelligence';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { ScanVolumeChart } from '@/components/admin/intelligence/scan-volume-chart';
import { CalibrationChart } from '@/components/admin/intelligence/calibration-chart';
import { RateTrendChart } from '@/components/admin/intelligence/rate-trend-chart';

export const dynamic = 'force-dynamic';

const NO_DATA = 'Not enough data yet';

function pct(v: number | null): string {
  return v == null ? '-' : `${v}%`;
}

export default async function ScanIntelligencePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const d = ctx.companyId ? await getScanIntelligence(ctx.companyId) : null;

  if (!d || d.totals.scans30d === 0) {
    return (
      <AdminPage title="Scan intelligence" subtitle="Scanner accuracy, calibration and per-model behaviour.">
        <Card>
          <p className="py-6 text-center text-[13px] text-faint">
            No scans in the last 30 days. Accuracy and correction trends appear here once members start
            scanning meals.
          </p>
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Scan intelligence"
      subtitle="Scanner accuracy, calibration and per-model behaviour over the last 30 days."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Scans per day" value={String(d.totals.scansPerDay)} sub="last 30 days" />
        <Stat
          label="Scan accuracy"
          value={pct(d.totals.correctionRatePct == null ? null : 100 - d.totals.correctionRatePct)}
          sub={`correction rate ${pct(d.totals.correctionRatePct)}`}
        />
        <Stat label="Portion error" value={pct(d.totals.portionMapePct)} sub="MAPE, last 30 days" />
        <Stat label="Accepted as-is" value={pct(d.totals.acceptedPct)} sub="last 30 days" />
      </div>

      <Card title="Scan volume">
        <p className="mb-3 text-[12px] text-faint">
          Daily scans; the darker segment is scans members corrected.
        </p>
        <ScanVolumeChart data={d.scansByDay} title="scans" />
      </Card>

      <Card title="Confidence calibration">
        <p className="mb-3 text-[12px] text-faint">
          When confidence is high, corrections should be rare. Bars above the dashed line mean the model
          is overconfident.
        </p>
        <CalibrationChart data={d.calibration} emptyLabel={NO_DATA} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Correction rate by week">
          <RateTrendChart
            data={d.weeklyCorrection.map((w) => ({ label: w.weekStart, value: w.correctionRatePct }))}
            unit="%"
            emptyLabel={NO_DATA}
          />
        </Card>
        <Card title="Portion error by week">
          <RateTrendChart
            data={d.weeklyCorrection.map((w) => ({ label: w.weekStart, value: w.portionMapePct }))}
            unit="%"
            emptyLabel={NO_DATA}
          />
        </Card>
      </div>

      <Card title="Most corrected foods">
        {d.topCorrectedFoods.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">{NO_DATA}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 font-semibold">Food</th>
                  <th className="pb-2 font-semibold">Corrections</th>
                  <th className="pb-2 font-semibold">Avg adjustment</th>
                </tr>
              </thead>
              <tbody>
                {d.topCorrectedFoods.map((f) => (
                  <tr key={f.name} className="border-t border-divider">
                    <td className="py-2 capitalize">{f.name}</td>
                    <td className="py-2 tabular-nums">{f.count}</td>
                    <td className="py-2 tabular-nums">
                      {f.avgDeltaPct > 0 ? '+' : ''}
                      {f.avgDeltaPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="By feature and model">
        {d.byFeature.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">{NO_DATA}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 font-semibold">Feature</th>
                  <th className="pb-2 font-semibold">Model</th>
                  <th className="pb-2 font-semibold">Runs</th>
                  <th className="pb-2 font-semibold">Avg latency</th>
                  <th className="pb-2 font-semibold">Errors</th>
                </tr>
              </thead>
              <tbody>
                {d.byFeature.map((f) => (
                  <tr key={`${f.feature}-${f.model}-${f.promptVersion}`} className="border-t border-divider">
                    <td className="py-2">
                      {f.feature}
                      <span className="block text-[10px] text-faint">{f.promptVersion}</span>
                    </td>
                    <td className="py-2">{f.model.split('/').pop()}</td>
                    <td className="py-2 tabular-nums">{f.count}</td>
                    <td className="py-2 tabular-nums">{f.avgLatencyMs == null ? '-' : `${f.avgLatencyMs}ms`}</td>
                    <td className="py-2 tabular-nums">{f.errorPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
