// Thick & Fit landing: the founding-membership card and the closing CTA.
//
// Public offer surface = ONE card, Foundation founding pricing. Mid-ticket ("Evolution") and
// high-ticket ("Elite") are NOT pushed publicly at launch (2026-07-23 call): the waitlist quiz
// tags interested candidates and they get a private application + booking link post-launch.
// Removing them from the landing keeps the funnel focused on "one offer, five days to lock the
// founding price for life."
import type { ReactElement } from 'react';

import { getTranslations } from 'next-intl/server';

import { LBody, LCta, LH2, LSection } from '@/components/marketing/v2/ui';

/** The single founding offer. */
export async function TierCards(): Promise<ReactElement> {
  const t = await getTranslations('home.tiers');

  return (
    <LSection tone="dark">
      <LH2 className="mb-6 text-center">{t('heading')}</LH2>
      <LBody className="mx-auto mb-10 max-w-[60ch] text-center text-[#bcbcbc]">
        {t('subhead')}
      </LBody>

      {/* One centered card. Same visual language as the old grid; no responsive column-count so a
          single card looks intentional rather than "grid with holes." Image + copy + founding price. */}
      <article className="mx-auto max-w-[520px] overflow-hidden rounded-xl bg-[#262626]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/cable.avif"
          alt={t('cardAlt', { name: t('foundation.name') })}
          className="aspect-[16/10] w-full object-cover object-[center_25%]"
        />
        <div className="p-7">
          <h3 className="text-[24px] font-extrabold uppercase leading-[1.1] text-white">
            {t('foundation.name')}
          </h3>
          <p className="mt-1 text-[17px] font-bold text-[#ff2d55]">$19.97 / mo · founding</p>
          <p className="mt-4 text-[15px] leading-snug text-[#bcbcbc]">{t('foundation.blurb')}</p>
        </div>
      </article>
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
