// Members waiting on the training plan the app told them was being written.
//
// The member-facing copy now says "Steph writes your plan by hand, she will message you when it is
// ready." This page is what keeps that sentence honest. Without it the promise lived nowhere: the
// signup alert scrolls out of Telegram the same evening and nothing else remembers.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { listAwaitingProgram, OVERDUE_DAYS } from '@/lib/coach/awaiting-program';
import { getCoverageContext, filterToMine } from '@/lib/coach/coverage';
import { QueueScope } from '@/components/coach/queue-scope';

export const dynamic = 'force-dynamic';

function waited(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default async function CoachAwaitingPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const [allItems, coverage, sp] = await Promise.all([
    ctx.companyId ? listAwaitingProgram(ctx.companyId) : Promise.resolve([]),
    ctx.companyId ? getCoverageContext(ctx.companyId, ctx.userId) : Promise.resolve(null),
    searchParams,
  ]);
  const mine = sp.mine === '1' && coverage !== null;
  const items = mine
    ? filterToMine(allItems, (i) => i.assignedCoachId, ctx.userId, coverage)
    : allItems;
  const overdue = items.filter((i) => i.waitingDays >= OVERDUE_DAYS).length;

  // Renders its own heading rather than borrowing AdminPage from the admin portal: that component
  // carries the admin portal's own max-w-5xl and padding, which fought the coach container.
  return (
    <div>
      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">Waiting on a program</h1>
      <p className="tf-measure mt-1 text-[13px] text-muted">
        Finished onboarding, no training plan assigned yet. Oldest first, because a queue sorted
        newest-first starves its own bottom.
      </p>
      <QueueScope basePath="/coach/awaiting" mine={mine} visible={coverage?.anyAssigned ?? false} />
      <div className="mt-6 flex flex-col gap-5">
      {items.length === 0 ? (
        <div className="rounded-[14px] border border-line px-5 py-8 text-center">
          <p className="text-[15px] text-ink">Nobody is waiting.</p>
          <p className="mt-1 text-[13px] text-soft">
            Everyone who finished onboarding has a program assigned.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-soft">
            <b className="text-ink">{items.length}</b> waiting
            {overdue > 0 ? (
              <>
                {' · '}
                <b className="text-alert-ink">{overdue} over {OVERDUE_DAYS} days</b>
              </>
            ) : null}
          </p>
          {/* A work queue, so it tiles across the width instead of running one card per row down
              a 1000px screen. items-start keeps a card with injuries from stretching its row. */}
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((i) => {
              const late = i.waitingDays >= OVERDUE_DAYS;
              return (
                <article
                  key={i.profileId}
                  className="rounded-[14px] border border-line bg-surface px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-ink">{i.name}</h3>
                      <p className="text-[12px] text-faint">
                        {i.email ?? 'no email'}
                        {i.tier ? ` · ${i.tier}` : ''}
                      </p>
                    </div>
                    {/* The age is the only number on the card that should ever raise a pulse. */}
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        late ? 'bg-alert text-alert-ink' : 'bg-warm text-soft'
                      }`}
                    >
                      waiting {waited(i.waitingDays)}
                    </span>
                  </div>

                  {i.goalSummary && (
                    <p className="mt-2.5 text-[13px] text-soft">{i.goalSummary}</p>
                  )}

                  {/* Injuries sit on the card, not behind a click. A program cannot responsibly be
                      written without them, and making the coach open a record to find out is how a
                      bad lower back ends up with a deadlift in week one. */}
                  {(i.injuries.length > 0 || i.conditions.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {i.injuries.map((v) => (
                        <span key={`inj-${v}`} className="rounded-full bg-alert px-2.5 py-0.5 text-[11px] text-alert-ink">
                          {v}
                        </span>
                      ))}
                      {i.conditions.map((v) => (
                        <span key={`con-${v}`} className="rounded-full bg-warm px-2.5 py-0.5 text-[11px] text-soft">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <Link
                      href="/coach/programs"
                      className="tf-press rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-surface"
                    >
                      Build her program
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
              );
            })}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
