// About. Rebuilt from the pre-launch pitch page that used to live here.
//
// That version was correctly carrying robots noindex: it was written for partners, not customers.
// It named and criticised the platform she is leaving, stated that her paying clients were being
// migrated off it and how their rev-share was handled, asserted that competitors had been fined by
// the FTC, listed named private individuals and their roles, disclosed the vendor roadmap and the
// stack, and described the coach feature as shipped when its PRD is still blocked. None of that
// belongs on an indexed page. All of it is gone, and the reasons are in the commit.
//
// What remains is true, shipped, and customer-facing: her story, the differences a member actually
// experiences, who it is for, and the real numbers. Styled to match the rest of the marketing
// surface (monochrome cream and ink, tf-display headings) rather than the decorative green the old
// page used, which breaks the brand rule that green is functional only.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { JsonLd } from '@/components/seo/json-ld';
import { localeAlternates } from '@/lib/seo/locale-alternates';
import {
  graph,
  breadcrumbNode,
  organizationNode,
  personNode,
  websiteNode,
  type JsonLdNode,
} from '@/lib/seo/schema';

type Diff = { t: string; d: string };
type Stat = { n: string; l: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: await localeAlternates('/about'),
    openGraph: {
      url: '/about',
      title: t('metaTitle'),
      description: t('metaDesc'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function AboutPage(): Promise<ReactElement> {
  const t = await getTranslations('about');
  const diffs = t.raw('diffs') as Diff[];
  const stats = t.raw('stats') as Stat[];

  // About is the entity surface: it is the page an answer engine reads to decide who Stephanie and
  // Thick & Fit are, so it carries the full identity graph rather than a product node.
  const nodes = [organizationNode(), personNode(), websiteNode(), breadcrumbNode([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ])].filter((n): n is JsonLdNode => n !== null);

  return (
    <div className="tf-light">
      <JsonLd data={graph(nodes)} />
      <MarketingNav />

      <main className="bg-white text-ink">
        {/* Hero */}
        <section className="bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 sm:pt-20">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
              {t('eyebrow')}
            </p>
            <h1 className="tf-display mt-5 max-w-[15ch] text-[clamp(44px,9vw,84px)] leading-[0.9]">
              {t('h1a')}
              <br />
              <span className="text-faint">{t('h1b')}</span>
            </h1>
            <p className="mt-8 max-w-[62ch] text-[16px] leading-[1.75] text-soft sm:text-[17px]">
              {t('intro')}
            </p>
          </div>
        </section>

        {/* Origin, on ink for the same contrast rhythm the home page uses. */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-[1180px] px-6 py-24 sm:py-28">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-white/50">
              {t('originEyebrow')}
            </p>
            <h2 className="tf-display mt-5 max-w-[18ch] text-[clamp(32px,5.5vw,64px)] leading-[0.94]">
              {t('originHead')}
            </h2>
            <div className="mt-12 grid gap-8 border-t border-white/15 pt-10 sm:grid-cols-2 sm:gap-14">
              <p className="text-[16px] leading-[1.75] text-white/70">{t('originA')}</p>
              <p className="text-[16px] leading-[1.75] text-white/70">{t('originB')}</p>
            </div>
          </div>
        </section>

        {/* Differences. A definition list, which is answer-shaped and liftable. */}
        <section className="mx-auto max-w-[1180px] px-6 py-20 sm:py-28">
          <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
            {t('diffEyebrow')}
          </p>
          <h2 className="tf-display mt-5 max-w-[16ch] text-[clamp(32px,5.5vw,60px)] leading-[0.94]">
            {t('diffHead')}
          </h2>
          <dl className="mt-12 flex flex-col">
            {diffs.map((d) => (
              <div
                key={d.t}
                className="grid gap-3 border-t border-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[0.85fr_1.15fr] sm:gap-10"
              >
                <dt className="text-[19px] font-semibold leading-snug sm:text-[21px]">{d.t}</dt>
                <dd className="max-w-[62ch] text-[15px] leading-[1.7] text-soft">{d.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Audience + the real numbers. */}
        <section className="border-y border-line bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 py-20 sm:py-24">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
              {t('whoEyebrow')}
            </p>
            <h2 className="tf-display mt-5 max-w-[16ch] text-[clamp(30px,5vw,58px)] leading-[0.94]">
              {t('whoHeadA')}
              <br />
              <span className="text-faint">{t('whoHeadB')}</span>
            </h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col gap-5">
                <p className="max-w-[58ch] text-[16px] leading-[1.75] text-soft">{t('whoA')}</p>
                <p className="max-w-[58ch] text-[16px] leading-[1.75] text-soft">{t('whoB')}</p>
              </div>
              <div className="grid gap-8 sm:grid-cols-3 lg:gap-6">
                {stats.map((s) => (
                  <div key={s.l}>
                    <div className="tf-display text-[clamp(34px,5vw,56px)] leading-[0.85]">{s.n}</div>
                    {/* text-soft, not text-faint: faint fails 4.5:1 on the cream ground. */}
                    <div className="mt-3 text-[12px] uppercase tracking-[1.5px] text-soft">
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-[1180px] px-6 py-24 text-center sm:py-28">
            <h2 className="tf-display text-[clamp(38px,8vw,92px)] leading-[0.88]">
              {t('ctaHead')}
            </h2>
            <p className="mx-auto mt-7 max-w-xl text-[16px] leading-[1.7] text-white/70">
              {t('ctaBody')}
            </p>
            <Link
              href="/join"
              className="tf-press mt-10 inline-block bg-white px-10 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-ink"
            >
              {t('ctaButton')}
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
