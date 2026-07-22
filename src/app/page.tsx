// Home. This is a marketing page, not a product brochure, and the section order is the point:
// it follows the conversion rhythm (problem, outcome, mechanism, proof, offer, objections, CTA)
// instead of walking through the feature list. The earlier version of this file dropped the parts
// that actually sell (the client testimonials, her story, the process, the on-page objections) and
// leaned on recycled app screenshots. Those are all restored here from her real copy.
//
// Three things are deliberately kept, because Stephanie signed off on them: the ink icon badge with
// the letter-spaced eyebrow, the two-tone tf-display headline (solid line over a text-faint line),
// and the alternating feature rows with overlapping phones.
//
// Everything else follows the doctrine: committed monochrome (warm cream, ink, white, never a
// decorative green), alternating light and dark section grounds so the scroll has texture, a ticker
// strip, enormous staggered stat numbers instead of a neat three-column row, and one CTA action
// repeated down the page (start your journey) with proof sitting next to it every time.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/ui/icons';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { Marquee } from '@/components/marketing/marquee';
import { StickyCta } from '@/components/marketing/sticky-cta';
import { ScrollStory, type StoryStep } from '@/components/marketing/scroll-story';
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

type Feature = {
  eyebrow: string;
  icon: string;
  line1: string;
  line2: string;
  body: string;
  img: string;
  focus: string;
};
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

/** The kept pattern: ink icon badge plus letter-spaced eyebrow. */
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

/** One app screenshot per row.
 *
 *  This used to overlap TWO source files at different scales. The mistake: each of those files is
 *  ALREADY a composite of two or three phones with its own shadows and arrangement. Stacking two of
 *  them produced five or six phones in a pile, cropped by the section edge, which read as a broken
 *  layout rather than a designed cluster. One composite, shown whole, is the fix.
 *
 *  Two rows share a source file, so `focus` picks a different phone out of the same composite
 *  instead of showing the identical image twice. */
function Shot({ src, focus, alt }: { src: string; focus: string; alt: string }): ReactElement {
  const position =
    focus === 'left' ? 'object-left' : focus === 'right' ? 'object-right' : 'object-center';
  return (
    <div className="mx-auto w-full max-w-[560px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static marketing screenshot */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-[300px] w-full object-contain sm:h-[380px] lg:h-[440px] ${position}`}
      />
    </div>
  );
}

/** Testimonial card. No stock faces: these are real women who did not sign photo releases for a
 *  website, so the attribution is an initial monogram plus the name exactly as she published it. */
function Testimonial({ item, large = false }: { item: Quote; large?: boolean }): ReactElement {
  return (
    <figure className="mb-5 break-inside-avoid rounded-2xl bg-white p-7 shadow-[0_2px_16px_rgba(0,0,0,0.05)] sm:p-8">
      <blockquote
        className={`text-soft ${large ? 'text-[19px] leading-[1.6] sm:text-[22px]' : 'text-[15px] leading-[1.7]'}`}
      >
        {item.q}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-white">
          {item.who.slice(0, 1)}
        </span>
        <span className="text-[14px] font-semibold text-ink">{item.who}</span>
      </figcaption>
    </figure>
  );
}

export default async function Home(): Promise<ReactElement> {
  const headers_pathname = (await headers()).get('x-pathname');
  const t = await getTranslations('marketing');
  const tf = await getTranslations('faq');
  const features = t.raw('features') as Feature[];
  const stats = t.raw('proof.items') as Stat[];
  const pills = t.raw('closing.pills') as string[];
  const storySteps = t.raw('story.steps') as StoryStep[];
  const ticker = t.raw('ticker') as string[];
  const problemPoints = t.raw('problem.points') as string[];
  const quotes = t.raw('testimonials.items') as Quote[];
  const aboutParas = t.raw('about.paras') as string[];
  const steps = t.raw('process.steps') as Step[];
  const faqItems = (tf.raw('items') as FaqItem[]).slice(0, 4);
  // Keep the in-page CTAs in the reader's language: on /es these must go to /es/faq and
  // /es/pricing, not bounce back to the English canonical URLs.
  const lp = (target: string): string => withLocalePrefix(headers_pathname, target);

  const nodes = [
    organizationNode(),
    personNode(),
    // The pricing teaser below visibly states the entry price, so the Offer matches the page.
    softwareApplicationNode({ priceUSD: '19.97', features: features.map((f) => f.eyebrow) }),
    breadcrumbNode([{ name: 'Home', path: '/' }]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <div className="tf-light">
      <JsonLd data={graph(nodes)} />
      <MarketingNav />

      <main className="bg-white text-ink">
        {/* Hero on warm cream, so the page does not open on the same white as every other app site.
            Above the fold, in weight order: outcome headline, the mechanism sentence, one proof
            line, one CTA. */}
        <section className="bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 sm:pt-20 lg:pb-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div>
                <h1 className="tf-display text-[clamp(44px,9vw,84px)] leading-[0.9]">
                  {t('hero.line1')}
                  <br />
                  <span className="text-faint">
                    {t('hero.accent')} {t('hero.line2')}
                  </span>
                </h1>
                <p className="mt-6 max-w-[480px] text-[16px] leading-[1.7] text-soft sm:text-[17px]">
                  {t('hero.sub')}
                </p>
                {/* The plain "what this is" line. The headline and the sub above sell the vision,
                    which is right, but a visitor landing cold from Instagram, and an answer engine
                    reading the first 200 words, both need one factual sentence that names the
                    product, the coach, and the bilingual promise. Kept visually quiet on purpose. */}
                <p className="mt-4 max-w-[470px] text-[14px] leading-[1.6] text-soft">
                  {t('hero.definition')}
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link
                    href="/join"
                    className="tf-press inline-block bg-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
                  >
                    {t('hero.cta')}
                  </Link>
                  {/* Proof above the fold. Unproven claims up here read as an ad. */}
                  <p className="text-[13px] leading-snug text-soft">
                    <span className="font-semibold text-ink">{stats[0]?.n}</span> {stats[0]?.l}
                    <br />
                    <span className="font-semibold text-ink">{stats[1]?.n}</span> {stats[1]?.l}
                  </p>
                </div>
              </div>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- static marketing photo */}
                <img
                  src="/assets/images/1ce2ccb19105.avif"
                  alt={t('hero.alt')}
                  className="mx-auto w-full max-w-[440px] rounded-[26px] object-cover shadow-[0_24px_70px_rgba(0,0,0,0.20)]"
                />
              </div>
            </div>
          </div>
        </section>

        <Marquee items={ticker} />

        {/* Problem, in her audience's words. The dark block is the emotional low point of the page,
            which is what makes the outcome sections after it land. */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-[1180px] px-6 py-24 sm:py-32">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-white/50">
              {t('problem.eyebrow')}
            </p>
            <h2 className="tf-display mt-5 max-w-[14ch] text-[clamp(38px,7.5vw,88px)] leading-[0.92]">
              {t('problem.line1')}
              <br />
              <span className="text-white/40">{t('problem.line2')}</span>
            </h2>
            <div className="mt-12 grid gap-8 border-t border-white/15 pt-10 sm:grid-cols-3">
              {problemPoints.map((p) => (
                <p key={p} className="text-[16px] leading-[1.7] text-white/70">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Commitment beat: the turn from the problem to the outcome. */}
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

        {/* Stats, staggered and oversized. A neat evenly-spaced row of three numbers reads as a
            template; offsetting them makes the eye travel and gives the numbers weight. */}
        <section className="border-y border-line bg-bg">
          <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-16 sm:grid-cols-3 sm:gap-6 sm:py-20">
            {stats.map((s, i) => (
              <div
                key={s.l}
                className={i === 1 ? 'sm:mt-14' : i === 2 ? 'sm:mt-7 sm:text-right' : ''}
              >
                <div className="tf-display text-[clamp(48px,9vw,104px)] leading-[0.82]">{s.n}</div>
                {/* text-soft, not text-faint: faint (#757575) clears 4.5:1 on white but only hits
                    3.7:1 on the cream ground, which fails for 12px labels. */}
                <div className="mt-3 max-w-[15ch] text-[12px] uppercase tracking-[1.5px] text-soft sm:inline-block">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mechanism part one: a week in the app, driven by scroll. */}
        <ScrollStory
          eyebrow={t('story.eyebrow')}
          line1={t('story.line1')}
          line2={t('story.line2')}
          steps={storySteps}
          images={[
            '/assets/images/bec132276dbc.avif',
            '/assets/images/ee8356541645.avif',
            '/assets/images/58b0bf9e4c9e.avif',
            '/assets/images/12847e8f578b.avif',
          ]}
        />

        {/* Mechanism part two: the kept alternating rows, now responsive down to 320px. */}
        <section className="mx-auto max-w-[1180px] px-6 pb-12">
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
                    <Shot src={f.img} focus={f.focus} alt={f.eyebrow} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Proof block. Her real client reviews, verbatim, never translated: these are their words,
            not ours. Masonry columns instead of a slider, so all five are readable at once and
            nothing important hides behind a control nobody clicks. */}
        <section className="mt-20 border-y border-line bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 py-20 sm:py-28">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
              {t('testimonials.eyebrow')}
            </p>
            <h2 className="tf-display mt-5 max-w-[16ch] text-[clamp(32px,5.5vw,64px)] leading-[0.94]">
              {t('testimonials.line1')}
              <br />
              <span className="text-faint">{t('testimonials.line2')}</span>
            </h2>

            {/* CSS multi-column masonry: the five reviews are wildly different lengths, and columns
                let them pack naturally instead of forcing five equal boxes with dead space. */}
            <div className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3">
              {quotes.map((qq, i) => (
                <Testimonial key={qq.who} item={qq} large={i === 0} />
              ))}
            </div>

            {/* One testimonial block, one CTA. The moment of belief is the moment to ask. */}
            <div className="mt-12 text-center">
              <Link
                href="/join"
                className="tf-press inline-block bg-ink px-10 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-white"
              >
                {t('hero.cta')}
              </Link>
            </div>
          </div>
        </section>

        {/* Her story. Typographic on ink, with the pull quote carrying the most weight on the page
            after the hero. No second photo here on purpose: it is her voice that sells this part. */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-[1180px] px-6 py-24 sm:py-32">
            <p className="text-[12px] font-semibold uppercase tracking-[2px] text-white/50">
              {t('about.eyebrow')}
            </p>
            <h2 className="tf-display mt-5 max-w-[15ch] text-[clamp(34px,6.5vw,76px)] leading-[0.92]">
              {t('about.line1')}
              <br />
              <span className="text-white/40">{t('about.line2')}</span>
            </h2>

            <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
              <div className="flex flex-col gap-6">
                {aboutParas.map((p) => (
                  <p key={p.slice(0, 24)} className="text-[16px] leading-[1.75] text-white/70">
                    {p}
                  </p>
                ))}
              </div>
              <div className="lg:pt-4">
                <p className="tf-display text-[clamp(26px,3.6vw,44px)] leading-[1.04]">
                  {t('about.pull')}
                </p>
                <p className="mt-8 text-[15px] text-white/50">{t('about.sign')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* The wedge no incumbent actually delivers on both sides. */}
        <section className="mx-auto max-w-[1180px] px-6 py-20 text-center sm:py-28">
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
        </section>

        {/* What happens next. Two real steps, not a decorative 1-2-3. */}
        <section className="border-y border-line bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 py-20 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
                  {t('process.eyebrow')}
                </p>
                <h2 className="tf-display mt-5 text-[clamp(30px,4.6vw,54px)] leading-[0.94]">
                  {t('process.line1')}
                  <br />
                  <span className="text-faint">{t('process.line2')}</span>
                </h2>
              </div>
              <ol className="flex flex-col">
                {steps.map((s) => (
                  <li
                    key={s.n}
                    className="flex gap-6 border-t border-line py-8 first:border-t-0 first:pt-0 sm:gap-10"
                  >
                    <span className="tf-display shrink-0 text-[clamp(28px,4vw,44px)] leading-none text-faint">
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-[19px] font-semibold sm:text-[21px]">{s.title}</h3>
                      <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.7] text-soft">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Offer. */}
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
                href={lp('/pricing')}
                className="tf-press mt-7 inline-block border border-ink px-8 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-ink"
              >
                {t('pricingTeaser.cta')}
              </Link>
            </div>
          </div>
        </section>

        {/* Objections, answered on the page. Nobody clicks through to an FAQ before they buy, and
            the full page at /faq carries the FAQPage schema so this does not duplicate it. */}
        <section className="border-y border-line bg-bg">
          <div className="mx-auto max-w-[1180px] px-6 py-20 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[2px] text-soft">
                  {t('faqTeaser.eyebrow')}
                </p>
                <h2 className="tf-display mt-5 text-[clamp(30px,4.6vw,54px)] leading-[0.94]">
                  {t('faqTeaser.line1')}
                  <br />
                  <span className="text-faint">{t('faqTeaser.line2')}</span>
                </h2>
                <Link
                  href={lp('/faq')}
                  className="tf-press mt-7 inline-block border border-ink px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[2px] text-ink"
                >
                  {t('faqTeaser.cta')}
                </Link>
              </div>
              <dl className="flex flex-col">
                {faqItems.map((item) => (
                  <div key={item.q} className="border-t border-line py-7 first:border-t-0 first:pt-0">
                    <dt className="text-[17px] font-semibold sm:text-[18px]">{item.q}</dt>
                    <dd className="mt-3 max-w-[62ch] text-[15px] leading-[1.7] text-soft">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Final CTA: the biggest type on the page, on the highest-contrast ground. */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-[1180px] px-6 py-24 text-center sm:py-32">
            <h2 className="tf-display text-[clamp(44px,10vw,120px)] leading-[0.86]">
              {t('closing.line1')}
              <br />
              <span className="text-white/40">{t('closing.line2')}</span>
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {pills.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-3 rounded-full border border-white/20 px-5 py-3 text-[13px] font-semibold uppercase tracking-[1px] sm:px-6 sm:py-3.5 sm:text-[14px]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink">
                    <Icon name="check" size={14} strokeWidth={2.6} />
                  </span>
                  {p}
                </span>
              ))}
            </div>
            <Link
              href="/join"
              className="tf-press mt-12 inline-block bg-white px-10 py-4 text-[12px] font-semibold uppercase tracking-[2px] text-ink"
            >
              {t('closing.cta')}
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <StickyCta label={t('stickyCta')} />
    </div>
  );
}
