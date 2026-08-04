// Top-of-page pieces: announcement bar, nav, hero.
//
// Structure follows the Ladder grammar the client picked: full-bleed photograph of the coach you
// are buying, one accent pill, one reassurance line. Every asset, colour and word here is
// Thick & Fit's. No third-party art remains.
//
// The fold sells identity, not features: no scoreboard of customers, no price. Price is a
// transaction detail and lives further down the page.
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { LCta } from '@/components/marketing/v2/ui';
import { TodayCard } from '@/components/marketing/v2/today-card';
import { NavMenu, type NavLink } from '@/components/marketing/v2/nav-menu';
import { withLocalePrefix, twinPathFor } from '@/lib/seo/locale-alternates';

/** Thin promo strip that sits above the nav. */
export async function AnnounceBar(): Promise<ReactElement> {
  const t = await getTranslations('home.top');
  return (
    <div className="border-b border-white/10 bg-[#0e0e0e] px-5 py-2.5 text-center text-[13px] leading-tight text-white">
      <span>{t('announce')}</span>{' '}
      <span aria-hidden="true" className="text-[#ff2d55]">
        &rarr;
      </span>{' '}
      <a href="/join" className="font-semibold text-[#ff2d55] underline underline-offset-2">
        {t('announceCta')}
      </a>
    </div>
  );
}

/** Sticky top nav: wordmark left, hamburger right. The bar stays logo-only to match the reference;
 *  the burger opens the real menu (built in NavMenu). Links are locale-aware, so a visitor reading
 *  /es keeps their language and there is a real path to /es (and back to English).
 *
 *  Labels come from the message bundle, not from literals: the bar renders on /es too, and a
 *  hardcoded "Pricing" is the one thing a Spanish reader sees before any of the page copy. The
 *  language switch is the deliberate exception, because a switcher names the language it leads to,
 *  in that language. */
export async function SiteNav(): Promise<ReactElement> {
  const t = await getTranslations('home.top');
  const pathname = (await headers()).get('x-pathname');
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  const twin = twinPathFor(pathname);

  const links: NavLink[] = [
    { label: t('navPricing'), href: lp('/pricing') },
    { label: t('navFaq'), href: lp('/faq') },
    ...(twin
      ? [
          {
            label: twin.to === 'es' ? 'Español' : 'English',
            href: twin.href,
            hrefLang: twin.to,
            lang: twin.to,
            ariaLabel: twin.to === 'es' ? 'Ver en español' : 'View in English',
          },
        ]
      : []),
    { label: t('navLogin'), href: '/auth/sign-in' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0e0e0e]/95 backdrop-blur">
      <nav className="mx-auto flex h-[64px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href={lp('/')} aria-label="Thick &amp; Fit" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.svg" alt="Thick &amp; Fit" className="h-5 w-auto" />
        </Link>

        <NavMenu
          links={links}
          cta={{ label: t('heroCta'), href: '/join' }}
          openLabel={t('menuOpen')}
          closeLabel={t('menuClose')}
        />
      </nav>
    </header>
  );
}

/** Hero: the promise on the left, the product proving it on the right.
 *
 *  The fold shows the Today screen rather than describing the app, because the thing worth buying is
 *  not any single feature, it is that the day is already decided. Her photograph stays as the ground
 *  so the page still opens on the person, not on a UI card floating in space. */
export async function Hero(): Promise<ReactElement> {
  const t = await getTranslations('home.top');
  return (
    <section className="relative isolate overflow-hidden bg-[#0e0e0e]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/shoot/pink-front.avif"
        alt="Coach Stephanie Pantoja"
        className="absolute inset-0 hidden h-full w-full object-cover object-[62%_18%] lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/shoot/pink-front.avif"
        alt="Coach Stephanie Pantoja"
        className="absolute inset-0 h-full w-full object-cover object-[50%_16%] lg:hidden"
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
          way it does on the real page. A 1200px container split 50/50 wrapped it to three lines.

          Phone height is deliberately shorter than everything above sm. The copy is bottom-anchored
          (that is where the scrim is strongest), so the section's own height is what decides how much
          wordless photo a visitor scrolls past first: at 620px the headline landed 365px down a
          812px screen, a third of the fold with nothing to read. Shortening the box to 480px and
          trimming the vertical padding lifts the whole block without touching the alignment, the
          scrim, or anything from sm up. */}
      <div className="relative z-10 mx-auto grid min-h-[480px] w-full max-w-[1340px] grid-cols-1 items-end px-5 pb-12 pt-16 sm:min-h-[620px] sm:px-8 sm:pb-14 sm:pt-24 lg:min-h-[88svh] lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-24">
        <div className="hidden justify-center lg:flex">
          <TodayCard />
        </div>

        <div className="text-center">
          <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-white sm:text-[52px] lg:whitespace-nowrap lg:text-[60px]">
            {t('heroHeadline1')}
            <br />
            {t('heroHeadline2')}
          </h1>

          <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-snug text-white/85 sm:text-[18px]">
            {t('heroSub')}
          </p>

          <div className="mt-7">
            <LCta href="/join" className="w-full max-w-[380px] sm:w-auto">
              {t('heroCta')}
            </LCta>
          </div>

          <p className="mt-3 text-[14px] font-semibold leading-tight text-white">
            {t('heroReassure')}
          </p>
        </div>
      </div>
    </section>
  );
}
