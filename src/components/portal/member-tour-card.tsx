'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/icons';
import type { MemberTour } from '@/lib/member/tour';

const ICONS: Record<string, IconName> = {
  workout: 'dumbbell',
  food: 'nutrition',
  weight: 'ruler',
  photos: 'camera',
  coach: 'chat',
  community: 'community',
};

/**
 * "Here is what this app does", as a list of first actions rather than a slideshow.
 *
 * Sits at the TOP of Today for a new member, above the numbers, because on day one the numbers are
 * all zero and mean nothing: 0% to goal, 0 of 197g protein. A wall of zeroes is not an achievement
 * dashboard, it is an empty room. This is what should be there instead until she has filled it.
 *
 * Open until she is halfway, then collapsed to a single line she can reopen. Gone entirely when
 * every step is done. No dismiss: the steps ARE the product, and hiding them helps nobody.
 */
export function MemberTourCard({ tour, firstName }: { tour: MemberTour; firstName: string | null }): ReactElement | null {
  const t = useTranslations('app.tour');
  const [open, setOpen] = useState(tour.doneCount < Math.ceil(tour.total / 2));

  if (tour.complete) return null;
  const pct = Math.round((tour.doneCount / tour.total) * 100);

  return (
    <section className="mb-4 overflow-hidden rounded-[20px] border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tf-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">
            {firstName ? t('titleNamed', { name: firstName }) : t('title')}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {t('progress', { done: tour.doneCount, total: tour.total })}
          </span>
        </span>
        <span className="h-1.5 w-16 flex-none overflow-hidden rounded-full bg-warm">
          <span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className={`flex-none text-faint transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronRight" size={15} className="rotate-90" />
        </span>
      </button>

      {open && (
        <div className="border-t border-divider px-4 pb-3 pt-1">
          {tour.steps.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="tf-press flex items-center gap-3 border-b border-divider py-3 last:border-0"
            >
              <span
                className={[
                  'grid h-8 w-8 flex-none place-items-center rounded-[10px]',
                  s.done ? 'bg-ink text-bg' : 'bg-warm text-ink',
                ].join(' ')}
              >
                <Icon name={s.done ? 'check' : (ICONS[s.key] ?? 'star')} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-semibold ${s.done ? 'text-faint line-through' : 'text-ink'}`}>
                  {t(`step.${s.key}.title`)}
                </span>
                {/* The WHY, not a restatement of the title. "Log your food" is an instruction;
                    "so Steph can see how you actually eat" is a reason, and a reason is what gets
                    somebody to open a screen she has never used. */}
                {!s.done && (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                    {t(`step.${s.key}.why`)}
                  </span>
                )}
              </span>
              {!s.done && <Icon name="chevronRight" size={15} className="flex-none text-line" />}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
