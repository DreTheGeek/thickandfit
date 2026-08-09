'use client';

// "These clients finished the protocol and are owed their personalised plan."
//
// This list is the reason protocol_assignments exists. Step one is a fixed template that anyone can
// send; step two is Stephanie sitting down and building one plan for one person, and the failure mode
// it replaces is the 14 days quietly ending with nobody noticing. So the overdue set is the first
// thing on the index page, above the protocol library, ordered oldest first.
import { useState, useTransition, type ReactElement } from 'react';
import Link from 'next/link';
import { COACH_COPY } from '@/lib/protocols/copy';
import { setPlanDeliveredAction } from '@/lib/protocols/actions';
import type { ProtocolAssignmentRow } from '@/lib/protocols/types';

export function PlanDuePanel({ rows }: { rows: readonly ProtocolAssignmentRow[] }): ReactElement {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markDelivered(assignmentId: string): void {
    setError(null);
    start(async () => {
      const res = await setPlanDeliveredAction({ assignmentId, isDelivered: true });
      if (!res.ok) setError(COACH_COPY.assignErrorFailed);
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="tf-display text-[18px] text-ink">{COACH_COPY.dueTitle}</h2>
      <p className="mt-1 text-[12px] text-faint">{COACH_COPY.dueBody}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">{COACH_COPY.dueNone}</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-divider py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{r.contactName}</div>
                <div className="mt-0.5 text-[12px] text-faint">
                  <Link href={`/coach/tool/protocols/${r.protocolId}`} className="hover:text-ink">
                    {r.protocolName}
                  </Link>
                  <span className="mx-1.5">&middot;</span>
                  {COACH_COPY.ended} {r.endsOn}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-alert px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-alert-ink">
                  {Math.abs(r.daysRemaining)}d
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markDelivered(r.id)}
                  className="tf-press rounded-full border border-ink px-3.5 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-50"
                >
                  {COACH_COPY.markPlanDelivered}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error != null && <p className="mt-3 text-[12px] text-alert-ink">{error}</p>}
    </section>
  );
}
