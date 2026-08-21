'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import type { CoachOnboarding } from '@/lib/coach/onboarding';

/**
 * "Welcome, here is what to do first", on the coach home.
 *
 * WHAT THIS REPLACED. Fourteen checkboxes grouped five ways that ticked when you VISITED a screen.
 * It was a lot of furniture for something that taught nothing: knowing a screen exists is not
 * knowing what it is for, and "you have seen 6 of 14 screens" is not progress toward anything.
 *
 * This shows the DAY ONE four and nothing else, because nothing in the second tier matters while a
 * woman is still waiting on a plan nobody has opened the queue to write. Each row carries its own
 * one-line reason, which is the part that does the teaching; the full walkthrough with the steps
 * and the traps is one tap away on Getting started.
 *
 * IT REMOVES ITSELF when the four are done. There is no dismiss: the steps are the job, doing them
 * IS the dismissal, and a dismiss button would let a coach hide the queue that keeps the
 * hand-written-plan promise honest.
 */
export function CoachOnboardingCard({
  onboarding,
  firstName,
}: {
  onboarding: CoachOnboarding;
  firstName: string | null;
}): ReactElement | null {
  const dayOne = onboarding.stages.filter((s) => s.tier === 'dayOne');
  // Collapsed once she is past halfway: open forever becomes furniture and pushes the real work
  // down the page, but starting collapsed means it is never found.
  const [open, setOpen] = useState(onboarding.dayOneDone < Math.ceil(dayOne.length / 2));

  if (onboarding.readyToCoach) return null;
  const pct = Math.round((onboarding.dayOneDone / Math.max(1, dayOne.length)) * 100);

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-line bg-warm/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tf-press flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-ink text-bg">
          <Icon name="sparkles" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted">
            {onboarding.dayOneDone} of {dayOne.length} done. These four are what coaching through this app looks like.
          </span>
        </span>
        <span className="h-1.5 w-16 flex-none overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
        </span>
        <Icon
          name="chevronRight"
          size={15}
          className={`flex-none text-line transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-divider px-4 pb-3 pt-1">
          {dayOne.map((s) => (
            <Link
              key={s.key}
              href={s.done ? '/coach/getting-started' : s.href}
              className="tf-press flex items-center gap-3 border-b border-divider py-3 last:border-0"
            >
              <span
                className={[
                  'grid h-8 w-8 flex-none place-items-center rounded-[10px]',
                  s.done ? 'bg-ink text-bg' : 'bg-surface text-ink',
                ].join(' ')}
              >
                <Icon name={s.done ? 'check' : 'chevronRight'} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[13.5px] font-semibold ${s.done ? 'text-faint line-through' : 'text-ink'}`}
                >
                  {s.title}
                </span>
                {/* The WHY, not the title again. "Work the Needs you queue" is an instruction;
                    "four lists of women waiting on something from you" is a reason, and a reason is
                    what gets somebody to open a screen she has never used. */}
                {!s.done && (
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{s.why}</span>
                )}
              </span>
              <span className="flex flex-none items-center gap-1 text-[11px] tabular-nums text-faint">
                <Icon name="clock" size={11} />
                {s.minutes}m
              </span>
            </Link>
          ))}
          <Link
            href="/coach/getting-started"
            className="tf-press mt-2 flex items-center justify-center gap-2 py-2 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            Walk me through the whole thing
            <Icon name="chevronRight" size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}
