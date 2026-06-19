import type { ReactElement } from 'react';

type Point = { label: string; gross: number; coach: number };

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
const tick = (n: number): string => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

// Pure-SVG monthly revenue area chart. Scales to its container via viewBox (no JS measurement,
// renders server-side). Gross vs coach-take, with native hover tooltips on each point.
export function RevenueChart({ data }: { data: Point[] }): ReactElement {
  const W = 720;
  const H = 240;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.gross));
  const baseline = padT + plotH;
  const x = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (v: number): number => padT + plotH - (v / max) * plotH;
  const line = (key: 'gross' | 'coach'): string =>
    data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = (key: 'gross' | 'coach'): string =>
    `M${x(0).toFixed(1)},${baseline} ` +
    data.map((d, i) => `L${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ') +
    ` L${x(n - 1).toFixed(1)},${baseline} Z`;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#0f0f0f" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="gCoach" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5EBE62" stopOpacity={0.24} />
          <stop offset="100%" stopColor="#5EBE62" stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="#f0f0f0" strokeWidth={1} />
          <text x={padL - 8} y={y(tk) + 3} textAnchor="end" fontSize="10" fill="#999">
            {tick(tk)}
          </text>
        </g>
      ))}

      <path d={area('gross')} fill="url(#gGross)" />
      <path d={area('coach')} fill="url(#gCoach)" />
      <path d={line('gross')} fill="none" stroke="#0f0f0f" strokeWidth={2} />
      <path d={line('coach')} fill="none" stroke="#5EBE62" strokeWidth={2} />

      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.gross)} r={2.5} fill="#0f0f0f">
          <title>{`${d.label}: ${money(d.gross)} gross / ${money(d.coach)} take`}</title>
        </circle>
      ))}

      {data.map((d, i) =>
        i % labelEvery === 0 ? (
          <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#999">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
