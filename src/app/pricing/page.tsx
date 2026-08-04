// Public pricing. Two jobs: convert, and give answer engines structured pricing so "how much does
// Thick & Fit cost" resolves to real numbers (SoftwareApplication + Offer, matching the visible
// prices exactly). The honest-billing section is a deliberate competitive wedge: billing distrust is
// the loudest complaint in this category. Bilingual EN/ES, monochrome brand, no decorative green.
//
// Pre-launch every CTA points at the waitlist: the app is not charging yet, so promising instant
// checkout would be a lie.
//
// Public offer surface = ONE tier (Foundation founding pricing). Mid-ticket ("Team Thick & Fit")
// and high-ticket ("1-on-1 with Steph") are NOT pushed publicly at launch (2026-07-23 call): the
// waitlist quiz tags interested candidates and they get a private application + booking link
// post-launch. Single-card layout keeps the funnel focused on "one offer, five days to lock the
// founding price for life."
//
// CHROME: this page used to render bare, with no nav and no way out except the browser back button.
// It now wraps in MarketingShell like /about and the rest of the marketing site, which is also what
// gives it the FAQ link in both the nav and the footer, locale-prefixed. The white ground stays: the
// shell owns the dark chrome, the page owns its own band.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { JsonLd } from '@/components/seo/json-ld';
import {
  graph,
  breadcrumbNode,
  organizationNode,
  personNode,
  softwareApplicationNode,
  type JsonLdNode,
} from '@/lib/seo/schema';
import { localeAlternates, withLocalePrefix } from '@/lib/seo/locale-alternates';

// The shell reads the request path to keep every link in the visitor's language, so this page is
// request-scoped. Declared for the same reason / and /about declare it.
export const dynamic = 'force-dynamic';

type Tier = {
  id: string;
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  cta: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricing');
  const title = `${t('eyebrow')} | Thick & Fit`;
  return {
    title,
    description: t('subtitle'),
    alternates: await localeAlternates('/pricing'),
    openGraph: {
      url: '/pricing',
      title,
      description: t('subtitle'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function PricingPage(): Promise<ReactElement> {
  const t = await getTranslations('pricing');
  const tiers = t.raw('tiers') as Tier[];
  const billingPoints = t.raw('billingPoints') as string[];
  const pathname = (await headers()).get('x-pathname');
  const faqHref = withLocalePrefix(pathname, '/faq');

  const nodes = [
    organizationNode(),
    personNode(),
    // Offer price is the entry tier, which is stated visibly on this page.
    softwareApplicationNode({
      priceUSD: '19.97',
      features: tiers[0]?.features ?? [],
    }),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: t('eyebrow'), path: '/pricing' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      <section className="tf-light bg-white px-6 py-20 text-black sm:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="tf-eyebrow">{t('eyebrow')}</p>
          <h1 className="tf-display mt-3 max-w-3xl text-5xl leading-[0.95] sm:text-6xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-neutral-700">{t('subtitle')}</p>

          {/* One centered card. A 3-column grid rendering a single card reads as "grid with holes";
              a hero'd solo card reads as intentional and hero's the one offer. Max-width matches the
              landing's TierCards (max-w-[520px]) so the two surfaces feel of the same system. */}
          <div className="mt-12 flex justify-center">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="flex w-full max-w-[520px] flex-col border border-neutral-200 p-8"
              >
                <h2 className="text-xl font-semibold">{tier.name}</h2>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="tf-display text-5xl leading-none">{tier.price}</span>
                  <span className="text-sm text-neutral-500">{tier.period}</span>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">{tier.blurb}</p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] leading-snug text-neutral-700">
                      <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-black" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/join"
                  className="tf-press mt-7 block bg-black px-6 py-3.5 text-center text-[12px] font-semibold uppercase tracking-[2px] text-white"
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-neutral-600">{t('trialNote')}</p>

          {/* The honest-billing wedge. Competitors in this category are actively distrusted for
              deceptive billing, so stating the opposite plainly is a real differentiator. */}
          <div className="mt-20 border-t border-neutral-200 pt-12">
            <h2 className="tf-display text-3xl">{t('billingTitle')}</h2>
            <p className="mt-3 max-w-lg text-neutral-700">{t('billingBody')}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {billingPoints.map((p, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-neutral-800">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-black" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16 border border-neutral-200 p-8">
            <h2 className="tf-display text-3xl">{t('ctaTitle')}</h2>
            <p className="mt-3 max-w-lg text-neutral-700">{t('ctaBody')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/join"
                className="tf-press inline-block bg-black px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
              >
                {t('ctaButton')}
              </Link>
              {/* The second door. Someone who is not ready to join is not out of questions, and
                  before this the page had nowhere to send them. */}
              <Link
                href={faqHref}
                className="text-[15px] font-semibold text-black underline underline-offset-4 hover:no-underline"
              >
                {t('faqLink')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
