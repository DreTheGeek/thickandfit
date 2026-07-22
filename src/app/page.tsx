// Home.
//
// Rebuilt against .planning/LANDING-REBUILD-SPEC.md. The previous version was a competent
// wireframe: thirteen sections each sitting in the same centred max-w-[1180px] box, every headline
// using the same two-tone trick (line one ink, line two grey), and app screenshots stacked into
// piles. Three things were wrong at the root, and all three are structural rather than cosmetic:
//
//   1. The centred container. Content floated in the middle of a fixed box while the viewport grew
//      around it, which is where the dead space came from. Replaced by "the thread": a 1px rule at
//      a fixed viewport x with every section hanging off it, no max width anywhere.
//   2. The grey second line. #757575 on cream reads as disabled text, not hierarchy, and it was the
//      only device on the page, repeated eight times. Replaced by four devices used in rotation,
//      with no two adjacent sections sharing one: rule break, knockout, scale step, ground
//      inversion. Grey is now confined to metadata under 20px.
//   3. The screenshots. Each source file is already a two or three phone composite with iOS chrome
//      baked into the raster, so no re-layout could fix them. They are now cropped into a constant
//      frame (the aperture) where no source edge is ever visible.
//
// The five client testimonials are no longer a block. They are interruptions between her sections,
// so her voice and theirs alternate, and they are set at full ink at nearly her body size because
// the entire trust argument is that the client outranks the marketing.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { Marquee } from '@/components/marketing/marquee';
import { StickyCta } from '@/components/marketing/sticky-cta';
import { ScrollStory, type StoryStep } from '@/components/marketing/scroll-story';
import { Section, Eyebrow, Aperture, Interruption } from '@/components/marketing/primitives';
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
import { isEsPath } from '@/i18n/request';

type Feature = { eyebrow: string; line1: string; line2: string; body: string };
type Stat = { n: string; l: string };
type Quote = { q: string; who: string };
type Step = { n: string; title: string; body: string };
type FaqItem = { q: string; a: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing');
  const title = `${t('hero.line1')} ${t('hero.accent')} ${t('hero.line2')}`.trim();
  return {
    title: 'Thick & Fit',
    description: t('hero.sub'),
    alternates: await localeAlternates('/'),
    openGraph: {
      url: '/',
      title,
      description: t('hero.sub'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

/** Aperture sources, in feature-row order. Row 5 deliberately has no image: the sequence needs a
 *  rest, and four assets cannot honestly fill five rows. It carries a numeral watermark instead. */
const PLATES = [
  { src: '/brand/img/app-1.avif', ratio: '4 / 5', pos: '50% 30%' },
  { src: '/brand/img/app-3.avif', ratio: '3 / 2', pos: '68% 50%' },
  { src: '/brand/img/app-3.avif', ratio: '4 / 5', pos: '12% 40%' },
  { src: '/brand/img/app-2.avif', ratio: '1 / 1', pos: '62% 45%' },
];

export default async function Home(): Promise<ReactElement> {
  const pathname = (await headers()).get('x-pathname');
  const t = await getTranslations('marketing');
  const tf = await getTranslations('faq');
  const features = t.raw('features') as Feature[];
  const stats = t.raw('proof.items') as Stat[];
  const storySteps = t.raw('story.steps') as StoryStep[];
  const ticker = t.raw('ticker') as string[];
  const problemPoints = t.raw('problem.points') as string[];
  const problemEs = t.raw('problemEs') as string[];
  const quotes = t.raw('testimonials.items') as Quote[];
  const aboutParas = t.raw('about.paras') as string[];
  const steps = t.raw('process.steps') as Step[];
  const captions = t.raw('captions') as string[];
  const faqItems = (tf.raw('items') as FaqItem[]).slice(0, 4);
  const lp = (target: string): string => withLocalePrefix(pathname, target);
  const otherLang = isEsPath(pathname) ? 'en' : 'es';
  // Same markup, two art directions, so they can be compared as real pages rather than as
  // adjectives. /preview/dark is noindexed and exists only for that decision.
  const variant = pathname?.startsWith('/preview/dark') ? 'tf-dark' : 'tf-light';

  const nodes = [
    organizationNode(),
    personNode(),
    softwareApplicationNode({ priceUSD: '19.97', features: features.map((f) => f.eyebrow) }),
    breadcrumbNode([{ name: 'Home', path: '/' }]),
  ].filter((n): n is JsonLdNode => n !== null);

  const cta = (
    <Link
      href="/join"
      className="tf-press inline-block bg-ink px-9 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-white"
    >
      {t('hero.cta')}
    </Link>
  );

  return (
    <div className={variant}>
      <JsonLd data={graph(nodes)} />
      <MarketingNav />

      <main>
        {/* 1. HERO. Device: rule break. Right side: the portrait, bleeding off the edge. */}
        <Section ground="cream" beat="bleed" className="pt-[var(--beat-tight)] pb-[var(--beat-normal)]">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,56vw)_minmax(0,1fr)] lg:gap-12">
            <div className="flex flex-col">
              <h1 className="tf-mega max-w-[16ch]">
                {t('hero.line1')}
                <br />
                {t('hero.accent')}
                <br />
                {t('hero.line2')}
              </h1>
              <hr className="my-7 border-0 border-t border-line" />
              <p className="max-w-[34ch] text-[17px] leading-[1.68] sm:max-w-[44ch]">
                {t('hero.sub')}
              </p>
              {/* Stays high in the DOM, because the first 200 words are what an answer engine
                  reads, but drops below the CTA on phones so the button stays inside the fold. */}
              <p className="order-1 mt-6 max-w-[34ch] text-[15px] leading-[1.6] text-soft sm:order-none sm:mt-4 sm:max-w-[44ch]">
                {t('hero.definition')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                {cta}
                <p className="text-[13px] leading-snug text-soft">
                  <span className="font-semibold text-ink">{stats[0]?.n}</span> {stats[0]?.l}
                </p>
              </div>
            </div>
            {/* Bleeds past the right gutter and is clipped by the viewport: a shape the layout cuts
                cannot look accidental. */}
            <div className="mr-[calc(var(--gutter)*-1)] hidden lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
              <img
                src="/brand/img/steph-about.avif"
                alt={t('hero.alt')}
                fetchPriority="high"
                className="h-[74svh] w-full max-w-none object-cover object-[30%_center]"
              />
            </div>
          </div>
          {/* Mobile portrait: full bleed under the fold, never competing with the headline. */}
          <div className="mt-10 ml-[calc((var(--thread-x)_+_var(--thread-gap))*-1)] mr-[calc(var(--gutter)*-1)] lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
            <img
              src="/brand/img/steph-about.avif"
              alt={t('hero.alt')}
              fetchPriority="high"
              className="h-[52svh] w-full object-cover object-[30%_20%]"
            />
          </div>
        </Section>

        {/* 2. TICKER. The only full-bleed thin band, and the only place both languages appear at
            identical size and fill. */}
        <Marquee items={ticker} />

        {/* 3. INTERRUPTION. Zakeya first, on purpose: her quote is about having stopped taking
            progress photos, which is the reader's actual emotional state at second five. */}
        {quotes[4] ? <Interruption quote={quotes[4].q} who={quotes[4].who} ground="cream" /> : null}

        {/* 4. PROBLEM. Ink. Right side carries the same indictment in the other language at the same
            size, not as a caption. The points indict the industry, never the reader. */}
        <Section ground="ink" beat="normal">
          <Eyebrow label={t('problem.eyebrow')} ground="ink" />
          <h2 className="tf-loud max-w-[14ch]">
            {t('problem.line1')}
            <br />
            {t('problem.line2')}
          </h2>
          <hr className="my-10 border-0 border-t border-white/15" />
          <div className="grid gap-x-12 gap-y-7 lg:grid-cols-2">
            <div className="flex flex-col gap-7">
              {problemPoints.map((p) => (
                <p key={p} className="max-w-[44ch] text-[17px] leading-[1.7] text-white/80">
                  {p}
                </p>
              ))}
            </div>
            {/* The other language, at the same size and weight. lang is set correctly so screen
                readers and translation tools switch voice on this column. */}
            <div className="flex flex-col gap-7" lang={otherLang}>
              {problemEs.map((p) => (
                <p key={p} className="max-w-[44ch] text-[17px] leading-[1.7] text-white/80">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </Section>

        {/* 5. COMMITMENT. Device: scale step. Tight above, open below, so it reads as her pausing.
            The only section allowed to be mostly air, which it earns by sitting between two dense
            ones. */}
        <Section ground="cream" beat="tight" className="pb-[var(--beat-open)]">
          <h2 className="tf-mid max-w-[20ch]">
            {t('commit.line1')}
            <br />
            <span className="tf-loud block">{t('commit.accent')}</span>
          </h2>
        </Section>

        {/* 6. INTERRUPTION. The first white ground on the page, which reads as a page turn. */}
        {quotes[0] ? <Interruption quote={quotes[0].q} who={quotes[0].who} ground="white" /> : null}

        {/* 7. STATS. Not a row. Three numbers down the thread at three different scales, with 256
            the largest thing on the page: the argument that one-to-one coaching is the product is
            made purely in type size. */}
        <Section ground="cream" beat="normal">
          <div className="flex flex-col">
            <div>
              <div className="tf-stat">{stats[1]?.n}</div>
              <div className="mt-2 max-w-[22ch] text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
                {stats[1]?.l}
              </div>
            </div>
            <div className="mt-[88px]">
              <div className="tf-loud">{stats[0]?.n}</div>
              <div className="mt-2 max-w-[22ch] text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
                {stats[0]?.l}
              </div>
            </div>
            <div className="mt-10">
              <div className="tf-mid">{stats[2]?.n}</div>
              <div className="mt-2 max-w-[22ch] text-[11px] font-semibold uppercase tracking-[0.2em] text-soft">
                {stats[2]?.l}
              </div>
            </div>
          </div>
        </Section>

        {/* 8. A WEEK WITH ME. The one pinned section on the page. */}
        <ScrollStory
          eyebrow={t('story.eyebrow')}
          line1={t('story.line1')}
          line2={t('story.line2')}
          steps={storySteps}
          images={[
            '/brand/img/app-1.avif',
            '/brand/img/app-3.avif',
            '/brand/img/app-2.avif',
            '/brand/img/app-4.avif',
          ]}
        />

        {/* 9. INTERRUPTION. Emphasis as a structural event: the thread itself widens for the height
            of this quote instead of an ornament being added beside it. */}
        {quotes[2] ? (
          <Interruption quote={quotes[2].q} who={quotes[2].who} ground="cream" emphasis />
        ) : null}

        {/* 10. FEATURE ROWS. Grounds cycle so five rows do not read as five identical boxes. One
            aperture per row, never two in a viewport, and row 5 gets a numeral watermark instead of
            a fifth image. */}
        {features.map((f, i) => {
          const ground = (['cream', 'white', 'cream', 'white', 'ink'] as const)[i];
          const plate = PLATES[i];
          const reverse = i % 2 === 1;
          return (
            <Section key={f.eyebrow} ground={ground} beat="normal">
              <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                {/* Row 5: the feature numeral as a watermark behind the text. Numbering without a
                    "how it works 1-2-3" grid. */}
                {!plate ? (
                  <span
                    aria-hidden="true"
                    className="tf-stat pointer-events-none absolute -left-2 -top-6 select-none opacity-[0.14]"
                    style={{ color: ground === 'ink' ? 'var(--c-bg)' : 'var(--c-ink)' }}
                  >
                    0{i + 1}
                  </span>
                ) : null}
                <div className={`relative ${reverse ? 'lg:order-2' : ''}`}>
                  <Eyebrow label={f.eyebrow} ground={ground} />
                  <h3 className="tf-mid max-w-[18ch]">
                    {f.line1}{' '}
                    {i % 2 === 0 ? (
                      <span className="tf-knock">{f.line2}</span>
                    ) : (
                      <span className="block">{f.line2}</span>
                    )}
                  </h3>
                  <p
                    className={`mt-7 max-w-[44ch] text-[17px] leading-[1.68] ${
                      ground === 'ink' ? 'text-white/80' : 'text-ink'
                    }`}
                  >
                    {f.body}
                  </p>
                </div>
                {plate ? (
                  <div className={reverse ? 'lg:order-1' : ''}>
                    <Aperture
                      src={plate.src}
                      alt={f.eyebrow}
                      caption={captions[i] ?? ''}
                      ratio={plate.ratio}
                      position={plate.pos}
                      bleed={i === 0 ? 'right' : i === 3 ? 'left' : undefined}
                    />
                  </div>
                ) : null}
              </div>
            </Section>
          );
        })}

        {/* 11. INTERRUPTION. The only testimonial on ink. */}
        {quotes[1] ? <Interruption quote={quotes[1].q} who={quotes[1].who} ground="ink" /> : null}

        {/* 12. ORIGIN STORY. Cream, not ink: this is the warmest beat on the page and ink is cold.
            Her portrait bleeds off the LEFT, past the thread, with a hard ink edge so the baked-in
            grey backdrop reads as a photographic print laid on the page rather than as a defect. */}
        <Section ground="cream" beat="open">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="ml-[calc((var(--thread-x)_+_var(--thread-gap))*-1)] lg:ml-[calc((var(--thread-x)_+_var(--thread-gap))*-1)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
              <img
                src="/brand/img/steph-hero.avif"
                alt={t('hero.alt')}
                loading="lazy"
                className="w-full border-y border-r border-ink object-cover"
              />
            </div>
            <div>
              <Eyebrow label={t('testimonials.eyebrow')} />
              <h2 className="tf-mid max-w-[18ch]">{t('commit.line1')}</h2>
              <div className="mt-8 flex flex-col gap-6">
                {aboutParas.map((p) => (
                  <p key={p.slice(0, 24)} className="max-w-[44ch] text-[17px] leading-[1.68]">
                    {p}
                  </p>
                ))}
              </div>
              <p className="tf-mid mt-10 max-w-[16ch]">{t('about.pull')}</p>
            </div>
          </div>
        </Section>

        {/* 13. BILINGUAL. Symmetry is the device: both languages at the same size, same weight,
            neither subordinate. */}
        <Section ground="white" beat="tight">
          <Eyebrow label={t('bilingual.eyebrow')} />
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <h2 className="tf-mid max-w-[16ch]">
              {t('bilingual.line1')} {t('bilingual.line2')}
            </h2>
            <p className="max-w-[44ch] text-[17px] leading-[1.68]">{t('bilingual.body')}</p>
          </div>
        </Section>

        {/* 14. INTERRUPTION. The longest quote gets the most room. Last emotional beat before the
            ask. */}
        {quotes[3] ? <Interruption quote={quotes[3].q} who={quotes[3].who} ground="cream" /> : null}

        {/* 15. PROCESS. Numeral watermark again, no circles, no badges, no connecting line. */}
        <Section ground="white" beat="normal">
          <Eyebrow label={t('process.eyebrow')} />
          <h2 className="tf-mid max-w-[16ch]">
            {t('process.line1')} {t('process.line2')}
          </h2>
          <ol className="mt-12 flex flex-col">
            {steps.map((s) => (
              <li key={s.n} className="relative border-t border-line py-9 first:border-t-0 first:pt-0">
                <span
                  aria-hidden="true"
                  className="tf-loud pointer-events-none absolute -top-2 left-0 select-none text-line"
                >
                  {s.n}
                </span>
                <div className="relative lg:pl-[18%]">
                  <h3 className="text-[20px] font-semibold sm:text-[22px]">{s.title}</h3>
                  <p className="mt-3 max-w-[52ch] text-[16px] leading-[1.68]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* 16. PRICING TEASER. The cancellation line is the second most legible thing here, at 17px
            full ink rather than fine print. Billing distrust is the category failure this product
            exists to fix, and setting the terms as micro-copy under a big number is the visual
            grammar of exactly the apps that burned her. */}
        <Section ground="cream" beat="tight">
          <Eyebrow label={t('pricingTeaser.eyebrow')} />
          <h2 className="tf-loud max-w-[14ch]">
            {t('pricingTeaser.line1')}
            <br />
            {t('pricingTeaser.line2')}
          </h2>
          <p className="mt-8 max-w-[44ch] text-[17px] font-medium leading-[1.6]">
            {t('pricingTeaser.cancelLine')}
          </p>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.68] text-soft">
            {t('pricingTeaser.body')}
          </p>
          <Link
            href={lp('/pricing')}
            className="tf-press mt-8 inline-block border border-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink"
          >
            {t('pricingTeaser.cta')}
          </Link>
        </Section>

        {/* 17. FAQ. Native details, all open, zero JS, fully in the RSC payload and fully indexable.
            Hiding the answers that reduce fear is the wrong trade. */}
        <Section ground="white" beat="normal">
          <Eyebrow label={t('faqTeaser.eyebrow')} />
          <h2 className="tf-mid max-w-[16ch]">
            {t('faqTeaser.line1')} {t('faqTeaser.line2')}
          </h2>
          <dl className="mt-12 flex flex-col">
            {faqItems.map((item) => (
              <div key={item.q} className="border-t border-line py-8 first:border-t-0 first:pt-0">
                <dt className="text-[17px] font-semibold">{item.q}</dt>
                <dd className="mt-3 max-w-[52ch] text-[16px] leading-[1.68]">{item.a}</dd>
              </div>
            ))}
          </dl>
          <Link
            href={lp('/faq')}
            className="tf-press mt-8 inline-block border border-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink"
          >
            {t('faqTeaser.cta')}
          </Link>
        </Section>

        {/* 18. CLOSING. The only centred element on the entire page, which is why it lands. Her
            portrait returns bottom-anchored, in colour, never mirrored. */}
        <section className="tf-ground-ink tf-on-ink relative overflow-hidden bg-ink text-white">
          <div className="relative z-10 px-[var(--gutter)] py-[var(--beat-open)] text-center">
            <span
              aria-hidden="true"
              className="mx-auto mb-10 block h-[9px] w-[9px] rounded-full bg-white/40"
            />
            <h2 className="tf-mega mx-auto max-w-[16ch]">
              {t('closing.line1')}
              <br />
              {t('closing.line2')}
              <br />
              {t('closing.line3')}
            </h2>
            <div className="mt-12">
              <Link
                href="/join"
                className="tf-press inline-block bg-white px-10 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink"
              >
                {t('closing.cta')}
              </Link>
            </div>
            <p className="mt-6 text-[15px] text-white/70">{t('closing.motto')}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
          <img
            src="/brand/img/steph-footer.avif"
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="pointer-events-none absolute -bottom-4 right-0 hidden h-[62%] w-auto object-contain opacity-90 lg:block"
          />
        </section>
      </main>

      <MarketingFooter />
      <StickyCta label={t('stickyCta')} />
    </div>
  );
}
