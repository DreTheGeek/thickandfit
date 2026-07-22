'use client';
// "A week with me": the one pinned section on the page.
//
// Rewritten to sit on the thread with the rest of the page. The previous version was the last
// holdout of the old system: its own centred container, the two-tone grey headline, a 400vh sticky
// track that left a screen and a half of empty ground under short copy, and a phone composite as
// the subject.
//
// It is now text-led. The day label is the fixed point, the steps are hairline rows, and a single
// progress rule fills as you move through the week. Exactly one aperture appears, and it is not the
// subject: her week is the subject, the app is evidence.
//
// Sticky only. No pinning library, no scroll interception, and no ancestor may set overflow, which
// would silently kill position: sticky. Track height is capped so the section cannot outrun its
// content the way the old one did.
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

export type StoryStep = { label: string; title: string; body: string };

type Props = {
  eyebrow: string;
  line1: string;
  line2: string;
  steps: StoryStep[];
  images: string[];
};

/** This section's segment of the thread. Declared at module scope: defining a component inside
 *  render remounts it every frame, which would reset state and thrash the DOM on a scroll handler. */
function Thread(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 w-px"
      style={{ left: 'var(--thread-x)', background: 'var(--c-line)' }}
    />
  );
}

export function ScrollStory({ eyebrow, line1, line2, steps, images }: Props): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (): void => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    let ticking = false;
    const compute = (): void => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / travel));
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
      setActive((cur) => (cur === idx ? cur : idx));
    };
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced, steps.length]);

  const heading = (
    <>
      <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">{eyebrow}</p>
      <h2 className="tf-loud max-w-[14ch]">
        {line1}
        <br />
        {line2}
      </h2>
    </>
  );

  const pad = {
    paddingLeft: 'calc(var(--thread-x) + var(--thread-gap))',
    paddingRight: 'var(--gutter)',
  };

  // Reduced motion, or no JS: the whole week as hairline rows. Nothing is hidden behind scroll.
  if (reduced) {
    return (
      <section className="relative bg-bg py-[var(--beat-open)] text-ink">
        <Thread />
        <div className="relative" style={pad}>
          {heading}
          <ol className="mt-12 flex flex-col">
            {steps.map((s) => (
              <li key={s.label} className="border-t border-line py-8 first:border-t-0 first:pt-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
                  {s.label}
                </div>
                <h3 className="tf-mid mt-3 max-w-[18ch]">{s.title}</h3>
                <p className="mt-3 max-w-[44ch] text-[17px] leading-[1.68]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    // Track height is steps + 1 screens, capped at 220vh, so a four-step week cannot leave a screen
    // and a half of empty ground under it the way the old 400vh track did.
    <section
      ref={wrapRef}
      className="relative bg-bg text-ink"
      style={{ height: `min(220svh, ${(steps.length + 1) * 78}svh)` }}
    >
      <Thread />
      <div className="sticky top-0 flex h-svh flex-col justify-center" style={pad}>
        {heading}

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] lg:items-center lg:gap-16">
          <div>
            {/* The day is the fixed point: it swaps in place rather than the layout moving. */}
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
              {steps[active]?.label}
            </div>
            <div className="relative mt-4 min-h-[176px]">
              {steps.map((s, i) => (
                <div
                  key={s.label}
                  aria-hidden={i !== active}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <h3 className="tf-mid max-w-[18ch]">{s.title}</h3>
                  <p className="mt-4 max-w-[44ch] text-[17px] leading-[1.68]">{s.body}</p>
                </div>
              ))}
            </div>

            {/* One progress rule, filling. Not four separate bars. */}
            <div className="mt-10 h-px w-full max-w-[420px] bg-line">
              <div
                className="h-px bg-ink transition-[width] duration-500"
                style={{ width: `${((active + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* The single aperture. Same constant frame as the feature rows, no device chrome. */}
          <div className="hidden lg:block">
            <div
              className="relative w-full overflow-hidden border border-line bg-surface"
              style={{ aspectRatio: '4 / 5' }}
            >
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- static app screenshot
                <img
                  key={src + i}
                  src={src}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className={`h-full w-full object-cover transition-opacity duration-500 ${
                    i === active ? 'opacity-100' : 'absolute inset-0 opacity-0'
                  }`}
                  style={{ objectPosition: '55% 35%' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
