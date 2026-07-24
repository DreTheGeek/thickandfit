// Social proof, start-today pitch, FAQ and footer for the Thick & Fit landing page.
//
// The LAYOUT is a structural clone of joinladder.com (measured 2026-07-22). Every line of copy,
// every colour token and every asset below is ours: real client quotes, real pricing, real tiers.
// The only colour change from the reference is the accent, lime #e6ff00 becomes crimson #ff2d55.
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { LCta, LH2, LSection } from '@/components/marketing/v2/ui';
import { withLocalePrefix } from '@/lib/seo/locale-alternates';

// Real member quotes are keyed but never translated: the es value equals the en value for a real
// person's words and name. Everything the coach writes (labels, FAQ answers, footer) is authored in
// both languages under the home.social namespace.
type Review = { quoteKey: string; whoKey: string };

const REVIEWS: readonly Review[] = [
  { quoteKey: 'review1Quote', whoKey: 'review1Who' },
  { quoteKey: 'review2Quote', whoKey: 'review2Who' },
  { quoteKey: 'review3Quote', whoKey: 'review3Who' },
  { quoteKey: 'review4Quote', whoKey: 'review4Who' },
  { quoteKey: 'review5Quote', whoKey: 'review5Who' },
];

const STARS: readonly number[] = [0, 1, 2, 3, 4];

/** The wall of client quotes. Five real cards in a three-up grid. */
export async function Testimonials(): Promise<ReactElement> {
  const t = await getTranslations('home.social');
  return (
    <LSection tone="dark">
      <p className="mb-10 text-center text-[14px] font-bold uppercase tracking-widest text-white">
        {t('testimonialsEyebrow')}
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((review) => (
          <article key={review.whoKey} className="rounded-xl bg-[#262626] p-6">
            <div className="flex gap-[2px]" aria-label={t('starsAria')}>
              {STARS.map((star) => (
                <span key={star} aria-hidden className="text-[13px] text-[#ff2d55]">
                  &#9733;
                </span>
              ))}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[#bcbcbc]">{t(review.quoteKey)}</p>
            <p className="mt-4 text-[13px] text-white/50">{t(review.whoKey)}</p>
          </article>
        ))}
      </div>
    </LSection>
  );
}

/** The start-today pitch: a two line headline with the second line in crimson, then the CTA. */
export async function StartToday(): Promise<ReactElement> {
  const t = await getTranslations('home.social');
  return (
    <LSection tone="dark">
      <LH2 className="text-center">
        {t('startTitleLine1')}
        <br />
        <span className="text-[#ff2d55]">{t('startTitleLine2')}</span>
      </LH2>
      <LCta href="/join" className="mx-auto mt-8 block w-fit">
        {t('ctaStartToday')}
      </LCta>
    </LSection>
  );
}

type Faq = { qKey: string; aKey: string };

const FAQS: readonly Faq[] = [
  { qKey: 'faq1Q', aKey: 'faq1A' },
  { qKey: 'faq2Q', aKey: 'faq2A' },
  { qKey: 'faq3Q', aKey: 'faq3A' },
  { qKey: 'faq4Q', aKey: 'faq4A' },
  { qKey: 'faq5Q', aKey: 'faq5A' },
];

/** The FAQ block on the bone ground. Native details/summary, no client JS. */
export async function Faq(): Promise<ReactElement> {
  const t = await getTranslations('home.social');
  return (
    <LSection tone="bone">
      <LH2 className="mb-8 text-[#0e0e0e]">{t('faqHeading')}</LH2>
      <div>
        {FAQS.map((faq) => (
          <details key={faq.qKey} className="border-b border-black/10 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-[#0e0e0e] [&::-webkit-details-marker]:hidden">
              {t(faq.qKey)}
              <span aria-hidden className="ml-4 shrink-0 text-[20px] font-bold">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[70ch] text-[15px] text-[#4a4a4a]">{t(faq.aKey)}</p>
          </details>
        ))}
      </div>
    </LSection>
  );
}

// Source shape for the footer link lists: the label is a translation key, the href a real route.
type FooterLinkDef = { labelKey: string; href: string };
// Resolved shape handed to FooterColumn: label already translated, href already locale-prefixed.
type FooterLink = { label: string; href: string };

// Public offer surface is ONE tier (Foundation founding pricing) — mid/high-ticket ships as a
// private-application flow post-launch, not as a public program. So the footer drops the
// "Programs" column entirely; Pricing lives in the Pages column and that's enough.
const PAGE_LINKS: readonly FooterLinkDef[] = [
  { labelKey: 'linkPricing', href: '/pricing' },
  { labelKey: 'linkFaq', href: '/faq' },
  { labelKey: 'linkAbout', href: '/about' },
  { labelKey: 'linkPrivacy', href: '/privacy' },
  { labelKey: 'linkTerms', href: '/terms' },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly FooterLink[];
}): ReactElement {
  return (
    <div>
      <h3 className="text-[14px] font-bold uppercase text-white">{heading}</h3>
      <div className="mt-4 flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-[14px] text-[#bcbcbc] hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Four column footer with the trial CTA and the legal strip. Links resolve to real routes, kept in
 *  the visitor's language where a Spanish twin exists. */
export async function SiteFooter(): Promise<ReactElement> {
  const t = await getTranslations('home.social');
  const pathname = (await headers()).get('x-pathname');
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  const withLocale = (links: readonly FooterLinkDef[]): FooterLink[] =>
    links.map((l) => ({ label: t(l.labelKey), href: lp(l.href) }));

  return (
    <footer className="bg-[#0e0e0e] px-5 py-16 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Link href={lp('/')} aria-label="Thick &amp; Fit" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-white.svg" alt="Thick &amp; Fit" className="h-5 w-auto" />
            </Link>
            <p className="mt-4 text-[14px] text-[#bcbcbc]">{t('tagline')}</p>
          </div>
          <FooterColumn heading={t('footerPagesHeading')} links={withLocale(PAGE_LINKS)} />
          <div>
            <h3 className="text-[14px] font-bold uppercase text-white">
              {t('footerGetStartedHeading')}
            </h3>
            <LCta href="/join" className="mt-4 block w-fit">
              {t('ctaStartToday')}
            </LCta>
            <p className="mt-3 text-[13px] text-[#bcbcbc]">{t('footerCancelNote')}</p>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-[13px] text-white/50">{t('footerCopyright')}</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-[13px] text-white/50 hover:text-white">
              {t('linkPrivacy')}
            </Link>
            <Link href="/terms" className="text-[13px] text-white/50 hover:text-white">
              {t('linkTerms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
