import type { ReactElement } from 'react';
import { PersonGlyph } from './icons';

/**
 * Monochrome monogram avatar. Renders initials (Gulams) when provided,
 * otherwise a person glyph on near-black. Real member photos swap in later.
 */
export function Avatar({
  initials,
  size = 40,
  tone = 'ink',
  className = '',
}: {
  initials?: string;
  size?: number;
  tone?: 'ink' | 'muted' | 'warm';
  className?: string;
}): ReactElement {
  const bg =
    tone === 'ink' ? 'bg-ink' : tone === 'muted' ? 'bg-muted' : 'bg-warm';
  const fg = tone === 'warm' ? 'text-ink' : 'text-bg';
  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center rounded-full',
        bg,
        fg,
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      {initials ? (
        <span
          className="font-display leading-none"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {initials}
        </span>
      ) : (
        <PersonGlyph />
      )}
    </div>
  );
}
