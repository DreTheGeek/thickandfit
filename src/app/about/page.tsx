// About. The warm-follower conversion asset (per .planning/MARKETING-AUDIENCE.md): her story, the
// difference a member feels, who it is for, the real numbers, a soft CTA. Restyled onto the v2
// marketing shell (dark ground, crimson accent) with her own shoot photos; the copy stays in the
// bilingual about.* keys so this page is EN/ES already.
//
// LEGAL CAUTION PRESERVED from the prior version: this indexed page does NOT name or criticize the
// platform she is leaving, assert competitor fines, list private individuals, disclose the vendor
// roadmap/stack, or claim an unshipped feature as shipped. The "wound" is framed as "a platform she
// did not own, built for an audience it ignored" without naming it. Her credential is "certified
// personal trainer" (verified) - never "nutritionist"/"PN-certified" (she is not one, and the
// meal-plan disclaimer says the plans do not replace one).
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { LSection, LH2, LBody, LEyebrow } from '@/components/marketing/v2/ui';
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

export const dynamic = 'force-dynamic';

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

  // About is the entity surface: the page an answer engine reads to decide who Stephanie and
  // Thick & Fit are, so it carries the full identity graph rather than a product node.
  const nodes = [organizationNode(), personNode(), websiteNode(), breadcrumbNode([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ])].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* Hero: lead with her, per the research (creator trust converts on the person). */}
      <section className="relative isolate overflow-hidden bg-[#0e0e0e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/walk-white.avif"
          alt="Stephanie Pantoja"
          className="absolute inset-0 hidden h-full w-full object-cover object-[60%_18%] lg:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/walk-white.avif"
          alt="Stephanie Pantoja"
          className="absolute inset-0 h-full w-full object-cover object-[50%_15%] lg:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 lg:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(to_right,rgba(8,8,8,0.9)_0%,rgba(8,8,8,0.78)_40%,rgba(8,8,8,0.25)_75%,transparent_100%)]"
        />
        <div className="relative z-10 mx-auto flex min-h-[70svh] w-full max-w-[1200px] flex-col justify-end px-5 pb-16 pt-28 sm:px-8 lg:min-h-[78svh] lg:justify-center lg:py-28">
          <div className="max-w-[36ch]">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/55">
              {t('eyebrow')}
            </p>
            <h1 className="mt-4 text-[40px] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-white sm:text-[56px] lg:text-[64px]">
              {t('h1a')}
              <br />
              <span className="text-[#ff2d55]">{t('h1b')}</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.6] text-white/80 sm:text-[18px]">
              {t('intro')}
            </p>
          </div>
        </div>
      </section>

      {/* Origin / the wound */}
      <LSection tone="dark">
        <LEyebrow className="text-white/55">{t('originEyebrow')}</LEyebrow>
        <LH2 className="mt-4 max-w-[18ch] text-white">{t('originHead')}</LH2>
        <div className="mt-10 grid gap-8 border-t border-white/12 pt-10 sm:grid-cols-2 sm:gap-14">
          <LBody className="max-w-none text-[#bcbcbc]">{t('originA')}</LBody>
          <LBody className="max-w-none text-[#bcbcbc]">{t('originB')}</LBody>
        </div>
      </LSection>

      {/* The difference a member feels. A definition list: answer-shaped and liftable for AEO. */}
      <LSection tone="bone">
        <LEyebrow className="text-[#0e0e0e]">{t('diffEyebrow')}</LEyebrow>
        <LH2 className="mt-4 max-w-[16ch] text-[#0e0e0e]">{t('diffHead')}</LH2>
        <dl className="mt-10 flex flex-col">
          {diffs.map((d) => (
            <div
              key={d.t}
              className="grid gap-3 border-t border-black/10 py-8 first:border-t-0 first:pt-0 sm:grid-cols-[0.85fr_1.15fr] sm:gap-10"
            >
              <dt className="text-[19px] font-bold leading-snug text-[#0e0e0e] sm:text-[21px]">
                {d.t}
              </dt>
              <dd className="max-w-[62ch] text-[15px] leading-[1.7] text-[#4a4a4a]">{d.d}</dd>
            </div>
          ))}
        </dl>
      </LSection>

      {/* Who it is for + the real numbers, over a photo band. */}
      <LSection tone="dark">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <LEyebrow className="text-white/55">{t('whoEyebrow')}</LEyebrow>
            <LH2 className="mt-4 max-w-[16ch] text-white">
              {t('whoHeadA')} <span className="text-[#ff2d55]">{t('whoHeadB')}</span>
            </LH2>
            <LBody className="mt-6 max-w-none text-[#bcbcbc]">{t('whoA')}</LBody>
            <LBody className="mt-4 max-w-none text-[#bcbcbc]">{t('whoB')}</LBody>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/12 pt-8">
              {stats.map((s) => (
                <div key={s.l}>
                  <div className="text-[clamp(28px,4vw,44px)] font-extrabold leading-none text-white">
                    {s.n}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[1.4px] text-white/55">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/shoot/trust-process.avif"
            alt="Stephanie Pantoja"
            className="aspect-[4/5] w-full rounded-xl object-cover object-[center_20%]"
          />
        </div>
      </LSection>

      {/* CTA */}
      <LSection tone="raised">
        <div className="text-center">
          <LH2 className="text-white">{t('ctaHead')}</LH2>
          <LBody className="mx-auto mt-6 text-center text-[#bcbcbc]">{t('ctaBody')}</LBody>
          <div className="mt-8">
            <Link
              href="/join"
              className="inline-block rounded-full bg-[#ff2d55] px-9 py-4 text-[15px] font-bold uppercase tracking-[0.02em] text-white transition-opacity hover:opacity-90"
            >
              {t('ctaButton')}
            </Link>
          </div>
        </div>
      </LSection>
    </MarketingShell>
  );
}
