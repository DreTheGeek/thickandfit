// Plans about to run out, so she hears about it before the member does.
//
// The other side of /coach/awaiting. That queue is "she never got a plan"; this is "hers is
// finishing". Stephanie asked for exactly this on 2026-08-13 — a week's warning before the 12-week
// mark, so a program gets rewritten instead of quietly expiring under a client who is still paying.
//
// Deliberately a separate page rather than a section on /coach/awaiting: the two lists need
// different actions (write a first plan vs write the next one), and merging them would bury a
// handful of renewals under a queue of new signups.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { listExpiringPlans } from '@/lib/coach/plan-followups';
import { CoachSectionTabs } from '@/components/coach/section-tabs';
import { needsYouTabs } from '@/lib/coach/section-tabs';

export const dynamic = 'force-dynamic';

function due(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`;
  if (daysLeft === 0) return 'ends today';
  if (daysLeft === 1) return 'ends tomorrow';
  return `${daysLeft} days left`;
}

export default async function CoachPlanRenewalsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { items, trainingWindowDays, mealWindowDays } = ctx.companyId
    ? await listExpiringPlans(ctx.companyId)
    : { items: [], trainingWindowDays: null, mealWindowDays: null };

  const off = trainingWindowDays === null && mealWindowDays === null;
  const overdue = items.filter((i) => i.daysLeft < 0).length;

  const sectionTabs = await needsYouTabs(ctx.companyId);

  return (
    <div>
      <CoachSectionTabs tabs={sectionTabs} active="/coach/plan-renewals" />
      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">Plans running out</h1>
      <p className="tf-measure mt-1 text-[13px] text-muted">
        Programs reaching the end of their weeks, and meal plans past their follow-up. Soonest first,
        with anything already expired at the top — a queue that hides a lapsed plan hides the exact
        case that went wrong.
      </p>

      {/* Silence here has two causes and they mean opposite things. Saying "all clear" when the
          feature is simply switched off is the failure this block prevents. */}
      {off ? (
        <div className="mt-6 rounded-[14px] border border-line px-5 py-8 text-center">
          <p className="text-[15px] text-ink">Follow-up reminders are off.</p>
          <p className="tf-measure mx-auto mt-1 text-[13px] text-soft">
            Nothing is being tracked yet. Set a training and meal-plan follow-up window in settings —
            a week ahead is the usual choice — and plans will start appearing here before they end.
          </p>
          <Link
            href="/coach/settings/coaching"
            className="tf-press mt-4 inline-block rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-surface"
          >
            Open settings
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {items.length === 0 ? (
            <div className="rounded-[14px] border border-line px-5 py-8 text-center">
              <p className="text-[15px] text-ink">Nothing is running out.</p>
              <p className="mt-1 text-[13px] text-soft">
                {trainingWindowDays !== null
                  ? `No program ends in the next ${trainingWindowDays} days.`
                  : 'Training follow-ups are off.'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-soft">
                <b className="text-ink">{items.length}</b> to rewrite
                {overdue > 0 ? (
                  <>
                    {' · '}
                    <b className="text-alert-ink">{overdue} already expired</b>
                  </>
                ) : null}
              </p>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {items.map((i) => (
                  <article
                    key={`${i.kind}-${i.id}`}
                    className="rounded-[14px] border border-line bg-surface px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-ink">{i.memberName}</h3>
                        <p className="text-[12px] text-faint">{i.planName}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          i.daysLeft < 0 ? 'bg-alert text-alert-ink' : 'bg-warm text-soft'
                        }`}
                      >
                        {due(i.daysLeft)}
                      </span>
                    </div>

                    <p className="mt-2.5 text-[12px] text-faint">
                      {i.kind === 'training' ? 'Program ends' : 'Meal plan follow-up due'} {i.endsOn}
                    </p>

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <Link
                        href={i.kind === 'training' ? '/coach/programs' : '/coach/tool/meal-plans'}
                        className="tf-press rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-surface"
                      >
                        {i.kind === 'training' ? 'Write the next block' : 'Update her plan'}
                      </Link>
                      {i.contactId && (
                        <Link
                          href={`/coach/clients/${i.contactId}`}
                          className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink"
                        >
                          Open her record
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
