// /admin/ai/safety-queue — coach-chat threads that want a human eye before anything else happens.
//
// Derived, not flagged: there is no safety_flag column (the posture lives in SAFETY_CLAUSE_EN in
// the prompt). getSafetyQueue unifies three feeds — a SCOFF-positive member's turns, a bilingual
// keyword match on the categories the safety clause covers, and any failed coach reply from
// ai_trace. Read-only; the action is "go read the thread," which deep-links into the coach inbox.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { getSafetyQueue, type FlaggedThread, type TriggerReason } from '@/lib/admin/ai-safety-queue';

export const dynamic = 'force-dynamic';

export default async function SafetyQueuePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const queue = await getSafetyQueue(ctx.companyId);
  const { kpi } = queue;

  return (
    <AdminPage
      title="Safety queue"
      subtitle="Coach-chat threads worth a human read: SCOFF-positive members, safety-keyword turns, and failed replies."
    >
      <Card title="Signals">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Flagged threads"
            value={String(kpi.openFlaggedThreads)}
            sub="last 30 days"
            tone={kpi.openFlaggedThreads > 0 ? 'warn' : 'good'}
          />
          <Stat
            label="SCOFF-positive members"
            value={String(kpi.scoffPositiveMembers)}
            sub="gentle posture applied"
          />
          <Stat
            label="Chat error rate 24h"
            value={kpi.chatErrorRate24h.pct == null ? '-' : `${kpi.chatErrorRate24h.pct}%`}
            sub={`${kpi.chatErrorRate24h.errors} of ${kpi.chatErrorRate24h.total} calls`}
            tone={
              kpi.chatErrorRate24h.pct != null && kpi.chatErrorRate24h.pct > 5
                ? 'bad'
                : kpi.chatErrorRate24h.pct != null && kpi.chatErrorRate24h.pct > 1
                  ? 'warn'
                  : undefined
            }
          />
        </div>
      </Card>

      <Card title={`Queue (${queue.flagged.length})`}>
        {queue.flagged.length === 0 ? (
          <p className="text-[13px] text-muted">
            No flagged conversations. Every recent thread came back clean and every coach reply landed.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {queue.flagged.map((t) => (
              <FlaggedRow key={t.key} thread={t} />
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

const TRIGGER_TONE: Record<TriggerReason, string> = {
  scoff: 'bg-warm text-soft',
  safety_keyword: 'bg-alert-bg text-alert-ink',
  error: 'bg-alert-bg text-alert-ink',
};

function FlaggedRow({ thread }: { thread: FlaggedThread }): ReactElement {
  const when = new Date(thread.timestamp);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]',
              TRIGGER_TONE[thread.trigger],
            ].join(' ')}
          >
            {thread.triggerLabel}
          </span>
          <span className="text-[13px] font-semibold text-ink">{thread.memberName}</span>
          {thread.memberEmail && <span className="text-[12px] text-muted">{thread.memberEmail}</span>}
          <span className="text-[11px] tabular-nums text-faint">
            {when.toISOString().slice(0, 16).replace('T', ' ')}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted">{thread.preview}</p>
      </div>
      <Link
        href={`/coach/inbox?profile=${encodeURIComponent(thread.profileId)}`}
        className="tf-press shrink-0 self-start rounded-xl border border-line px-4 py-2 text-[12px] font-semibold text-ink sm:self-auto"
      >
        Review thread
      </Link>
    </div>
  );
}
