import type { ReactElement } from 'react';

export type WeightPoint = { on: string; kg: number };

/**
 * Her weigh-ins against her goal.
 *
 * We hold 769 weight entries across 246 clients and rendered four numbers from them: count, start,
 * latest, net change. Four numbers cannot answer the question a coach actually asks, which is
 * "is this working, and how far is she from where she said she wanted to be". A line and a goal
 * marker answer it in a glance.
 *
 * Pure SVG scaled by viewBox, matching revenue-chart.tsx: no JS measurement, so it renders on the
 * server with the rest of the page and there is nothing to hydrate.
 */
export function WeightTrend({
  points,
  goalKg,
  startKg,
  locale,
}: {
  points: readonly WeightPoint[];
  goalKg: number | null;
  startKg: number | null;
  locale: string;
}): ReactElement | null {
  if (points.length < 2) return null;

  const W = 720;
  const H = 200;
  const padL = 42;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = points.length;

  // The goal is part of the domain, not an annotation floating outside it: a goal below every
  // recorded weight has to stay on the canvas or the chart claims she is already there.
  const values = [...points.map((p) => p.kg), ...(goalKg != null ? [goalKg] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A flat run would divide by zero and a 0.2kg range would render as a wild sawtooth. Both are
  // solved by never letting the visible span fall under 2kg.
  const pad = Math.max(1, (hi - lo) * 0.15);
  const min = lo - pad;
  const max = hi + pad;
  const span = Math.max(2, max - min);

  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - ((v - min) / span) * plotH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area =
    `M${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} ` +
    points.map((p, i) => `L${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ') +
    ` L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const fmtDate = (d: string): string =>
    new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(`${d}T00:00:00`));

  const last = points[n - 1];
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id="gWeight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ink)" stopOpacity={0.14} />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Starting weight, so the whole line reads as movement away from a fixed origin. */}
      {startKg != null && startKg >= min && startKg <= max && (
        <g>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(startKg)}
            y2={y(startKg)}
            stroke="var(--color-line)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <text x={padL - 6} y={y(startKg) + 3} textAnchor="end" fontSize={9} fill="var(--color-faint)">
            {startKg.toFixed(1)}
          </text>
        </g>
      )}

      {/* The goal. Green because reaching it is the functional outcome this chart exists to report,
          which is exactly what the brand reserves green for. */}
      {goalKg != null && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(goalKg)} y2={y(goalKg)} stroke="#5EBE62" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - padR} y={y(goalKg) - 5} textAnchor="end" fontSize={10} fontWeight={600} fill="#5EBE62">
            {goalKg.toFixed(1)} kg
          </text>
        </g>
      )}

      <path d={area} fill="url(#gWeight)" />
      <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={`${p.on}-${i}`} cx={x(i)} cy={y(p.kg)} r={i === n - 1 ? 3.5 : 1.8} fill="var(--color-ink)">
          <title>{`${p.on}: ${p.kg.toFixed(1)} kg`}</title>
        </circle>
      ))}

      <text x={x(n - 1)} y={y(last.kg) - 9} textAnchor="end" fontSize={10} fontWeight={600} fill="var(--color-ink)">
        {last.kg.toFixed(1)}
      </text>

      {points.map((p, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={`t-${p.on}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--color-faint)">
            {fmtDate(p.on)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
