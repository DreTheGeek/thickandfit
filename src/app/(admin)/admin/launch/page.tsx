// Launch runway board — the single ops page that tracks what's left before Aug 4 (waitlist opens)
// and Sept 27 (doors open). Blocker list lives in src/lib/admin/launch-runway.ts as a static const
// so a shipped item = a single-commit edit + git audit trail. No admin UI to author blockers on
// purpose: launch-time work is bounded, coding is faster than clicking, and audit trail matters.
//
// Reads two schedule tiles from CAMPAIGN_SCHEDULE in waitlist-metrics so "days-until" numbers
// stay consistent with the /admin/waitlist checkpoint dates.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { BLOCKERS, countByMilestone, daysUntil, type Blocker, type BlockerStatus } from '@/lib/admin/launch-runway';
import { CAMPAIGN_SCHEDULE } from '@/lib/admin/waitlist-metrics';

export const dynamic = 'force-dynamic';

export default async function AdminLaunchPage(): Promise<ReactElement> {
  await requireOperator();

  const aug4 = countByMilestone('aug4');
  const sept27 = countByMilestone('sept27');
  const ongoing = countByMilestone('ongoing');

  const daysUntilAug4 = daysUntil(CAMPAIGN_SCHEDULE.waitlistOpensIso);
  const daysUntilSept27 = daysUntil(CAMPAIGN_SCHEDULE.doorsOpenIso);

  return (
    <AdminPage
      title="Launch runway"
      subtitle="Every blocker between here and Aug 4 (waitlist opens) then Sept 27 (doors open). Edit src/lib/admin/launch-runway.ts to flip status."
    >
      <Card title="Days remaining">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Until Aug 4"
            value={String(daysUntilAug4)}
            sub="waitlist opens"
            tone={daysUntilAug4 <= 7 && aug4.blocked + aug4.pending > 0 ? 'warn' : undefined}
          />
          <Stat
            label="Until Sept 27"
            value={String(daysUntilSept27)}
            sub="doors open"
          />
          <Stat label="Aug 4 blockers" value={`${aug4.done}/${aug4.total}`} sub={`${aug4.pct}% done`} tone={aug4.pct === 100 ? 'good' : undefined} />
          <Stat label="Sept 27 blockers" value={`${sept27.done}/${sept27.total}`} sub={`${sept27.pct}% done`} tone={sept27.pct === 100 ? 'good' : undefined} />
        </div>
      </Card>

      <MilestoneCard title="Aug 4 — waitlist opens" counts={aug4} blockers={BLOCKERS.filter((b) => b.milestone === 'aug4')} />
      <MilestoneCard title="Sept 27 — doors open" counts={sept27} blockers={BLOCKERS.filter((b) => b.milestone === 'sept27')} />
      <MilestoneCard title="Ongoing ops hygiene" counts={ongoing} blockers={BLOCKERS.filter((b) => b.milestone === 'ongoing')} />
    </AdminPage>
  );
}

// ────────────────────────────────────────────────────────────────────────────────

function MilestoneCard({
  title,
  counts,
  blockers,
}: {
  title: string;
  counts: ReturnType<typeof countByMilestone>;
  blockers: readonly Blocker[];
}): ReactElement {
  const rollup = [
    counts.done > 0 ? `${counts.done} done` : null,
    counts.inProgress > 0 ? `${counts.inProgress} in progress` : null,
    counts.blocked > 0 ? `${counts.blocked} blocked` : null,
    counts.pending > 0 ? `${counts.pending} pending` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card title={title}>
      <p className="mb-3 text-[12px] text-muted">{rollup || 'nothing to do'}</p>
      <div className="flex flex-col gap-2">
        {blockers.map((b) => (
          <BlockerRow key={b.id} b={b} />
        ))}
      </div>
    </Card>
  );
}

function BlockerRow({ b }: { b: Blocker }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={b.status} />
          <span className="text-[13px] font-semibold text-ink">{b.title}</span>
          <span className="text-[11px] text-faint">· {b.owner}</span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-muted">{b.detail}</p>
        {b.notes && (
          <p className="mt-1 text-[11px] italic text-faint">{b.notes}</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BlockerStatus }): ReactElement {
  const { label, cls } = STATUS_STYLE[status];
  return (
    <span
      className={[
        'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1px]',
        cls,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<BlockerStatus, { label: string; cls: string }> = {
  done:        { label: '✓ done',        cls: 'bg-[#DFF2E4] text-[#1F7A46]' },
  in_progress: { label: '↻ in progress', cls: 'bg-warm text-soft' },
  blocked:     { label: '✗ blocked',     cls: 'bg-alert-bg text-alert-ink' },
  pending:     { label: '· pending',     cls: 'bg-warm text-faint' },
};
