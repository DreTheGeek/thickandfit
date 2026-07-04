// Pure-SVG request-volume chart (recharts blanks on React 19). Two series: total requests + errors.
import type { ReactElement } from 'react';

export function VolumeChart({ data }: { data: { day: string; requests: number; errors: number }[] }): ReactElement {
  if (data.length === 0) return <p className="py-8 text-center text-[13px] text-faint">No requests logged yet. Traffic appears here as the app is used.</p>;
  const W = 720, H = 200, pad = 28;
  const max = Math.max(1, ...data.map((d) => d.requests));
  const x = (i: number): number => pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2);
  const y = (v: number): number => H - pad - (v / max) * (H - pad * 2);
  const line = (key: 'requests' | 'errors'): string => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = `${line('requests')} L${x(data.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Request volume">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" className="text-line" strokeWidth="1" strokeDasharray="3 3" />
            <text x={4} y={y(max * f) + 3} className="fill-faint text-[9px]">{Math.round(max * f)}</text>
          </g>
        ))}
        <path d={area} fill="#3D6FA5" opacity="0.12" />
        <path d={line('requests')} fill="none" stroke="#3D6FA5" strokeWidth="2" />
        <path d={line('errors')} fill="none" stroke="#B4462F" strokeWidth="2" />
        {data.length <= 32 && data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-faint text-[8px]">{d.day.slice(5)}</text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-faint">
        <span><span className="inline-block h-2 w-2 rounded-full" style={{ background: '#3D6FA5' }} /> Requests</span>
        <span><span className="inline-block h-2 w-2 rounded-full" style={{ background: '#B4462F' }} /> Errors</span>
      </div>
    </div>
  );
}
