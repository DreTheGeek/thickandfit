'use client';

// Send the protocol, then track who is on it.
//
// The end date is shown BEFORE the send, not after. "Sent today, ends the 22nd, personalised plan due
// the 23rd" is the entire commitment being made, and a coach should read it before she clicks, not
// discover it in a table afterwards. The date shown here is computed with the same endsOnFor() the
// server action stores, so the two cannot drift.
//
// The client picker offers CRM contacts, which is the id space meal_plans already targets and the one
// that actually holds her 270 clients. Contacts already on this protocol are filtered out server-side
// AND blocked by a partial unique index, so the duplicate error below should be unreachable in the UI
// and is still handled, because two tabs are a thing.
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { COACH_COPY } from '@/lib/protocols/copy';
import {
  assignProtocolAction,
  setAssignmentStatusAction,
  setPlanDeliveredAction,
} from '@/lib/protocols/actions';
import { endsOnFor, type ProtocolAssignmentRow, type ProtocolClientOption, type ProtocolEsStatus, type ProtocolLocale } from '@/lib/protocols/types';

function errorText(code: string | undefined): string {
  if (code === 'duplicate') return COACH_COPY.assignErrorDuplicate;
  if (code === 'es_not_approved') return COACH_COPY.assignErrorNoSpanish;
  return COACH_COPY.assignErrorFailed;
}

/** Day after the last day: when step two is owed. */
function planDueDate(endsOn: string): string {
  const [y, m, d] = endsOn.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function DaysLeft({ row }: { row: ProtocolAssignmentRow }): ReactElement {
  // No dash placeholder: the house rule bans em dashes, and a hyphen in a numeric column reads as
  // a negative number.
  if (row.status !== 'active') return <span className="text-faint">&middot;</span>;
  if (row.daysRemaining > 0) return <span className="text-ink">{row.daysRemaining}</span>;
  if (row.daysRemaining === 0) return <span className="text-ink">{COACH_COPY.endedToday}</span>;
  return <span className="text-muted">{COACH_COPY.ended}</span>;
}

export function AssignPanel({
  protocolId,
  durationDays,
  esStatus,
  clients,
  assignments,
  today,
}: {
  protocolId: string;
  durationDays: number;
  esStatus: ProtocolEsStatus;
  clients: readonly ProtocolClientOption[];
  assignments: readonly ProtocolAssignmentRow[];
  today: string;
}): ReactElement {
  const [contactId, setContactId] = useState(clients[0]?.contactId ?? '');
  const [locale, setLocale] = useState<ProtocolLocale>('en');
  const [sentOn, setSentOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const endsOn = useMemo(() => endsOnFor(sentOn, durationDays), [sentOn, durationDays]);
  const isSpanishBlocked = locale === 'es' && esStatus !== 'approved';

  function send(): void {
    setError(null);
    start(async () => {
      const res = await assignProtocolAction({ protocolId, contactId, locale, sentOn });
      if (!res.ok) setError(errorText(res.error));
    });
  }

  function setStatus(assignmentId: string, status: 'active' | 'completed' | 'cancelled'): void {
    setError(null);
    start(async () => {
      const res = await setAssignmentStatusAction({ assignmentId, status });
      if (!res.ok) setError(errorText(res.error));
    });
  }

  function setDelivered(assignmentId: string, isDelivered: boolean): void {
    setError(null);
    start(async () => {
      const res = await setPlanDeliveredAction({ assignmentId, isDelivered });
      if (!res.ok) setError(errorText(res.error));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="tf-display mb-4 text-[18px] text-ink">{COACH_COPY.assignTitle}</h2>
        {clients.length === 0 ? (
          <p className="text-[13px] text-faint">{COACH_COPY.assignNoClients}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="protocol-client" className="mb-1 block text-[12px] font-medium text-muted">
                  {COACH_COPY.assignClient}
                </label>
                <select
                  id="protocol-client"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
                >
                  {clients.map((c) => (
                    <option key={c.contactId} value={c.contactId}>
                      {c.name}
                      {c.language === 'es' ? ' (es)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="protocol-locale" className="mb-1 block text-[12px] font-medium text-muted">
                  {COACH_COPY.assignLanguage}
                </label>
                <select
                  id="protocol-locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value === 'es' ? 'es' : 'en')}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
                >
                  <option value="en">{COACH_COPY.langEnglish}</option>
                  <option value="es">{COACH_COPY.langSpanish}</option>
                </select>
              </div>
              <div>
                <label htmlFor="protocol-sent-on" className="mb-1 block text-[12px] font-medium text-muted">
                  {COACH_COPY.assignSentOn}
                </label>
                <input
                  id="protocol-sent-on"
                  type="date"
                  value={sentOn}
                  onChange={(e) => setSentOn(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[14px] outline-none focus:border-ink"
                />
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="text-[10px] uppercase tracking-[1px] text-faint">{COACH_COPY.assignEnds}</div>
                <div className="font-display text-[15px] text-ink">{endsOn}</div>
              </div>
              <div className="rounded-lg border border-line px-3 py-2">
                <div className="text-[10px] uppercase tracking-[1px] text-faint">{COACH_COPY.assignPlanDue}</div>
                <div className="font-display text-[15px] text-ink">{planDueDate(endsOn)}</div>
              </div>
            </div>
            <button
              type="button"
              disabled={pending || contactId === '' || isSpanishBlocked}
              onClick={send}
              className="tf-press mt-4 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
            >
              {pending ? COACH_COPY.assignBusy : COACH_COPY.assignCta}
            </button>
            {isSpanishBlocked && (
              <p className="mt-3 text-[12px] text-muted">{COACH_COPY.assignErrorNoSpanish}</p>
            )}
          </>
        )}
        {error != null && <p className="mt-3 text-[12px] text-alert-ink">{error}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="tf-display mb-4 text-[18px] text-ink">{COACH_COPY.rosterTitle}</h2>
        {assignments.length === 0 ? (
          <p className="text-[13px] text-faint">{COACH_COPY.rosterEmpty}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-[1px] text-faint">
                  <th className="py-2 pr-3 font-semibold">{COACH_COPY.colClient}</th>
                  <th className="py-2 pr-3 font-semibold">{COACH_COPY.colSent}</th>
                  <th className="py-2 pr-3 font-semibold">{COACH_COPY.colEnds}</th>
                  <th className="py-2 pr-3 font-semibold">{COACH_COPY.colLeft}</th>
                  <th className="py-2 pr-3 font-semibold">{COACH_COPY.colPlan}</th>
                  <th className="py-2 font-semibold">{COACH_COPY.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-divider last:border-0">
                    <td className="py-3 pr-3">
                      <span className="font-medium text-ink">{a.contactName}</span>
                      {a.locale === 'es' && <span className="ml-2 text-[11px] text-faint">es</span>}
                    </td>
                    <td className="py-3 pr-3 text-muted">{a.sentOn}</td>
                    <td className="py-3 pr-3 text-muted">{a.endsOn}</td>
                    <td className="py-3 pr-3">
                      <DaysLeft row={a} />
                    </td>
                    <td className="py-3 pr-3">
                      {a.planDeliveredOn != null ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDelivered(a.id, false)}
                          title={COACH_COPY.undoPlanDelivered}
                          className="tf-press text-[12px] font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {COACH_COPY.planDelivered} {a.planDeliveredOn}
                        </button>
                      ) : a.isPlanDue ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDelivered(a.id, true)}
                          className="tf-press rounded-full bg-alert px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-alert-ink disabled:opacity-50"
                        >
                          {COACH_COPY.planDue}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDelivered(a.id, true)}
                          className="tf-press text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
                        >
                          {COACH_COPY.planPending}
                        </button>
                      )}
                    </td>
                    <td className="py-3">
                      {a.status === 'active' ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(a.id, 'completed')}
                            className="tf-press rounded-full border border-ink px-3 py-1 text-[11px] font-semibold text-ink disabled:opacity-50"
                          >
                            {COACH_COPY.markComplete}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(a.id, 'cancelled')}
                            className="tf-press rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted disabled:opacity-50"
                          >
                            {COACH_COPY.markCancelled}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted">
                          {a.status === 'completed' ? COACH_COPY.statusCompleted : COACH_COPY.statusCancelled}
                          {a.completedOn != null && ` ${a.completedOn}`}
                        </span>
                      )}
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
