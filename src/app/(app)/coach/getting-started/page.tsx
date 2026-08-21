// Everything in order, with what each part is for.
//
// The old version was fourteen checkboxes that ticked when you VISITED a screen, which told a new
// coach that a screen exists and left her to work out what it was for. Every stage here carries the
// WHY, the steps in the order somebody does them, and what trips people up, and ticks itself off
// real data wherever real data can prove it. See lib/coach/onboarding.ts.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/icons';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { learnTabs } from '@/lib/coach/section-tabs';
import { getCoachOnboarding, ONBOARDING_INTRO, type StageState } from '@/lib/coach/onboarding';
import { markOnboardingStepAction } from '@/lib/coach/tour-actions';

export const dynamic = 'force-dynamic';

function Stage({ s, n }: { s: StageState; n: number }): ReactElement {
  return (
    <details className="group rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <summary className="tf-press flex cursor-pointer list-none items-center gap-3 p-4">
        <span
          className={[
            'grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-bold',
            s.done ? 'bg-ink text-bg' : 'bg-warm text-muted',
          ].join(' ')}
        >
          {s.done ? <Icon name="check" size={14} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${s.done ? 'text-faint line-through' : 'text-ink'}`}>
            {s.title}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{s.why}</span>
        </span>
        <span className="flex flex-none items-center gap-1 text-[11px] tabular-nums text-faint">
          <Icon name="clock" size={12} />
          {s.minutes}m
        </span>
        <Icon name="chevronRight" size={15} className="flex-none text-line transition-transform group-open:rotate-90" />
      </summary>

      <div className="border-t border-divider px-4 pb-4 pt-3.5">
        <ol className="flex flex-col gap-2.5">
          {s.how.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-soft">
              <span className="flex-none font-bold text-faint">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {s.watchOut && (
          <p className="mt-3.5 rounded-xl border border-line bg-warm/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-soft">
            <span className="font-semibold">Watch out: </span>
            {s.watchOut}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Link
            href={s.href}
            className="tf-press inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-bg"
          >
            {s.cta}
            <Icon name="chevronRight" size={14} />
          </Link>
          {s.learnMore && (
            <Link
              href={`/coach/training/${s.learnMore}`}
              className="tf-press rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-muted hover:text-ink"
            >
              Read more
            </Link>
          )}
          {/* SELF-REPORTED ONLY. A stage the database can prove is never tickable by hand: she
              assigns a program, the row appears, the tick follows. Offering a manual tick for it
              would let the console disagree with the data it is reading. */}
          {s.selfReported && !s.done && (
            <form action={markOnboardingStepAction}>
              <input type="hidden" name="step" value={s.key} />
              <button
                type="submit"
                className="tf-press rounded-full px-3 py-2 text-[12.5px] text-faint underline hover:text-ink"
              >
                Mark as done
              </button>
            </form>
          )}
        </div>
      </div>
    </details>
  );
}

export default async function GettingStartedPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const [sectionTabs, ob] = await Promise.all([
    learnTabs(),
    getCoachOnboarding(ctx.companyId ?? '', ctx.userId),
  ]);

  const dayOne = ob.stages.filter((s) => s.tier === 'dayOne');
  const more = ob.stages.filter((s) => s.tier === 'makeItYours');
  const pct = Math.round((ob.dayOneDone / Math.max(1, ob.dayOneTotal)) * 100);

  return (
    <div className="max-w-[72ch]">
      <CoachSectionTabs tabs={sectionTabs} active="/coach/getting-started" />

      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">Getting started</h1>
      <p className="tf-measure mt-1 text-[13px] text-muted">
        Everything in order, with what each part is for. Nothing here is urgent except the first four.
      </p>

      <div className="mt-5 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-[15px] font-semibold text-ink">{ONBOARDING_INTRO.title}</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-soft">{ONBOARDING_INTRO.body}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {ONBOARDING_INTRO.points.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
              <span className="text-faint">–</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-warm/40 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-ink text-bg">
            <Icon name="sparkles" size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Day one</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">
              {ob.dayOneDone} of {ob.dayOneTotal} done. These four are what coaching through this app looks like.
            </span>
          </span>
        </div>
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {dayOne.map((s, i) => (
          <Stage key={s.key} s={s} n={i + 1} />
        ))}
      </div>

      <h2 className="mt-8 font-display text-xl uppercase tracking-tight">Make it yours</h2>
      <p className="mt-1 text-[13px] text-muted">
        {ob.moreDone} of {ob.moreTotal} done. None of this stops you coaching today.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {more.map((s, i) => (
          <Stage key={s.key} s={s} n={i + 1} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-ink">Everything else is in How-to</span>
          <span className="mt-0.5 block text-[12.5px] text-muted">Every screen in this console has a written walkthrough.</span>
        </span>
        <Link
          href="/coach/training"
          className="tf-press inline-flex flex-none items-center gap-2 rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          Open How-to
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </div>
  );
}
