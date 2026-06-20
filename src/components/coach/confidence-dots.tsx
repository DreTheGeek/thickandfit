import type { ReactElement } from 'react';

// Per-ingredient match confidence as 3 dots (0-1 -> 1/2/3 filled). Verified matches use the
// accent color; unverified use muted. Pure + theme-aware, no client JS.
export function ConfidenceDots({
  confidence,
  isVerified,
  label,
}: {
  confidence: number;
  isVerified: boolean;
  label: string;
}): ReactElement {
  const filled = confidence >= 0.8 ? 3 : confidence >= 0.5 ? 2 : 1;
  const color = isVerified ? 'bg-accent' : 'bg-soft';
  return (
    <span className="inline-flex items-center gap-0.5" title={label} aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < filled ? color : 'bg-line'}`} />
      ))}
    </span>
  );
}
