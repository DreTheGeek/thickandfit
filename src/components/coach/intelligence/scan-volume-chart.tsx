import type { ReactElement } from 'react';
import type { DayCount } from '@/lib/coach/intelligence';

// Pure-SVG daily scan volume bars; the corrected share overlays as a darker segment inside each
// bar. Server-rendered (viewBox scaling, native <title> tooltips), same pattern as revenue-chart.
export function ScanVolumeChart({ data, title }: { data: DayCount[]; title: string }): ReactElement {
  const W = 720;
  const H = 200;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(1, data.length);
  const max = Math.max(1, ...data.map((d) => d.scans));
  const bw = Math.min(18, (plotW / n) * 0.7);
  const x = (i: number): number => padL + (i + 0.5) * (plotW / n) - bw / 2;
  const y = (v: number): number => padT + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(n / 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      {[0, max / 2, max].map((tk, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--color-divider)" strokeWidth={1} />
          <text x={padL - 6} y={y(tk) + 3} textAnchor="end" fontSize="10" fill="var(--color-faint)">
            {Math.round(tk)}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={d.date}>
          <rect x={x(i)} y={y(d.scans)} width={bw} height={Math.max(0, padT + plotH - y(d.scans))} fill="var(--color-ink)" opacity={0.25} rx={2}>
            <title>{`${d.date}: ${d.scans} ${title}${d.corrected ? `, ${d.corrected} corrected` : ''}`}</title>
          </rect>
          {d.corrected > 0 ? (
            <rect x={x(i)} y={y(d.corrected)} width={bw} height={Math.max(0, padT + plotH - y(d.corrected))} fill="var(--color-ink)" opacity={0.75} rx={2} />
          ) : null}
          {i % labelEvery === 0 ? (
            <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
              {d.date.slice(5)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
