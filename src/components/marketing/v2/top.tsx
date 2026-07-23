// Top-of-page pieces: announcement bar, nav, hero.
//
// Structure follows the Ladder grammar the client picked: full-bleed photograph of the coach you
// are buying, one accent pill, one reassurance line. Every asset, colour and word here is
// Thick & Fit's. No third-party art remains.
//
// The fold sells identity, not features: no scoreboard of customers, no price. Price is a
// transaction detail and lives further down the page.
import type { ReactElement } from 'react';

import { LCta } from '@/components/marketing/v2/ui';
import { TodayCard } from '@/components/marketing/v2/today-card';

/** Thin promo strip that sits above the nav. */
export function AnnounceBar(): ReactElement {
  return (
    <div className="border-b border-white/10 bg-[#0e0e0e] px-5 py-2.5 text-center text-[13px] leading-tight text-white">
      <span>Coaching in English and Spanish</span>{' '}
      <span aria-hidden="true" className="text-[#ff2d55]">
        &rarr;
      </span>{' '}
      <a href="/join" className="font-semibold text-[#ff2d55] underline underline-offset-2">
        BEGIN
      </a>
    </div>
  );
}

const NAV_LINKS: readonly string[] = ['Pricing', 'FAQ', 'Espanol', 'Log in'];

/** Sticky top nav: wordmark left, plain links right, hamburger below lg. */
export function SiteNav(): ReactElement {
  return (
    <header className="sticky top-0 z-50 bg-[#0e0e0e]/95 backdrop-blur">
      <nav className="mx-auto flex h-[64px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <a href="#" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.svg" alt="Thick &amp; Fit" className="h-5 w-auto" />
        </a>

        {/* The captured page shows a LOGO-ONLY bar at 1280 and 1440: the links live behind the
            burger at every width, so they stay hidden here to match. The list is kept because the
            menu panel will need it once this is edited into a real page. */}
        <div className="hidden items-center gap-8" aria-hidden="true">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="whitespace-nowrap text-[15px] text-white transition-opacity hover:opacity-70"
            >
              {label}
            </a>
          ))}
        </div>

        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 flex-col items-center justify-center gap-[5px]"
        >
          <span className="block h-[2px] w-6 bg-white" />
          <span className="block h-[2px] w-6 bg-white" />
          <span className="block h-[2px] w-6 bg-white" />
        </button>
      </nav>
    </header>
  );
}

/** Hero: the promise on the left, the product proving it on the right.
 *
 *  The fold shows the Today screen rather than describing the app, because the thing worth buying is
 *  not any single feature, it is that the day is already decided. Her photograph stays as the ground
 *  so the page still opens on the person, not on a UI card floating in space. */
export function Hero(): ReactElement {
  return (
    <section className="relative isolate overflow-hidden bg-[#0e0e0e]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/img/steph-about.avif"
        alt="Coach Stephanie Pantoja"
        className="absolute inset-0 hidden h-full w-full object-cover object-[52%_12%] lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/img/steph-about.avif"
        alt="Coach Stephanie Pantoja"
        className="absolute inset-0 h-full w-full object-cover object-[52%_10%] lg:hidden"
      />
      {/* Bottom scrim for the phone layout, plus a right-weighted scrim from lg up where the copy
          column sits. Ladder floats type straight on its photo because that frame is a dark wall;
          this one is a lit gym, so the type needs its own ground. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 lg:hidden"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(to_left,rgba(8,8,8,0.88)_0%,rgba(8,8,8,0.78)_34%,rgba(8,8,8,0.35)_58%,rgba(8,8,8,0.05)_100%)]"
      />

      {/* The right column has to clear ~650px so "TRAINS ON TOKENS" stays on ONE line at 60px, the
          way it does on the real page. A 1200px container split 50/50 wrapped it to three lines. */}
      <div className="relative z-10 mx-auto grid min-h-[620px] w-full max-w-[1340px] grid-cols-1 items-end px-5 pb-14 pt-24 sm:px-8 lg:min-h-[88svh] lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-24">
        <div className="hidden justify-center lg:flex">
          <TodayCard />
        </div>

        <div className="text-center">
          <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-white sm:text-[52px] lg:whitespace-nowrap lg:text-[60px]">
            Every day,
            <br />
            already decided.
          </h1>

          <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-snug text-white/85 sm:text-[18px]">
            Open it and the day is already waiting. What to train, what to eat, what is left. You
            stop deciding and start doing.
          </p>

          <div className="mt-7">
            <LCta href="/join" className="w-full max-w-[380px] sm:w-auto">Start your 3 days free</LCta>
          </div>

          <p className="mt-3 text-[14px] font-semibold leading-tight text-white">
            No card to start. Cancel anytime, no phone call.
          </p>
        </div>
      </div>
    </section>
  );
}
