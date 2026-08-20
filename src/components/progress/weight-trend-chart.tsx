import type { ReactElement } from 'react';
import type { WeightPoint } from '@/lib/body/types';

// Pure-SVG weight trend (recharts blanks on React 19). Zooms to the data range instead of a zero
// baseline so real movement is legible, draws the goal as a dashed line, and hover-titles each point.
export function WeightTrendChart({
  series,
  goalLb,
  goalLabel,
}: {
  series: WeightPoint[];
  goalLb: number | null;
  goalLabel: string;
}): ReactElement {
  const W = 720;
  const H = 240;
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = series.length;

  /**
   * THE SCALE FOLLOWS HER DATA, NOT HER GOAL.
   *
   * The goal used to join the min/max, so a member 24lb out had a y-axis spanning 164 to 138 while
   * her actual range was 165 to 155. Ten pounds of real work rendered as a flat line in the top
   * third of the card: technically accurate and it reads as nothing happening, on the one screen
   * whose entire job is to show that something did.
   *
   * So the axis is built from the readings. The goal still gets its line, and when it falls outside
   * the view it is CLAMPED to the bottom edge rather than dropped, so "141" stays visible as a
   * marker of how far there is to go without flattening how far she has come. `goalOutside` drives
   * the label so a pinned line cannot be misread as a goal she is nearly touching.
   */
  const vals = series.map((p) => p.lb);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const spread = Math.max(4, rawMax - rawMin);
  const min = rawMin - spread * 0.15;
  const max = rawMax + spread * 0.15;
  const goalOutside = goalLb != null && (goalLb < min || goalLb > max);

  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - ((v - min) / (max - min)) * plotH;

  // Kept a few px inside the plot so the dashes and the label are both fully drawn.
  const goalY = goalLb == null ? 0 : Math.min(padT + plotH - 2, Math.max(padT + 12, y(goalLb)));

  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ');
  const area =
    n > 0
      ? `M${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} ` +
        series.map((p, i) => `L${x(i).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ') +
        ` L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';

  const ticks = [max, (max + min) / 2, min];
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        {/* Ink line + fill: green is functional-only (the delta figure), never a decorative trend line. */}
        <linearGradient id="gWeight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-ink)" stopOpacity={0.14} />
          <stop offset="100%" stopColor="var(--c-ink)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--c-divider)" strokeWidth={1} />
          <text x={padL - 8} y={y(tk) + 3} textAnchor="end" fontSize="11" fill="var(--c-faint)">
            {Math.round(tk)}
          </text>
        </g>
      ))}

      {goalLb != null && (
        <g>
          {/* Clamped into the plot. An off-scale goal drawn at its true y sits outside the viewBox
              and simply disappears, which is how "no goal set" and "goal is 24lb away" would end up
              looking identical. Pinned to the edge and dimmed instead, so it reads as a marker of
              distance rather than a line she is about to cross. */}
          <line
            x1={padL}
            x2={W - padR}
            y1={goalY}
            y2={goalY}
            stroke="var(--c-ink)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            opacity={goalOutside ? 0.35 : 0.5}
          />
          <text x={W - padR} y={goalY - 5} textAnchor="end" fontSize="11" fill="var(--c-muted)">
            {goalLabel} {Math.round(goalLb)}
          </text>
        </g>
      )}

      {area && <path d={area} fill="url(#gWeight)" />}
      {n > 1 && <path d={line} fill="none" stroke="var(--c-ink)" strokeWidth={2.5} />}

      {series.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.lb)} r={n > 30 ? 1.8 : 3} fill="var(--c-ink)">
          <title>{`${p.on}: ${p.lb} lb`}</title>
        </circle>
      ))}

      {series.map((p, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--c-faint)">
            {p.on.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
