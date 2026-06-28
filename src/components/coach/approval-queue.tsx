'use client';

// Approver queue UI (PRD-30, WP8). Renders pending drafts with drafter + client names and a payload
// preview, plus Approve / Reject buttons that call decide(). decide() is guarded by requireApprover on
// the server, so this UI is only ever reached by a coach/operator (an assistant is redirected by the
// page). Each row tracks its own pending state so one decision does not freeze the whole list.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { decide } from '@/lib/coach/approval-actions';
import type { QueueRow } from '@/lib/coach/approval';

function PayloadPreview({ row }: { row: QueueRow }): ReactElement {
  const t = useTranslations('app.coach.midTicket');
  if (row.itemType === 'message') {
    const body = typeof row.payload.body === 'string' ? row.payload.body : '';
    return <p className="whitespace-pre-wrap text-[14px] leading-snug text-ink">{body}</p>;
  }
  const name = typeof row.payload.name === 'string' ? row.payload.name : t('typeMealPlan');
  const cal = typeof row.payload.calorieGoal === 'number' ? row.payload.calorieGoal : null;
  return (
    <div className="text-[14px] text-ink">
      <span className="font-semibold">{name}</span>
      {cal != null ? <span className="text-muted"> · {t('kcalShort', { n: cal })}</span> : null}
    </div>
  );
}

function QueueCard({ row }: { row: QueueRow }): ReactElement {
  const t = useTranslations('app.coach.midTicket');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  function act(decision: 'approved' | 'rejected'): void {
    setError(null);
    start(async () => {
      const res = await decide({ id: row.id, decision, note: note.trim() || undefined });
      if (!res.ok) setError(t('errorFailed'));
    });
  }

  return (
    <article className="rounded-2xl bg-surface p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="rounded-full bg-warm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-muted">
          {t(row.itemType === 'message' ? 'typeMessage' : 'typeMealPlan')}
        </span>
        <span className="text-[12px] text-faint">
          {t('draftedFor', { drafter: row.draftedByName, client: row.clientName })}
        </span>
      </div>

      <div className="mb-4 rounded-xl bg-bg p-3">
        <PayloadPreview row={row} />
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('notePlaceholder')}
        className="mb-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-ink"
      />

      {error ? <p className="mb-3 text-[13px] text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act('approved')}
          disabled={pending}
          className="tf-press rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {t('approve')}
        </button>
        <button
          type="button"
          onClick={() => act('rejected')}
          disabled={pending}
          className="tf-press rounded-full bg-warm px-5 py-2.5 text-[13px] font-semibold text-muted hover:text-ink disabled:opacity-40"
        >
          {t('reject')}
        </button>
      </div>
    </article>
  );
}

export function ApprovalQueue({
  pending,
  decided,
}: {
  pending: QueueRow[];
  decided: QueueRow[];
}): ReactElement {
  const t = useTranslations('app.coach.midTicket');
  return (
    <div className="space-y-6">
      <section>
        <h2 className="tf-display mb-3 text-[18px] text-ink">{t('queuePending')}</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl bg-surface p-5 text-[13px] text-faint">{t('queueEmpty')}</div>
        ) : (
          <div className="space-y-3">
            {pending.map((row) => (
              <QueueCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 ? (
        <section>
          <h2 className="tf-display mb-3 text-[18px] text-ink">{t('queueDecided')}</h2>
          <div className="space-y-2">
            {decided.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-[13px]"
              >
                <span className="truncate text-ink">
                  {t('draftedFor', { drafter: row.draftedByName, client: row.clientName })}
                </span>
                <span
                  className={[
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1px]',
                    row.status === 'approved' ? 'bg-accent text-accent-ink' : 'bg-warm text-muted',
                  ].join(' ')}
                >
                  {t(row.status === 'approved' ? 'statusApproved' : 'statusRejected')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
