// Public FAQ. This page is the AEO/GEO surface: answer engines (Google AI, ChatGPT, Perplexity,
// Gemini) lift a question and its answer verbatim, so each answer is a direct 2-4 sentence reply in
// Stephanie's voice, and the FAQPage JSON-LD mirrors EXACTLY what is rendered below (never more).
// Bilingual EN/ES from the `faq` namespace. Monochrome brand, no decorative green.
//
// CHROME: this page used to render bare, with no nav and no footer, so the only way out was the
// browser back button. That is worse here than anywhere else on the site: the FAQ is the page an
// answer engine drops a cold visitor onto, and it was a cul-de-sac. It now wraps in MarketingShell
// like /pricing and /about, which supplies the announcement bar, the nav (Pricing, FAQ, the
// language switch, Login) and the full footer, all locale-prefixed. The white ground stays: the
// shell owns the dark chrome, the page owns its own band.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { MarketingShell } from '@/components/marketing/v2/shell';
import { JsonLd } from '@/components/seo/json-ld';
import {
  graph,
  faqPageNode,
  breadcrumbNode,
  organizationNode,
  personNode,
  type JsonLdNode,
} from '@/lib/seo/schema';
import { localeAlternates } from '@/lib/seo/locale-alternates';

// The shell reads the request path to keep every link in the visitor's language, so this page is
// request-scoped. Declared for the same reason /pricing and /about declare it.
export const dynamic = 'force-dynamic';

type FaqItem = { q: string; a: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faq');
  const title = `${t('title')} | Thick & Fit`;
  return {
    title,
    description: t('subtitle'),
    alternates: await localeAlternates('/faq'),
    // A page-level openGraph replaces the parent's, so the image must be repeated here.
    openGraph: {
      url: '/faq',
      title,
      description: t('subtitle'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function FaqPage(): Promise<ReactElement> {
  const t = await getTranslations('faq');
  const items = t.raw('items') as FaqItem[];

  const nodes = [
    organizationNode(),
    personNode(), // Stephanie as a citable entity: the GEO/AIO play
    faqPageNode(items.map((i) => ({ question: i.q, answer: i.a }))),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: t('title'), path: '/faq' },
    ]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <MarketingShell>
      <JsonLd data={graph(nodes)} />

      {/* The shell renders the <main>, so this page opens on a <section>. Nesting a second <main>
          inside it would give the document two, which breaks the landmark for a screen reader. */}
      <section className="tf-light bg-white px-6 py-20 text-black sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="tf-eyebrow">{t('eyebrow')}</p>
          <h1 className="tf-display mt-3 text-5xl leading-[0.95] sm:text-6xl">{t('title')}</h1>
          <p className="mt-5 max-w-xl text-lg text-neutral-700">{t('subtitle')}</p>

          {/* Plain <details> so the answers are in the DOM on first paint: an answer engine (and a
              crawler) reads them without running JS. */}
          <div className="mt-12 border-t border-neutral-200">
            {items.map((item, i) => (
              <details key={i} className="tf-details group border-b border-neutral-200 py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                  <h2 className="text-lg font-semibold leading-snug sm:text-xl">{item.q}</h2>
                  <span
                    className="tf-details-chevron mt-1 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-700">
                  {item.a}
                </p>
              </details>
            ))}
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
        </div>
      </section>
    </MarketingShell>
  );
}
