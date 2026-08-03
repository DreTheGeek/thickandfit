import type { ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// Day one, for a member whose program has not been written yet.
//
// WHAT THIS REPLACES, and why it mattered. The old state said "Your program's on the way. Your coach
// will assign your program soon." Nothing in the system made that true: no queue, no coach task, no
// reminder, no deadline. It was a promise with no delivery mechanism, and it bought her silence with
// her own patience during the exact week a fitness app is most likely to lose her.
//
// The fix is not better wording. It is to stop making waiting the activity. Everything below is
// something she can finish in the next ten minutes, in the order that actually compounds: food first
// because it moves the needle most and starts teaching the engine how she eats, then the baseline
// she will want to have taken, then the people.
//
// The program note stays, demoted to a footnote and phrased honestly. She should know it is coming
// and that a human is writing it. She should not be told to sit still until it does.

type Step = { href: string; titleKey: string; bodyKey: string; badge: string };

const STEPS: Step[] = [
  { href: '/nutrition', titleKey: 'stepFoodTitle', bodyKey: 'stepFoodBody', badge: '1' },
  { href: '/progress', titleKey: 'stepBaselineTitle', bodyKey: 'stepBaselineBody', badge: '2' },
  { href: '/community', titleKey: 'stepCommunityTitle', bodyKey: 'stepCommunityBody', badge: '3' },
];

export function FirstSteps(): ReactElement {
  const t = useTranslations('app.firstSteps');

  return (
    <section className="flex flex-col gap-3 py-2">
      <div>
        <h3 className="font-display text-[22px] leading-tight text-ink">{t('title')}</h3>
        <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-soft">{t('subtitle')}</p>
      </div>

      <div className="mt-1 flex flex-col gap-2.5">
        {STEPS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="tf-press flex items-start gap-3.5 rounded-[14px] border border-line bg-surface px-4 py-3.5 hover:border-ink"
          >
            {/* Numbered because these compound in order, not because a list needs decoration. */}
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-surface">
              {s.badge}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">{t(s.titleKey)}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-soft">{t(s.bodyKey)}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Demoted to a footnote, and honest: a person is writing it, so it is not instant. The old
          copy implied an imminent arrival that nothing scheduled. */}
      <p className="mt-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-faint">
        {t('programNote')}
      </p>
    </section>
  );
}
