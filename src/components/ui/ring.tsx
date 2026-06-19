import type { ReactElement, ReactNode } from 'react';

/**
 * Conic-gradient progress ring with a centered label (week stats, completion).
 * `color` defaults to ink; pass accent only for genuinely positive metrics.
 */
export function ProgressRing({
  pct,
  size = 64,
  thickness,
  color = 'var(--color-ink)',
  track = 'var(--color-line)',
  children,
}: {
  pct: number;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}): ReactElement {
  const clamped = Math.max(0, Math.min(100, pct));
  const inner = thickness != null ? size - thickness * 2 : Math.round(size * 0.72);
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} 0% ${clamped}%, ${track} ${clamped}% 100%)`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-surface font-semibold"
        style={{ width: inner, height: inner }}
      >
        {children}
      </div>
    </div>
  );
}

/** Flat horizontal progress track. */
export function ProgressBar({
  pct,
  color = 'var(--color-muted)',
  track = 'var(--color-line)',
  height = 6,
  className = '',
}: {
  pct: number;
  color?: string;
  track?: string;
  height?: number;
  className?: string;
}): ReactElement {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={className}
      style={{ height, background: track, borderRadius: 99 }}
    >
      <div
        style={{ height, width: `${clamped}%`, background: color, borderRadius: 99 }}
      />
    </div>
  );
}
