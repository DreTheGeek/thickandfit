// Feature bands for the Thick & Fit landing page (/preview/v2).
//
// Structure mirrors joinladder.com's feature-band layout. Every string is now our own copy and the
// accent is our crimson #ff2d55, not Ladder's lime. The media blocks are still placeholders: swap
// each one for real product art before this ships.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { LBody, LCta, LEyebrow, LH2, LSection } from '@/components/marketing/v2/ui';

/** Day strip plus copy on the left, the app phone on the right.
 *
 *  The weekday initials are a comma-separated message value, not a constant: M T W T F S S is
 *  English, and a Spanish week starts on Monday as L M M J V S D. Splitting one string keeps the
 *  strip a single translatable unit instead of seven keys. */
export async function KnowExactly(): Promise<ReactElement> {
  const t = await getTranslations('home.features');
  const dayLabels = t('dayLabels').split(',');
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="flex gap-2">
            {dayLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold ${
                  index === 0
                    ? 'border-2 border-[#ff2d55] bg-transparent text-[#ff2d55]'
                    : 'bg-[#262626] text-white/70'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <LH2 className="mt-8">{t('knowGymHeading')}</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">{t('knowGymBody')}</LBody>
          <LCta className="mt-8" href="/join">
            {t('startToday')}
          </LCta>
        </div>

        <div className="relative grid place-items-center">
          <div className="absolute h-[420px] w-[420px] max-w-full rounded-full bg-[#161616]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/img/app-1.avif"
            alt=""
            className="relative h-auto w-[290px] max-w-full"
          />
        </div>
      </div>
    </LSection>
  );
}

/** The one light band: media left, fuel copy right. */
export async function SaveTime(): Promise<ReactElement> {
  const t = await getTranslations('home.features');
  return (
    <LSection tone="bone">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/street-red.avif"
          alt="Stephanie Pantoja"
          className="aspect-[4/5] w-full rounded-xl object-cover object-[center_25%]"
        />

        <div>
          <LEyebrow className="text-[#0e0e0e]">{t('fuelEyebrow')}</LEyebrow>
          <LH2 className="mt-1">{t('fuelHeading')}</LH2>
          <LBody className="mt-5 text-[#4a4a4a]">{t('fuelBody')}</LBody>
        </div>
      </div>
    </LSection>
  );
}

/** Coach video left, coaching copy and the CTA right. */
export async function LearnFromBest(): Promise<ReactElement> {
  const t = await getTranslations('home.features');
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/seated-rest.avif"
          alt="Stephanie Pantoja"
          className="aspect-[4/5] w-full rounded-xl object-cover object-[center_30%]"
        />

        <div>
          <LEyebrow className="text-white">{t('accountabilityEyebrow')}</LEyebrow>
          <LH2 className="mt-1">{t('accountabilityHeading')}</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">{t('accountabilityBody')}</LBody>
          <LCta className="mt-8" href="/join">
            {t('startToday')}
          </LCta>
        </div>
      </div>
    </LSection>
  );
}

/** Two stacked identity bands that alternate sides on desktop. */
export async function TrackBlocks(): Promise<ReactElement> {
  const t = await getTranslations('home.features');
  return (
    <LSection tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <LEyebrow>{t('evolutionEyebrow')}</LEyebrow>
          <LH2 className="mt-1">{t('evolutionHeading')}</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">{t('evolutionBody')}</LBody>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/trust-process.avif"
          alt="Stephanie Pantoja"
          className="aspect-[4/3] w-full rounded-xl object-cover object-[center_20%]"
        />
      </div>

      <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
        <div className="order-1 lg:order-2">
          <LEyebrow>{t('disciplineEyebrow')}</LEyebrow>
          <LH2 className="mt-1">{t('disciplineHeading')}</LH2>
          <LBody className="mt-5 text-[#bcbcbc]">{t('disciplineBody')}</LBody>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/shoot/power-stance.avif"
          alt="Stephanie Pantoja"
          className="order-2 aspect-[4/3] w-full rounded-xl object-cover object-[center_25%] lg:order-1"
        />
      </div>
    </LSection>
  );
}
