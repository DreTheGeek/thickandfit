import type { ReactElement } from 'react';
import type { CalibrationBucket } from '@/lib/admin/scan-intelligence';

// Confidence-calibration bars: per confidence decile, % of logged items later corrected. The
// dashed reference is perfect calibration (at 90-100% confidence, ~0-10% corrections): bars ABOVE
// the line = overconfident, bars below = conservative. Pure SVG, server-rendered.
export function CalibrationChart({ data, emptyLabel }: { data: CalibrationBucket[]; emptyLabel: string }): ReactElement {
  const W = 720;
  const H = 210;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const bw = (plotW / n) * 0.62;
  const x = (i: number): number => padL + (i + 0.5) * (plotW / n) - bw / 2;
  const y = (pct: number): number => padT + plotH - (Math.min(100, pct) / 100) * plotH;
  const hasData = data.some((b) => b.items > 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      {[0, 50, 100].map((tk) => (
        <g key={tk}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--color-divider)" strokeWidth={1} />
          <text x={padL - 6} y={y(tk) + 3} textAnchor="end" fontSize="10" fill="var(--color-faint)">
            {tk}%
          </text>
        </g>
      ))}
      {/* Perfect-calibration reference: corrections fall linearly as confidence rises. */}
      <line x1={x(0) + bw / 2} y1={y(95)} x2={x(n - 1) + bw / 2} y2={y(5)} stroke="var(--color-faint)" strokeWidth={1.5} strokeDasharray="5 4" />
      {!hasData ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-faint)">
          {emptyLabel}
        </text>
      ) : (
        data.map((b, i) => (
          <g key={b.decile}>
            <rect x={x(i)} y={y(b.correctedPct)} width={bw} height={Math.max(0, padT + plotH - y(b.correctedPct))} fill="#5EBE62" opacity={b.items ? 0.8 : 0.15} rx={2}>
              <title>{`${b.decile}% confidence: ${b.correctedPct}% corrected (${b.items} items)`}</title>
            </rect>
            <text x={x(i) + bw / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
              {b.decile}
            </text>
          </g>
        ))
      )}
    </svg>
  );
}
