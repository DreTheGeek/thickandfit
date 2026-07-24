// Identity band for the Thick & Fit landing page.
//
// The layout came from a reference clone, but every asset and every line of copy here is ours.
// The wordmark is set in type rather than pulled from a third-party file. No scoreboard lives on
// this page: no client counts, no follower counts, no press wall, no review totals. Proof is the
// transformation itself, stated plainly.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { Icon } from '@/components/ui/icons';

import { LH2, LSection } from '@/components/marketing/v2/ui';

/** The oversized, low-opacity THICK & FIT wordmark that bleeds under the section above it. */
export async function BigWordmark(): Promise<ReactElement> {
  const t = await getTranslations('home.proof');
  return (
    <section className="-mt-10 overflow-hidden bg-[#0e0e0e] px-5 py-0 sm:px-8 lg:-mt-20">
      <p
        aria-hidden="true"
        className="select-none text-center text-[18vw] font-extrabold uppercase leading-none tracking-[-0.02em] text-white opacity-[0.08]"
      >
        {t('wordmark')}
      </p>
    </section>
  );
}

// The transformation, stated as a before and after. Not features, not counts.
const BEFORE_KEYS: readonly string[] = [
  'difference.before1',
  'difference.before2',
  'difference.before3',
  'difference.before4',
];

const AFTER_KEYS: readonly string[] = [
  'difference.after1',
  'difference.after2',
  'difference.after3',
  'difference.after4',
];

/** The before and after column pair: what actually changes about you. */
export async function TheDifference(): Promise<ReactElement> {
  const t = await getTranslations('home.proof');
  return (
    <LSection tone="dark">
      <p className="text-center text-[14px] font-bold uppercase tracking-widest text-white">
        {t('difference.eyebrow')}
      </p>
      <LH2 className="mt-4 text-center">{t('difference.heading')}</LH2>
      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
        <div>
          <p className="mb-5 text-[13px] uppercase tracking-widest text-[#bcbcbc]">
            {t('difference.beforeLabel')}
          </p>
          <div className="flex flex-col gap-4">
            {BEFORE_KEYS.map((key) => (
              <p key={key} className="text-[18px] text-[#8a8a8a] sm:text-[20px]">
                {t(key)}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-5 text-[13px] uppercase tracking-widest text-[#ff2d55]">
            {t('difference.afterLabel')}
          </p>
          <div className="flex flex-col gap-4">
            {AFTER_KEYS.map((key) => (
              <p key={key} className="text-[18px] font-bold text-white sm:text-[20px]">
                {t(key)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </LSection>
  );
}

type Benefit = {
  icon: 'bolt' | 'nutrition' | 'chat' | 'camera';
  titleKey: string;
  bodyKey: string;
};

const BENEFITS: readonly Benefit[] = [
  { icon: 'bolt', titleKey: 'benefits.b1.title', bodyKey: 'benefits.b1.body' },
  { icon: 'nutrition', titleKey: 'benefits.b2.title', bodyKey: 'benefits.b2.body' },
  { icon: 'chat', titleKey: 'benefits.b3.title', bodyKey: 'benefits.b3.body' },
  { icon: 'camera', titleKey: 'benefits.b4.title', bodyKey: 'benefits.b4.body' },
];

/** Four-up identity grid under a centred headline. */
export async function BusyPeople(): Promise<ReactElement> {
  const t = await getTranslations('home.proof');
  return (
    <LSection tone="dark">
      <LH2 className="mb-14 text-center">{t('benefits.heading')}</LH2>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <div key={benefit.titleKey} className="text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center text-white">
              <Icon name={benefit.icon} size={34} strokeWidth={1.8} />
            </span>
            <h3 className="mt-5 text-[18px] font-extrabold uppercase leading-[1.1] text-white">
              {t(benefit.titleKey)}
            </h3>
            <p className="mx-auto mt-2 max-w-[26ch] text-[14px] leading-[1.5] text-[#bcbcbc]">
              {t(benefit.bodyKey)}
            </p>
          </div>
        ))}
      </div>
    </LSection>
  );
}
