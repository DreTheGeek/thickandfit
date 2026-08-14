// Members who have stopped showing up, before their card fails.
//
// The coach home already has an "at risk" tile and an "at risk" chip. Both mean billing: a declined
// card, a lapsed payment. That number is real and it is also the last event in a churn — by the time
// it fires, she decided weeks ago and the conversation that could have changed it is over.
//
// This page is the other one. It reads activity, not payments, and it exists because the automated
// ladder makes a promise on day 28 ("your coach is going to reach out personally") that nothing in
// the codebase can keep. /coach/awaiting keeps "Steph writes your plan by hand" honest; this keeps
// that one honest. If this page stops being read, the day-28 message becomes a lie.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { listEngagementRisk } from '@/lib/engagement/risk';
import { TIER_LABEL, type RiskTier } from '@/lib/engagement/risk-shared';

export const dynamic = 'force-dynamic';

const TIER_STYLE: Record<Exclude<RiskTier, 'ok'>, string> = {
  ghost: 'bg-alert text-alert-ink',
  at_risk: 'bg-alert text-alert-ink',
  weak_start: 'bg-warm text-soft',
  slipping: 'bg-warm text-soft',
};

function quietFor(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default async function CoachQuietPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { rows, truncated } = ctx.companyId
    ? await listEngagementRisk(ctx.companyId)
    : { rows: [], truncated: [] as string[] };

  const urgent = rows.filter((r) => r.tier === 'ghost' || r.tier === 'at_risk').length;

  return (
    <div>
      <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">Gone quiet</h1>
      <p className="tf-measure mt-1 text-[13px] text-muted">
        Members who have stopped logging, training and checking in. This is not the billing list:
        nobody here has missed a payment yet, which is the entire point of looking at it.
      </p>

      {/* A capped sweep reporting a partial roster as "everyone" would be the worst kind of quiet
          failure on a page about quiet failures. */}
      {truncated.length > 0 && (
        <p className="mt-3 rounded-[10px] bg-alert px-4 py-3 text-[13px] text-alert-ink">
          Activity sweep hit its row cap on {truncated.join(', ')}. This list is a floor, not the
          whole picture — some members may be more active than they look here.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-line px-5 py-8 text-center">
            <p className="text-[15px] text-ink">Everybody is showing up.</p>
            <p className="mt-1 text-[13px] text-soft">
              Nobody has been quiet for a week, and nobody is coming off a weak first month.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[13px] text-soft">
              <b className="text-ink">{rows.length}</b> need a look
              {urgent > 0 ? (
                <>
                  {' · '}
                  <b className="text-alert-ink">{urgent} two weeks or more</b>
                </>
              ) : null}
            </p>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {rows.map((r) => {
                const tier = r.tier as Exclude<RiskTier, 'ok'>;
                const label = TIER_LABEL[tier];
                return (
                  <article
                    key={r.profileId}
                    className="rounded-[14px] border border-line bg-surface px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-ink">{r.name}</h3>
                        <p className="text-[12px] text-faint">{r.email ?? 'no email'}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_STYLE[tier]}`}
                      >
                        quiet {quietFor(r.daysQuiet)}
                      </span>
                    </div>

                    <p className="mt-2.5 text-[13px] font-semibold text-ink">{label.title}</p>
                    {/* The action, not just the diagnosis. A queue that tells her forty people are
                        at risk and nothing about what to do with them is a list of forty problems. */}
                    <p className="mt-1 text-[13px] text-soft">{label.action}</p>

                    <p className="mt-2.5 text-[12px] text-faint">
                      {/* "No activity in 30 days", not "never logged anything". The sweep looks
                          back 30 days and reads user_streaks for anything older; a member with no
                          streak row (she logged before the streak engine ever ran for her) has an
                          unknown last-active date, not a nonexistent one. Claiming she has never
                          done anything would be a confident lie on the card that decides whether
                          the coach phones her. */}
                      {r.lastActiveOn
                        ? `Last active ${r.lastActiveOn}`
                        : 'No activity in the last 30 days'}
                      {' · '}
                      {r.memberAgeDays} days in
                      {' · '}
                      {r.workouts30d} workout{r.workouts30d === 1 ? '' : 's'} in 30 days
                    </p>

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <Link
                        href="/coach/inbox"
                        className="tf-press rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-surface"
                      >
                        Message her
                      </Link>
                      {r.contactId && (
                        <Link
                          href={`/coach/clients/${r.contactId}`}
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
