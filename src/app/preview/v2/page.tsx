// Marketing page, direction v2. Structure follows the Ladder grammar the client selected: a
// full-bleed photograph of the coach above the fold, one accent pill, reassurance and real proof
// under it, then alternating dark and bone bands.
//
// All art, colour and copy are Thick & Fit's. Noindexed while it is still a preview.
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AnnounceBar, SiteNav, Hero } from '@/components/marketing/v2/top';
import { BigWordmark, TheDifference, BusyPeople } from '@/components/marketing/v2/proof';
import { KnowExactly, SaveTime, LearnFromBest, TrackBlocks } from '@/components/marketing/v2/features';
import { TierCards, FindPlan } from '@/components/marketing/v2/coaches';
import { Testimonials, FreeTrial, Faq, SiteFooter } from '@/components/marketing/v2/social';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Thick & Fit',
  robots: { index: false, follow: false },
};

export default function MarketingV2Page(): ReactElement {
  return (
    <div className="min-h-screen bg-[#0e0e0e] antialiased">
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
        <FreeTrial />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
