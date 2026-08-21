import type { ReactElement } from 'react';
import Link from 'next/link';

/**
 * One row of tabs across a group of screens that belong together.
 *
 * WHY THIS EXISTS. The sidebar had 26 rows, and several of them were near-neighbours filed as
 * strangers: "you get meal plans, recipe books, and recipes. All that could have been in one tab."
 * That is exactly right, and the same is true of the four member queues, which are all one
 * question - who needs something from me - split four ways down the left edge.
 *
 * The routes are NOT merged. Each page keeps its own URL, its own loader and its own shape, because
 * merging four server components into one tabbed page is a rewrite that risks four working screens
 * to save four sidebar rows. This gives the sidebar one row per GROUP and puts the movement between
 * members of the group at the top of the screen, where it reads as "these are the same job".
 *
 * Server-safe: no hooks, no 'use client'. Every consumer is an async server component and the
 * active tab is decided by the page that renders it, which already knows which one it is.
 */
export type SectionTab = {
  href: string;
  label: string;
  /** Shown as a pill. Omit where there is nothing to count; never render a 0 as a badge. */
  count?: number;
};

export function CoachSectionTabs({
  tabs,
  active,
}: {
  tabs: SectionTab[];
  /** The href of the tab being viewed. */
  active: string;
}): ReactElement {
  return (
    <nav className="tf-scroll -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Section">
      {tabs.map((tab) => {
        const on = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={[
              'tf-press flex flex-none items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold',
              on ? 'bg-ink text-bg' : 'bg-surface text-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {/* A zero is not a badge. An empty queue should read as calm, not as a count of nothing. */}
            {tab.count != null && tab.count > 0 && (
              <span
                className={[
                  'rounded-full px-1.5 py-px text-[11px] tabular-nums',
                  on ? 'bg-bg/20 text-bg' : 'bg-warm text-ink',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
