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
          <span className="tf-display px-6 text-[clamp(22px,3.4vw,40px)] leading-none">{s}</span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden bg-ink py-5 text-white select-none">
      <div className="tf-marquee flex w-max">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
