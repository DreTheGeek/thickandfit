import type { ReactElement } from 'react';

// Pure-SVG tri-arc macro ring (protein/carb/fat by calorie share) with kcal in the center.
// Theme-aware via fill-* utility classes + var() tokens. Reused on recipe + meal-plan surfaces.
export function MacroRing({
  proteinG,
  carbG,
  fatG,
  kcal,
  size = 76,
}: {
  proteinG: number;
  carbG: number;
  fatG: number;
  kcal: number;
  size?: number;
}): ReactElement {
  const pCal = proteinG * 4;
  const cCal = carbG * 4;
  const fCal = fatG * 9;
  const total = pCal + cCal + fCal || 1;
  const stroke = Math.max(6, Math.round(size * 0.095));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { frac: pCal / total, color: 'var(--color-macro-protein)' },
    { frac: cCal / total, color: 'var(--color-macro-carbs)' },
    { frac: fCal / total, color: 'var(--color-macro-fat)' },
  ];
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${kcal} kcal`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-warm)" strokeWidth={stroke} />
      {segs.map((s, i) => {
        const len = s.frac * circ;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${len.toFixed(2)} ${(circ - len).toFixed(2)}`}
            strokeDashoffset={(-offset).toFixed(2)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" className="fill-ink font-display" fontSize={size * 0.27}>
        {kcal}
      </text>
      <text x="50%" y="68%" textAnchor="middle" className="fill-faint" fontSize={Math.max(8, size * 0.12)} letterSpacing="1">
        KCAL
      </text>
    </svg>
  );
}
