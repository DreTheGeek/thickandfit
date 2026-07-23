// Feature bands for the Thick & Fit landing page (/preview/v2).
//
// Structure mirrors joinladder.com's feature-band layout. Every string is now our own copy and the
// accent is our crimson #ff2d55, not Ladder's lime. The media blocks are still placeholders: swap
// each one for real product art before this ships.
import type { ReactElement } from 'react';

import { LBody, LCta, LEyebrow, LH2, LSection } from '@/components/marketing/v2/ui';

const DAY_LABELS: readonly string[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Small centred label used inside the media placeholders. */
function MediaLabel({ children, tone }: { children: string; tone: 'dark' | 'bone' }): ReactElement {
  return (
    <span
      className={`text-[13px] uppercase tracking-widest ${
        tone === 'dark' ? 'text-white/40' : 'text-[#8a8a8a]'
      }`}
    >
      {children}
    </span>
  );
}

/** Day strip plus copy on the left, the app phone on the right. */
export function KnowExactly(): ReactElement {
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="flex gap-2">
            {DAY_LABELS.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold ${
                  index === 0
                    ? 'border-2 border-[#ff2d55] bg-transparent text-[#ff2d55]'
                    : 'bg-[#262626] text-white/70'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <LH2 className="mt-8">Never wonder what to do when you walk into the gym again.</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">
            Every day already decided, built around the equipment you actually have. You show up and
            execute.
          </LBody>
          <LCta className="mt-8" href="/join">
            Start your 3 days free
          </LCta>
        </div>

        <div className="relative grid place-items-center">
          <div className="absolute h-[420px] w-[420px] max-w-full rounded-full bg-[#161616]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/img/app-1.avif"
            alt=""
            className="relative h-auto w-[290px] max-w-full"
          />
        </div>
      </div>
    </LSection>
  );
}

/** The one light band: media left, fuel copy right. */
export function SaveTime(): ReactElement {
  return (
    <LSection tone="bone">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="grid aspect-[4/5] w-full place-items-center rounded-xl bg-[#e4e4e4]">
          <MediaLabel tone="bone">Fuel</MediaLabel>
        </div>

        <div>
          <LEyebrow className="text-[#0e0e0e]">Fuel</LEyebrow>
          <LH2 className="mt-1">Eat with confidence instead of guilt.</LH2>
          <LBody className="mt-5 text-[#4a4a4a]">
            The food you already eat, in the amounts that move you forward. No weighing, no math, no
            guilt at the table.
          </LBody>
        </div>
      </div>
    </LSection>
  );
}

/** Coach video left, coaching copy and the CTA right. */
export function LearnFromBest(): ReactElement {
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="grid aspect-[4/5] w-full place-items-center rounded-xl bg-[#262626]">
          <MediaLabel tone="dark">Coach chat</MediaLabel>
        </div>

        <div>
          <LEyebrow className="text-white">Accountability</LEyebrow>
          <LH2 className="mt-1">You stop doing this alone.</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">
            Her team is in your corner every week. Someone who knows your name, your plan and what
            you are working toward.
          </LBody>
          <LCta className="mt-8" href="/join">
            Start your 3 days free
          </LCta>
        </div>
      </div>
    </LSection>
  );
}

/** Two stacked identity bands that alternate sides on desktop. */
export function TrackBlocks(): ReactElement {
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <LEyebrow>Evolution</LEyebrow>
          <LH2 className="mt-1">Watch yourself become unrecognizable.</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">
            The change you cannot see day to day, laid out so it is impossible to miss.
          </LBody>
        </div>
        <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-[#262626]">
          <MediaLabel tone="dark">Evolution</MediaLabel>
        </div>
      </div>

      <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
        <div className="order-1 lg:order-2">
          <LEyebrow>Discipline</LEyebrow>
          <LH2 className="mt-1">Become the person people ask for advice.</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">
            Consistency compounds. In twelve weeks you are the one being asked how you did it.
          </LBody>
        </div>
        <div className="order-2 grid aspect-[4/3] w-full place-items-center rounded-xl bg-[#262626] lg:order-1">
          <MediaLabel tone="dark">Today</MediaLabel>
        </div>
      </div>
    </LSection>
  );
}
