// Home. Full native rebuild that retires the lifted Webflow blob (which needed scoped Webflow CSS,
// !important nav hacks, and injected body scripts, and only showed the native showcase at >=lg).
//
// The visual language is deliberately KEPT from the coaching showcase, because that is the look
// Stephanie signed off on: bg-ink rounded icon badge + letter-spaced eyebrow, two-tone tf-display
// headline (solid line over a text-faint line), her first-person copy at leading-[1.7], and
// alternating rows with overlapping phone screenshots on white. Everything else is rebuilt:
// responsive from 320px up (no more mobile-Webflow / desktop-native split), fully bilingual EN/ES,
// and carrying real schema for the answer engines.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/ui/icons';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { JsonLd } from '@/components/seo/json-ld';
import {
  graph,
  breadcrumbNode,
  organizationNode,
  personNode,
  softwareApplicationNode,
  type JsonLdNode,
} from '@/lib/seo/schema';

type Feature = {
  eyebrow: string;
  icon: string;
  line1: string;
  line2: string;
  body: string;
  imgs: [string, string];
};
type Stat = { n: string; l: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing');
  const title = `${t('hero.line1')} ${t('hero.accent')} ${t('hero.line2')}`.trim();
  return {
    title: 'Thick & Fit',
    description: t('hero.sub'),
    alternates: { canonical: '/' },
    openGraph: {
      url: '/',
      title,
      description: t('hero.sub'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

/** The kept pattern: icon badge + letter-spaced eyebrow. */
function Eyebrow({ icon, label }: { icon: IconName; label: string }): ReactElement {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
        <Icon name={icon} size={18} />
      </span>
      <span className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">{label}</span>
    </div>
  );
}

/** Overlapping phone screenshots. Percentage widths so the cluster scales instead of being
 *  desktop-only like the original. */
function Phones({ imgs, alt }: { imgs: [string, string]; alt: string }): ReactElement {
  return (
    <div className="relative mx-auto h-[320px] w-full max-w-[320px] sm:h-[400px] sm:max-w-[400px] lg:h-[460px] lg:max-w-[460px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static marketing screenshot */}
      <img
        src={imgs[1]}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute right-0 top-8 w-[52%] rounded-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static marketing screenshot */}
      <img
        src={imgs[0]}
        alt={alt}
        loading="lazy"
        className="absolute left-1 top-0 w-[56%] rounded-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
      />
    </div>
  );
}

export default async function Home(): Promise<ReactElement> {
  const t = await getTranslations('marketing');
  const features = t.raw('features') as Feature[];
  const stats = t.raw('proof.items') as Stat[];
  const pills = t.raw('closing.pills') as string[];

  const nodes = [
    organizationNode(),
    personNode(),
    // The pricing teaser below visibly states the entry price, so the Offer is accurate.
    softwareApplicationNode({ priceUSD: '19.97', features: features.map((f) => f.eyebrow) }),
    breadcrumbNode([{ name: 'Home', path: '/' }]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <>
      <JsonLd data={graph(nodes)} />
      <MarketingNav />

      <main className="bg-white text-ink">
        {/* Hero */}
        <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 sm:pt-20 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="tf-display text-[clamp(40px,8.5vw,76px)] leading-[0.92]">
                {t('hero.line1')}
                <br />
                <span className="text-faint">
                  {t('hero.accent')} {t('hero.line2')}
                </span>
              </h1>
              <p className="mt-6 max-w-[480px] text-[16px] leading-[1.7] text-soft sm:text-[17px]">
                {t('hero.sub')}
              </p>
              <Link
                href="/join"
                className="tf-press mt-9 inline-block bg-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
              >
                {t('hero.cta')}
              </Link>
            </div>
            <div className="order-first lg:order-last">
              {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
              <img
                src="/assets/images/5497dd683b36.avif"
                alt={t('hero.alt')}
                className="mx-auto w-full max-w-[440px] rounded-[26px] object-cover shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              />
            </div>
          </div>
        </section>

        {/* Proof. Fitness is trust-heavy, so the real numbers come early. */}
        <section className="border-y border-neutral-200 bg-white">
          <div className="mx-auto grid max-w-[1180px] gap-8 px-6 py-12 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.l}>
                <div className="tf-display text-[clamp(32px,4vw,48px)] leading-none">{s.n}</div>
                <div className="mt-2 text-[13px] uppercase tracking-[1.5px] text-faint">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Commitment beat */}
        <section className="mx-auto max-w-[1180px] px-6 py-20 text-center sm:py-28">
          <h2 className="tf-display mx-auto max-w-4xl text-[clamp(34px,5.5vw,68px)] leading-[0.94]">
            {t('commit.line1')}
            <br />
            <span className="text-faint">{t('commit.accent')}</span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-[1.7] text-soft">
            {t('commit.body')}
          </p>
        </section>

        {/* Feature pillars: the kept alternating rows, now responsive. */}
        <section className="mx-auto max-w-[1180px] px-6 pb-8">
          <div className="flex flex-col gap-20 lg:gap-28">
            {features.map((f, i) => {
              const reverse = i % 2 === 1;
              return (
                <div key={f.eyebrow} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={reverse ? 'lg:order-2' : ''}>
                    <Eyebrow icon={f.icon as IconName} label={f.eyebrow} />
                    <h3 className="tf-display text-[clamp(30px,5.5vw,52px)] leading-[0.95]">
                      {f.line1}
                      <br />
                      <span className="text-faint">{f.line2}</span>
                    </h3>
                    <p className="mt-6 max-w-[460px] text-[16px] leading-[1.7] text-soft">{f.body}</p>
                  </div>
                  <div className={reverse ? 'lg:order-1' : ''}>
                    <Phones imgs={f.imgs} alt={f.eyebrow} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bilingual wedge: the thing no incumbent actually does on both sides. */}
        <section className="mt-20 border-y border-neutral-200 bg-[#f7f6f3]">
          <div className="mx-auto max-w-[1180px] px-6 py-20 text-center sm:py-24">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
              {t('bilingual.eyebrow')}
            </p>
            <h2 className="tf-display mx-auto mt-5 max-w-3xl text-[clamp(32px,5vw,60px)] leading-[0.94]">
              {t('bilingual.line1')}
              <br />
              <span className="text-faint">{t('bilingual.line2')}</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-[1.7] text-soft">
              {t('bilingual.body')}
            </p>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto max-w-[1180px] px-6 py-20 sm:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
                {t('pricingTeaser.eyebrow')}
              </p>
              <h2 className="tf-display mt-5 text-[clamp(32px,5vw,58px)] leading-[0.94]">
                {t('pricingTeaser.line1')}
                <br />
                <span className="text-faint">{t('pricingTeaser.line2')}</span>
              </h2>
            </div>
            <div>
              <p className="max-w-[460px] text-[16px] leading-[1.7] text-soft">
                {t('pricingTeaser.body')}
              </p>
              <Link
                href="/pricing"
                className="tf-press mt-7 inline-block border border-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-ink"
              >
                {t('pricingTeaser.cta')}
              </Link>
            </div>
          </div>
        </section>

        {/* Closing CTA: the kept oversized statement + pills. */}
        <section className="mx-auto max-w-[1180px] px-6 pb-28 text-center">
          <h2 className="tf-display text-[clamp(40px,8vw,92px)] leading-[0.9]">
            {t('closing.line1')}
            <br />
            <span className="text-faint">{t('closing.line2')}</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {pills.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-5 py-3 text-[13px] font-semibold uppercase tracking-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:px-6 sm:py-3.5 sm:text-[14px]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
                  <Icon name="check" size={14} strokeWidth={2.6} />
                </span>
                {p}
              </span>
            ))}
          </div>
          <Link
            href="/join"
            className="tf-press mt-12 inline-block bg-ink px-10 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
          >
            {t('closing.cta')}
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
