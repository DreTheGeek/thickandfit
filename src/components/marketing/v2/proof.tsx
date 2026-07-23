// Identity band for the Thick & Fit landing page.
//
// The layout came from a reference clone, but every asset and every line of copy here is ours.
// The wordmark is set in type rather than pulled from a third-party file. No scoreboard lives on
// this page: no client counts, no follower counts, no press wall, no review totals. Proof is the
// transformation itself, stated plainly.
import type { ReactElement } from 'react';

import { Icon } from '@/components/ui/icons';

import { LH2, LSection } from '@/components/marketing/v2/ui';

/** The oversized, low-opacity THICK & FIT wordmark that bleeds under the section above it. */
export function BigWordmark(): ReactElement {
  return (
    <section className="-mt-10 overflow-hidden bg-[#0e0e0e] px-5 py-0 sm:px-8 lg:-mt-20">
      <p
        aria-hidden="true"
        className="select-none text-center text-[18vw] font-extrabold uppercase leading-none tracking-[-0.02em] text-white opacity-[0.08]"
      >
        Thick &amp; Fit
      </p>
    </section>
  );
}

// The transformation, stated as a before and after. Not features, not counts.
const BEFORE: readonly string[] = [
  'Random workouts',
  'Guessing meals',
  'Losing motivation',
  'Starting over every Monday',
];

const AFTER: readonly string[] = [
  'Clear direction',
  'Visible progress',
  'Daily accountability',
  'Confidence',
];

/** The before and after column pair: what actually changes about you. */
export function TheDifference(): ReactElement {
  return (
    <LSection tone="dark">
      <p className="text-center text-[14px] font-bold uppercase tracking-widest text-white">
        The difference
      </p>
      <LH2 className="mt-4 text-center">What changes</LH2>
      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
        <div>
          <p className="mb-5 text-[13px] uppercase tracking-widest text-[#bcbcbc]">Before</p>
          <div className="flex flex-col gap-4">
            {BEFORE.map((item) => (
              <p key={item} className="text-[18px] text-[#8a8a8a] sm:text-[20px]">
                {item}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-5 text-[13px] uppercase tracking-widest text-[#ff2d55]">After</p>
          <div className="flex flex-col gap-4">
            {AFTER.map((item) => (
              <p key={item} className="text-[18px] font-bold text-white sm:text-[20px]">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>
    </LSection>
  );
}

type Benefit = { icon: 'bolt' | 'nutrition' | 'chat' | 'camera'; title: string; body: string };

const BENEFITS: readonly Benefit[] = [
  {
    icon: 'bolt',
    title: 'Never wonder what to do again',
    body: 'You walk in knowing exactly what today is. No guessing, no scrolling, no wasted session.',
  },
  {
    icon: 'nutrition',
    title: 'Eat with confidence instead of guilt',
    body: 'Food you already love, in the amounts that move you forward. Photograph it and it is handled.',
  },
  {
    icon: 'chat',
    title: 'You stop doing this alone',
    body: 'Her team answers you every week. Someone knows your name and your plan.',
  },
  {
    icon: 'camera',
    title: 'Watch yourself become unrecognizable',
    body: 'The change you cannot feel day to day, made impossible to miss.',
  },
];

/** Four-up identity grid under a centred headline. */
export function BusyPeople(): ReactElement {
  return (
    <LSection tone="dark">
      <LH2 className="mb-14 text-center">You are not here for an app</LH2>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center text-white">
              <Icon name={benefit.icon} size={34} strokeWidth={1.8} />
            </span>
            <h3 className="mt-5 text-[18px] font-extrabold uppercase leading-[1.1] text-white">
              {benefit.title}
            </h3>
            <p className="mx-auto mt-2 max-w-[26ch] text-[14px] leading-[1.5] text-[#bcbcbc]">
              {benefit.body}
            </p>
          </div>
        ))}
      </div>
    </LSection>
  );
}
