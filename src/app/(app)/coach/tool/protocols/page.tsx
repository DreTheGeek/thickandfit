// Protocols index: what is overdue first, then the library.
//
// Order is the argument. A protocol library is a static reference document and would be a fine second
// section; the list of clients whose two weeks have ended with no personalised plan is work that is
// already late, so it goes above it.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireCoach } from '@/lib/auth/guards';
import { getProfileTimezone } from '@/lib/datetime/profile-timezone';
import { localDay } from '@/lib/datetime/local-day';
import { listPlanDue, listProtocols } from '@/lib/protocols/protocols';
import { COACH_COPY } from '@/lib/protocols/copy';
import { Eyebrow, PageTitle } from '@/components/ui/section';
import { Icon } from '@/components/ui/icons';
import { PlanDuePanel } from '@/components/coach/protocols/plan-due-panel';

export const dynamic = 'force-dynamic';

export default async function CoachProtocolsPage(): Promise<ReactElement> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return <div className="p-8 text-sm text-muted">{COACH_COPY.empty}</div>;

  // Today in HER timezone, not the server's. A protocol that ended "yesterday" at 8pm Pacific must
  // not read as overdue to a UTC clock that has already rolled over.
  const today = localDay(await getProfileTimezone(ctx.userId));
  const [protocols, planDue] = await Promise.all([
    listProtocols(ctx.companyId, today),
    listPlanDue(ctx.companyId, today),
  ]);

  return (
    <div>
      <Eyebrow>{COACH_COPY.eyebrow}</Eyebrow>
      <PageTitle className="mb-1 mt-1">{COACH_COPY.title}</PageTitle>
      <p className="mb-5 max-w-[68ch] text-[13px] leading-relaxed text-muted">{COACH_COPY.subtitle}</p>

      <div className="flex flex-col gap-5">
        <PlanDuePanel rows={planDue} />

        {protocols.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[14px] text-ink">{COACH_COPY.empty}</p>
            <p className="mt-1 text-[13px] text-faint">{COACH_COPY.emptyDetail}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {protocols.map((p) => (
              <Link
                key={p.id}
                href={`/coach/tool/protocols/${p.id}`}
                className="tf-press flex flex-col rounded-2xl border border-line bg-surface p-5 hover:border-ink"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="tf-display min-w-0 text-[20px] leading-tight text-ink">{p.nameEn}</h2>
                  <Icon name="chevronRight" size={16} />
                </div>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted">{p.purposeEn}</p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-faint">
                  <span>
                    {p.durationDays} {COACH_COPY.durationDays}
                  </span>
                  <span>
                    {p.mealCount} {COACH_COPY.mealsPerDay}
                  </span>
                  <span>{p.isPublished ? COACH_COPY.published : COACH_COPY.unpublished}</span>
                </div>

                {/* Both totals on the card too, so the pair is never seen apart. */}
                <div className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
                  <div className="rounded-lg border border-line px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[1px] text-faint">
                      {COACH_COPY.totalsStated}
                    </div>
                    <div className="font-display text-[14px] text-ink">
                      {p.stated.kcalText} {COACH_COPY.kcal} / {p.stated.proteinG} / {p.stated.carbG} /{' '}
                      {p.stated.fatG}
                    </div>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[1px] text-faint">
                      {COACH_COPY.totalsSummed}
                    </div>
                    <div className="font-display text-[14px] text-ink">
                      {p.summed.kcal} {COACH_COPY.kcal} / {p.summed.proteinG} / {p.summed.carbG} /{' '}
                      {p.summed.fatG}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[1px]">
                  <span className="rounded-full border border-line px-3 py-1 text-muted">
                    {p.activeAssignments} {COACH_COPY.statusActive}
                  </span>
                  {p.planDueCount > 0 && (
                    <span className="rounded-full bg-alert px-3 py-1 text-alert-ink">
                      {p.planDueCount} {COACH_COPY.planDue}
                    </span>
                  )}
                  {p.esStatus !== 'approved' && (
                    <span className="rounded-full bg-pending px-3 py-1 text-pending-ink">
                      {p.esStatus === 'draft' ? COACH_COPY.esDraftTitle : COACH_COPY.esMissingTitle}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
