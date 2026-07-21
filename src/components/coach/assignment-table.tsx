'use client';

// Assignment-management UI (PRD-30, WP8). Approver-only (the page guards with requireApprover). An
// operator assigns an assistant_coach to a client, sets the monthly rate (dollars in the UI, stored as
// bigint cents), and sees the per-assistant payout rollup (count of active clients x rate, tracking
// only, no Stripe transfer in WP8). Status can be toggled active/paused/ended per row.
import { useState, useTransition, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { upsertAssignment, setAssignmentStatus } from '@/lib/coach/assignment-actions';
import type { AssignmentRow, PayoutRollup, CoachProfileLite } from '@/lib/coach/assignments';

function dollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function AssignmentTable({
  assignments,
  payout,
  assistants,
  subscribers,
}: {
  assignments: AssignmentRow[];
  payout: PayoutRollup[];
  assistants: CoachProfileLite[];
  subscribers: CoachProfileLite[];
}): ReactElement {
  const t = useTranslations('app.coach.midTicket');
  const [assistantId, setAssistantId] = useState(assistants[0]?.id ?? '');
  const [clientId, setClientId] = useState(subscribers[0]?.id ?? '');
  const [rate, setRate] = useState('25');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canAssign = assistants.length > 0 && subscribers.length > 0;

  function assign(): void {
    setError(null);
    start(async () => {
      const res = await upsertAssignment({
        assistantId,
        clientId,
        monthlyRateCents: Math.round((Number(rate) || 0) * 100),
        status: 'active',
      });
      if (!res.ok) setError(res.error === 'same_person' ? t('errorSamePerson') : t('errorFailed'));
    });
  }

  function changeStatus(id: string, status: 'active' | 'paused' | 'ended'): void {
    start(async () => {
      await setAssignmentStatus({ id, status });
    });
  }

  return (
    <div className="space-y-6">
      {/* Payout rollup (AC-3) */}
      <section>
        <h2 className="tf-display mb-3 text-[18px] text-ink">{t('payoutTitle')}</h2>
        {payout.length === 0 ? (
          <div className="rounded-2xl bg-surface p-5 text-[13px] text-faint">{t('payoutEmpty')}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {payout.map((p) => (
              <div key={p.assistantId} className="rounded-2xl bg-surface p-4">
                <p className="truncate text-[14px] font-semibold text-ink">{p.assistantName}</p>
                <p className="mt-1 text-[12px] text-faint">
                  {t('activeClients', { n: p.activeClients })}
                </p>
                <p className="tf-display mt-2 text-[22px] text-ink">{dollars(p.monthlyPayoutCents)}</p>
                <p className="text-[11px] uppercase tracking-[1px] text-faint">{t('perMonth')}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New assignment form */}
      <section className="rounded-2xl bg-surface p-5">
        <h2 className="tf-display mb-4 text-[18px] text-ink">{t('assignTitle')}</h2>
        {!canAssign ? (
          <p className="text-[13px] text-faint">{t('assignNoRoster')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-muted">{t('assistant')}</label>
              <select
                value={assistantId}
                onChange={(e) => setAssistantId(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
              >
                {assistants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-muted">{t('client')}</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
              >
                {subscribers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-muted">{t('monthlyRate')}</label>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={assign}
                disabled={pending}
                className="tf-press w-full rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
              >
                {t('assign')}
              </button>
            </div>
          </div>
        )}
        {error ? <p className="mt-3 text-[13px] text-alert-ink">{error}</p> : null}
      </section>

      {/* Existing assignments */}
      <section>
        <h2 className="tf-display mb-3 text-[18px] text-ink">{t('rosterTitle')}</h2>
        {assignments.length === 0 ? (
          <div className="rounded-2xl bg-surface p-5 text-[13px] text-faint">{t('rosterEmpty')}</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-surface">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="px-4 py-3 font-semibold">{t('assistant')}</th>
                  <th className="px-4 py-3 font-semibold">{t('client')}</th>
                  <th className="px-4 py-3 font-semibold">{t('monthlyRate')}</th>
                  <th className="px-4 py-3 font-semibold">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-3 text-ink">{a.assistantName}</td>
                    <td className="px-4 py-3 text-ink">{a.clientName}</td>
                    <td className="px-4 py-3 text-ink">{dollars(a.monthlyRateCents)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={a.status}
                        onChange={(e) =>
                          changeStatus(a.id, e.target.value as 'active' | 'paused' | 'ended')
                        }
                        disabled={pending}
                        className="rounded-lg border border-line bg-bg px-2 py-1 text-[12px] outline-none focus:border-ink"
                      >
                        <option value="active">{t('statusActive')}</option>
                        <option value="paused">{t('statusPaused')}</option>
                        <option value="ended">{t('statusEnded')}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
