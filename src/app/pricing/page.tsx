// Public pricing. Two jobs: convert, and give answer engines structured pricing so "how much does
// Thick & Fit cost" resolves to real numbers (SoftwareApplication + Offer, matching the visible
// prices exactly). The honest-billing section is a deliberate competitive wedge: billing distrust is
// the loudest complaint in this category. Bilingual EN/ES, monochrome brand, no decorative green.
//
// Pre-launch every CTA points at the waitlist: the app is not charging yet, so promising instant
// checkout would be a lie.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/seo/json-ld';
import {
  graph,
  breadcrumbNode,
  organizationNode,
  personNode,
  softwareApplicationNode,
  type JsonLdNode,
} from '@/lib/seo/schema';

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
    alternates: { canonical: '/pricing' },
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
    <main className="tf-light min-h-screen bg-white text-black">
      <JsonLd data={graph(nodes)} />

      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <p className="tf-eyebrow">{t('eyebrow')}</p>
        <h1 className="tf-display mt-3 max-w-3xl text-5xl leading-[0.95] sm:text-6xl">{t('title')}</h1>
        <p className="mt-5 max-w-xl text-lg text-neutral-700">{t('subtitle')}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="flex flex-col border border-neutral-200 p-7">
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="tf-display text-4xl leading-none">{tier.price}</span>
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
          <Link
            href="/join"
            className="tf-press mt-6 inline-block bg-black px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
          >
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </main>
  );
}
