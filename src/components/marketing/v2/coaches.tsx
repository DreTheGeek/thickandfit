// Thick & Fit landing: the membership levels and the closing CTA.
import type { ReactElement } from 'react';

import { getTranslations } from 'next-intl/server';

import { LBody, LCta, LH2, LSection } from '@/components/marketing/v2/ui';

type Tier = { name: string; price: string; blurb: string; img: string };

/** The three membership levels. */
export async function TierCards(): Promise<ReactElement> {
  const t = await getTranslations('home.tiers');

  // Tier names are brand names (Foundation/Evolution/Elite): identical in every locale.
  const tiers: readonly Tier[] = [
    {
      name: t('foundation.name'),
      price: '$19.97 / mo',
      blurb: t('foundation.blurb'),
      img: '/brand/shoot/cable.avif',
    },
    {
      name: t('evolution.name'),
      price: 'From $200 / mo',
      blurb: t('evolution.blurb'),
      img: '/brand/shoot/deadlift.avif',
    },
    {
      name: t('elite.name'),
      price: '$3,000 / 3 mo',
      blurb: t('elite.blurb'),
      img: '/brand/shoot/bronco-pink.avif',
    },
  ];

  return (
    <LSection tone="dark">
      <LH2 className="mb-12 text-center">{t('heading')}</LH2>
      <LBody className="mx-auto mb-12 max-w-[52ch] text-center text-[#bcbcbc]">
        {t('subhead')}
      </LBody>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <article key={tier.name} className="overflow-hidden rounded-xl bg-[#262626]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tier.img}
              alt={t('cardAlt', { name: tier.name })}
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
export async function FindPlan(): Promise<ReactElement> {
  const t = await getTranslations('home.tiers');

  return (
    <LSection tone="raised">
      <div className="text-center">
        <LH2>{t('findPlanHeading')}</LH2>
        <div className="mx-auto max-w-[52ch]">
          <LBody className="mx-auto mt-5 text-center text-[#bcbcbc]">{t('reassure')}</LBody>
        </div>
        <LCta className="mt-8" href="/join">
          {t('cta')}
        </LCta>
      </div>
    </LSection>
  );
}
