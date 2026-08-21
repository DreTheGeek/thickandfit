// The written manual: every screen in this console, in the order somebody needs it.
//
// "A new coach is lost when they open this software." The checklist on Getting started answers
// "what have I not done yet". It never answered "what IS this and how does it work", which is how
// a whole feature can ship with no way in and nobody notices.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/icons';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { learnTabs } from '@/lib/coach/section-tabs';
import { TRAINING, TRAINING_CATEGORIES } from '@/lib/coach/training-articles';

export const dynamic = 'force-dynamic';

export default async function TrainingPage(): Promise<ReactElement> {
  await requireCoach();
  const sectionTabs = await learnTabs();

  return (
    <div>
      <CoachSectionTabs tabs={sectionTabs} active="/coach/training" />

      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">How-to</h1>
      <p className="tf-measure mt-1 mb-6 text-[13px] text-muted">
        How everything works, in the order you will need it. Nothing here is urgent.
      </p>

      {TRAINING_CATEGORIES.map((cat) => {
        const inCat = TRAINING.filter((a) => a.category === cat);
        // A category with no articles is not rendered at all. An empty heading reads as a section
        // that failed to load rather than as one nobody has written yet.
        if (inCat.length === 0) return null;
        return (
          <section key={cat} className="mb-7">
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[2px] text-faint">{cat}</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {inCat.map((a) => (
                <Link
                  key={a.slug}
                  href={`/coach/training/${a.slug}`}
                  className="tf-press rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold text-ink">{a.title}</span>
                    <span className="flex flex-none items-center gap-1 text-[11px] tabular-nums text-faint">
                      <Icon name="clock" size={12} />
                      {a.minutes}m
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{a.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
