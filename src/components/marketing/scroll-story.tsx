'use client';
// Scroll-driven story. Same principle Big Steele demoed (scroll position drives the playhead, the
// user's scroll IS the timeline) but powered by REAL app screens instead of a generated background
// video. That choice is deliberate:
//   - no $6/page video generation, and nothing fabricated (a generated "body transformation" would be
//     an invented before/after, which breaks the never-fabricate rule and is FTC-sensitive),
//   - a handful of small images beats a scrubbed video on mobile, which matters because her audience
//     is mobile-first across the US and LATAM, often on slower connections.
//
// Perf: passive scroll listener coalesced into one rAF, state only set when the index actually
// changes, images decode lazily. Honors prefers-reduced-motion by falling back to a plain stacked
// list with no scroll math at all.
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
      <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">{eyebrow}</p>
      <h2 className="tf-display mt-4 text-[clamp(32px,5vw,60px)] leading-[0.94]">
        {line1}
        <br />
        <span className="text-faint">{line2}</span>
      </h2>
    </>
  );

  // Reduced motion (or no JS): a plain, complete, readable version. Nothing is hidden behind scroll.
  if (reduced) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 py-20 sm:py-28">
        {heading}
        <div className="mt-12 flex flex-col gap-14">
          {steps.map((s, i) => (
            <div key={s.label} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[2px] text-faint">{s.label}</div>
                <h3 className="tf-display mt-3 text-[clamp(24px,3.4vw,38px)] leading-[1.02]">{s.title}</h3>
                <p className="mt-4 max-w-[460px] text-[16px] leading-[1.7] text-soft">{s.body}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- static app screenshot */}
              <img
                src={images[i % images.length]}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="mx-auto w-full max-w-[260px] rounded-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={wrapRef} style={{ height: `${steps.length * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            {heading}
            <div className="relative mt-10 min-h-[190px]">
              {steps.map((s, i) => (
                <div
                  key={s.label}
                  aria-hidden={i !== active}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <div className="text-[12px] font-semibold uppercase tracking-[2px] text-faint">
                    {s.label}
                  </div>
                  <h3 className="tf-display mt-3 text-[clamp(24px,3.2vw,40px)] leading-[1.02]">
                    {s.title}
                  </h3>
                  <p className="mt-4 max-w-[460px] text-[16px] leading-[1.7] text-soft">{s.body}</p>
                </div>
              ))}
            </div>
            {/* Progress rail: shows how far through the week you are. */}
            <div className="mt-8 flex gap-2">
              {steps.map((s, i) => (
                <span
                  key={s.label}
                  className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                    i <= active ? 'bg-ink' : 'bg-line'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative mx-auto h-[340px] w-full max-w-[300px] sm:h-[440px] sm:max-w-[340px]">
            {images.slice(0, steps.length).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- static app screenshot
              <img
                key={src + i}
                src={src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={`absolute inset-0 mx-auto h-full w-auto rounded-[24px] object-contain shadow-[0_24px_60px_rgba(0,0,0,0.22)] transition-opacity duration-500 ${
                  i === active ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
