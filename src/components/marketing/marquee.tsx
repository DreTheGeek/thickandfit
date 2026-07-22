// Ticker strip. Sits between sections as a breath and a tone-setter, and it does one job no other
// section on the page can: it puts English and Spanish physically side by side, moving, so the
// bilingual promise is felt before it is ever claimed.
//
// Pure CSS (no JS, no client boundary): the track is duplicated once and translated -50%, which
// loops seamlessly. aria-hidden on the duplicate so screen readers hear the phrases once.
import type { ReactElement } from 'react';

export function Marquee({ items }: { items: string[] }): ReactElement {
  const run = (hidden: boolean): ReactElement => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((s, i) => (
        <span key={`${s}${i}`} className="flex items-center">
          <span className="px-6 text-[clamp(15px,1.6vw,19px)] font-medium leading-none">{s}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--c-accent)]" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden bg-ink py-4 text-white/85 select-none">
      <div className="tf-marquee flex w-max">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
