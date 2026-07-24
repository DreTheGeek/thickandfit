// Home. The v2 marketing direction, promoted from /preview/v2 to the canonical root after the
// client's call. The section grammar is photo-led (a full-bleed coach hero above the fold, one
// accent pill, real proof under it, then alternating dark and bone bands); all art, colour and
// copy are Thick & Fit's. This page is the base the rest of the marketing site (comparison, blog,
// about) is built on: the reusable pieces live in src/components/marketing/v2/.
//
// KNOWN GAP (intentional, shipped by owner decision): several section media slots are still labeled
// placeholder blocks (Fuel, Coach chat, Evolution, Today, program cards). They render as flat
// panels until real assets replace them. This is live to iterate on, not a finished launch page.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { AnnounceBar, SiteNav, Hero } from '@/components/marketing/v2/top';
import { BigWordmark, TheDifference, BusyPeople } from '@/components/marketing/v2/proof';
import { KnowExactly, SaveTime, LearnFromBest, TrackBlocks } from '@/components/marketing/v2/features';
import { TierCards, FindPlan } from '@/components/marketing/v2/coaches';
import { Testimonials, StartToday, Faq, SiteFooter } from '@/components/marketing/v2/social';
import { JsonLd } from '@/components/seo/json-ld';
import {
  graph,
  breadcrumbNode,
  organizationNode,
  personNode,
  softwareApplicationNode,
  type JsonLdNode,
} from '@/lib/seo/schema';
import { localeAlternates } from '@/lib/seo/locale-alternates';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing');
  const title = t('hero.h1');
  return {
    title: 'Thick & Fit',
    description: t('hero.sub'),
    // The homepage MUST be indexable. The prior page carried the same block; this keeps search and
    // social intact through the swap.
    alternates: await localeAlternates('/'),
    openGraph: {
      url: '/',
      title,
      description: t('hero.sub'),
      images: ['/assets/images/open-graph.jpg'],
    },
  };
}

export default async function Home(): Promise<ReactElement> {
  const t = await getTranslations('marketing');
  // Structured data carried over from the prior homepage so the Organization / Person /
  // SoftwareApplication knowledge-graph entries survive the redesign.
  const features = (t.raw('features') as { eyebrow: string }[]) ?? [];
  const nodes = [
    organizationNode(),
    personNode(),
    softwareApplicationNode({ priceUSD: '19.97', features: features.map((f) => f.eyebrow) }),
    breadcrumbNode([{ name: 'Home', path: '/' }]),
  ].filter((n): n is JsonLdNode => n !== null);

  return (
    <div className="min-h-screen bg-[#0e0e0e] antialiased">
      <JsonLd data={graph(nodes)} />
      <AnnounceBar />
      <SiteNav />
      <main>
        <Hero />
        <BigWordmark />
        <TheDifference />
        <BusyPeople />
        <KnowExactly />
        <SaveTime />
        <LearnFromBest />
        <TrackBlocks />
        <TierCards />
        <FindPlan />
        <Testimonials />
        <StartToday />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
