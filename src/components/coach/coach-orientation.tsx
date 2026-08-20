import type { ReactElement } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/ui/icons';
import type { CoachOrientation } from '@/lib/coach/orientation';

const ICONS: Record<string, IconName> = {
  clients: 'user',
  awaiting: 'clipboard',
  programs: 'dumbbell',
  knowledge: 'sparkles',
};

/**
 * The first thing a new coach sees, above the numbers.
 *
 * Placed ABOVE the KPI row deliberately. The tiles are the answer to "how is the business doing",
 * which is a question the owner asks and a new coach cannot yet act on. This is the answer to "what
 * do I do", which is the only question anybody has on their first morning.
 *
 * It removes itself. Once every step is done the card never renders again, so the console does not
 * spend its best real estate forever explaining itself to somebody who already knows.
 *
 * No dismiss button, on purpose. A dismiss would let a coach hide the queue that keeps the
 * hand-written-plan promise, and the steps here are things worth doing rather than things worth
 * acknowledging. Doing them IS the dismissal.
 */
export async function CoachOrientationCard({
  orientation,
  firstName,
}: {
  orientation: CoachOrientation;
  firstName: string | null;
}): Promise<ReactElement | null> {
  if (orientation.complete) return null;
  const t = await getTranslations('app.coach.orientation');

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-[20px] leading-tight text-ink">
        {firstName ? t('titleNamed', { name: firstName }) : t('title')}
      </h2>
      <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted">{t('subtitle')}</p>
      <p className="mt-2 text-[12px] font-semibold text-accent-ink">
        {t('progress', { done: orientation.doneCount, total: orientation.steps.length })}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {orientation.steps.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={[
              'tf-press flex items-start gap-3 rounded-xl border p-3.5 transition-colors',
              s.done ? 'border-divider opacity-60' : 'border-line hover:border-ink',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg',
                s.done ? 'bg-warm text-faint' : 'bg-warm text-ink',
              ].join(' ')}
            >
              <Icon name={s.done ? 'check' : (ICONS[s.key] ?? 'user')} size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-ink">{t(`${s.key}.title`)}</span>
              {/* The COUNT is the point of each line. "Assign a program" is a chore; "23 people are
                  waiting on a program" is a reason. Only shown where there is something to show. */}
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                {s.count > 0 ? t(`${s.key}.body`, { n: s.count }) : t(`${s.key}.empty`)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
