import type { ReactElement } from 'react';

export type RatePoint = { label: string; value: number | null };

// Generic percent-over-time line. Null points BREAK the line (a week with no data is a gap, not a
// zero). Pure SVG, server-rendered, native <title> tooltips.
export function RateTrendChart({ data, unit, emptyLabel }: { data: RatePoint[]; unit: string; emptyLabel: string }): ReactElement {
  const W = 720;
  const H = 200;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(1, data.length);
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  const max = Math.max(10, ...values);
  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - (Math.min(max, v) / max) * plotH;

  // Build path segments, breaking at nulls.
  let path = '';
  let pen = false;
  data.forEach((d, i) => {
    if (d.value == null) {
      pen = false;
      return;
    }
    path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)} `;
    pen = true;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      {[0, max / 2, max].map((tk, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--color-divider)" strokeWidth={1} />
          <text x={padL - 6} y={y(tk) + 3} textAnchor="end" fontSize="10" fill="var(--color-faint)">
            {Math.round(tk)}{unit}
          </text>
        </g>
      ))}
      {values.length === 0 ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-faint)">
          {emptyLabel}
        </text>
      ) : (
        <>
          <path d={path.trim()} fill="none" stroke="#5EBE62" strokeWidth={2} />
          {data.map((d, i) =>
            d.value != null ? (
              <circle key={i} cx={x(i)} cy={y(d.value)} r={2.5} fill="#5EBE62">
                <title>{`${d.label}: ${d.value}${unit}`}</title>
              </circle>
            ) : null,
          )}
          {data.map((d, i) => (
            <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
              {d.label.slice(5)}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}
