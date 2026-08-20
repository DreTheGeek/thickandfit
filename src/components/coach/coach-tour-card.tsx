'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';
import type { CoachTour, TourGroup } from '@/lib/coach/tour';

const GROUP_ORDER: TourGroup[] = ['people', 'programming', 'comms', 'assistant', 'setup'];

/**
 * "Finish learning the console": the setup-checklist pattern, applied to a coach's first week.
 *
 * COLLAPSIBLE, DEFAULTING OPEN UNTIL IT IS MOSTLY DONE. A checklist that stays expanded forever
 * becomes furniture and pushes the actual work down the page; one that starts collapsed is never
 * found. Open while there is real ground to cover, collapsed once she is past the halfway mark and
 * clearly finding her way around.
 *
 * IT REMOVES ITSELF ENTIRELY when every step is done, so the console stops explaining itself to
 * somebody who has demonstrably learned it. There is no dismiss button: the steps are things worth
 * doing, and doing them IS the dismissal. A dismiss would also let a coach hide the queue that keeps
 * the hand-written-plan promise.
 *
 * Grouped rather than a flat list of fourteen, because fourteen checkboxes is a wall and the groups
 * match how the work actually divides.
 */
export function CoachTourCard({ tour }: { tour: CoachTour }): ReactElement | null {
  const t = useTranslations('app.coach.tour');
  const mostlyDone = tour.doneCount >= Math.ceil(tour.total / 2);
  const [open, setOpen] = useState(!mostlyDone);

  if (tour.complete) return null;
  const pct = Math.round((tour.doneCount / tour.total) * 100);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tf-press flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-warm text-ink">
          <Icon name={tour.doneCount > 0 ? 'check' : 'sparkles'} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{t('title')}</span>
          <span className="mt-0.5 block text-[12px] text-muted">
            {t('progress', { done: tour.doneCount, total: tour.total })}
          </span>
        </span>
        {/* The bar reads at a glance from across a desk, which the count alone does not. */}
        <span className="hidden h-1.5 w-28 flex-none overflow-hidden rounded-full bg-warm sm:block">
          <span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className={`flex-none text-faint transition-transform ${open ? 'rotate-180' : ''}`}>
          <Icon name="chevronRight" size={16} className="rotate-90" />
        </span>
      </button>

      {open && (
        <div className="border-t border-divider px-5 pb-5 pt-4">
          {GROUP_ORDER.map((g) => {
            const steps = tour.steps.filter((s) => s.group === g);
            if (steps.length === 0) return null;
            return (
              <div key={g} className="mb-4 last:mb-0">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-faint">
                  {t(`group.${g}`)}
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {steps.map((s) => (
                    <Link
                      key={s.key}
                      href={s.href}
                      className="tf-press flex items-center gap-3 border-b border-divider py-2.5 last:border-0"
                    >
                      <span
                        className={[
                          'grid h-5 w-5 flex-none place-items-center rounded-full border',
                          s.done ? 'border-ink bg-ink text-bg' : 'border-line text-transparent',
                        ].join(' ')}
                      >
                        <Icon name="check" size={11} />
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${s.done ? 'text-faint line-through' : 'text-ink'}`}
                      >
                        {t(`step.${s.key}`)}
                      </span>
                      {/* Only the undone rows get a call to action, so the eye lands on what is left. */}
                      {!s.done && (
                        <span className="flex-none text-[12px] font-semibold text-accent-ink">
                          {s.kind === 'action' ? t('do') : t('see')}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
