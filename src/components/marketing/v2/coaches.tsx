// Thick & Fit landing: the membership levels and the closing CTA.
import type { ReactElement } from 'react';

import { LBody, LCta, LH2, LSection } from '@/components/marketing/v2/ui';

type Tier = { name: string; price: string; blurb: string; img: string };

const TIERS: readonly Tier[] = [
  {
    name: 'Foundation',
    price: '$19.97 / mo',
    blurb:
      'Build consistency. The full system: your training, your fuel, and your evolution tracked in one place.',
    img: '/brand/shoot/cable.avif',
  },
  {
    name: 'Evolution',
    price: 'From $200 / mo',
    blurb:
      'The full transformation system, with her trained team adjusting it around you every week.',
    img: '/brand/shoot/deadlift.avif',
  },
  {
    name: 'Elite',
    price: '$3,000 / 3 mo',
    blurb: 'Maximum accountability, directly with Stephanie. Limited spots.',
    img: '/brand/shoot/bronco-pink.avif',
  },
];

/** The three membership levels. */
export function TierCards(): ReactElement {
  return (
    <LSection tone="dark">
      <LH2 className="mb-12 text-center">Choose how far you want to go.</LH2>
      <LBody className="mx-auto mb-12 max-w-[52ch] text-center text-[#bcbcbc]">
        Start anywhere. Move up whenever you are ready.
      </LBody>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <article key={tier.name} className="overflow-hidden rounded-xl bg-[#262626]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tier.img}
              alt={`Thick & Fit ${tier.name}`}
              className="aspect-[16/10] w-full object-cover object-[center_25%]"
            />
            <div className="p-6">
              <h3 className="text-[20px] font-extrabold uppercase leading-[1.1] text-white">
                {tier.name}
              </h3>
              <p className="text-[15px] font-bold text-[#ff2d55]">{tier.price}</p>
              <p className="mt-3 text-[14px] leading-snug text-[#bcbcbc]">{tier.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </LSection>
  );
}

/** The closing prompt that sits under the membership levels. */
export function FindPlan(): ReactElement {
  return (
    <LSection tone="raised">
      <div className="text-center">
        <LH2>This is the last time you start over.</LH2>
        <div className="mx-auto max-w-[52ch]">
          <LBody className="mx-auto mt-5 text-center text-[#bcbcbc]">
            Three days free. Cancel before it ends and you are not charged.
          </LBody>
        </div>
        <LCta className="mt-8" href="/join">
          Start your 3 days free
        </LCta>
      </div>
    </LSection>
  );
}
