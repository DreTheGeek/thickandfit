// /admin/community/reports — the moderation queue.
//
// Launch-day risk this closes: one bad post with no operator queue means it stays up until someone
// happens to scroll past it. Every action here is audited; mute is a timestamp that expires on its
// own rather than a permanent ban, because permanently cutting a paying member's access should
// never be one click deep in a queue.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { ReportActions } from '@/components/admin/report-actions';
import { getReportsBoard, REASON_LABEL, type ReportRow } from '@/lib/admin/community-reports';

export const dynamic = 'force-dynamic';

export default async function CommunityReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const sp = await searchParams;
  const statusParam = typeof sp.status === 'string' ? sp.status : Array.isArray(sp.status) ? sp.status[0] : 'open';
  const statusFilter: 'open' | 'all' = statusParam === 'all' ? 'all' : 'open';

  if (!ctx.companyId) {
    return (
      <AdminPage title="Community reports" subtitle="Member-filed reports on community posts.">
        <Card>
          <p className="text-[13px] text-muted">No company scope on your account.</p>
        </Card>
      </AdminPage>
    );
  }

  const board = await getReportsBoard(ctx.companyId, statusFilter);
  const { kpi } = board;

  return (
    <AdminPage
      title="Community reports"
      subtitle="Work the queue: delete the post, mute the member for a week, or dismiss the report. Every action is audited."
    >
      <Card title="Queue health">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open" value={String(kpi.open)} tone={kpi.open > 0 ? 'warn' : 'good'} />
          <Stat label="Dismissed 7d" value={String(kpi.dismissed7d)} />
          <Stat label="Actioned 7d" value={String(kpi.actioned7d)} />
          <Stat
            label="Top reason"
            value={kpi.topReasons[0] ? REASON_LABEL[kpi.topReasons[0].reason] : '-'}
            sub={
              kpi.topReasons.length > 0
                ? kpi.topReasons.map((r) => `${REASON_LABEL[r.reason]}:${r.count}`).join(' · ')
                : 'nothing open'
            }
          />
        </div>
      </Card>

      <Card
        title={statusFilter === 'open' ? `Open reports (${board.rows.length})` : `All reports (${board.rows.length})`}
        action={
          <Link
            href={statusFilter === 'open' ? '/admin/community/reports?status=all' : '/admin/community/reports'}
            className="text-[12px] font-semibold text-muted hover:text-ink"
          >
            {statusFilter === 'open' ? 'Show all' : 'Show open only'}
          </Link>
        }
      >
        {board.rows.length === 0 ? (
          <p className="text-[13px] text-muted">
            {statusFilter === 'open'
              ? 'No open reports. The feed is clean.'
              : 'No reports have ever been filed.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {board.rows.map((r) => (
              <ReportCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-alert-bg text-alert-ink',
  dismissed: 'bg-warm text-faint',
  actioned: 'bg-warm text-soft',
};

function ReportCard({ row }: { row: ReportRow }): ReactElement {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] ${STATUS_TONE[row.status]}`}>
          {row.status}
        </span>
        <span className="rounded-full bg-warm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] text-soft">
          {REASON_LABEL[row.reason]}
        </span>
        <span className="text-[13px] font-semibold text-ink">{row.postAuthorName}</span>
        <span className="text-[12px] text-faint">reported by {row.reporterName}</span>
        <span className="text-[11px] tabular-nums text-faint">{row.createdAt.slice(0, 16).replace('T', ' ')}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap rounded bg-bg p-2.5 text-[13px] leading-snug text-soft">{row.postBody}</p>

      {row.note && <p className="mt-2 text-[12px] italic text-muted">Reporter note: {row.note}</p>}

      {row.status === 'open' && (
        <div className="mt-3 flex justify-end">
          <ReportActions
            reportId={row.id}
            postId={row.postId}
            reportedProfileId={row.reportedProfileId}
            authorName={row.postAuthorName}
          />
        </div>
      )}
    </div>
  );
}
