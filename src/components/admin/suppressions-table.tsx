'use client';
// Suppression board table. Client-side because of two interactions: instant email filter (the board
// is capped at 500 rows so filtering in memory is correct and snappier than a round-trip) and the
// two-step Resubscribe confirm. Everything destructive-adjacent asks twice.
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { resubscribeAction } from '@/lib/admin/suppressions-actions';
import type { SuppressionRow, SuppressionSource, SuppressionReason } from '@/lib/admin/suppressions';

const REASON_LABEL: Record<SuppressionReason, string> = {
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  complained: 'Complained',
  manual: 'Manual',
};

const REASON_TONE: Record<SuppressionReason, string> = {
  unsubscribed: 'bg-warm text-soft',
  bounced: 'bg-alert-bg text-alert-ink',
  complained: 'bg-alert-bg text-alert-ink',
  manual: 'bg-warm text-soft',
};

const SOURCE_LABEL: Record<SuppressionSource, string> = {
  waitlist: 'Waitlist',
  email: 'Email',
};

const ERRORS: Record<string, string> = {
  invalid: 'Invalid request.',
  no_company: 'No company scope on your account.',
  rate_limited: 'Too many resubscribes. Wait a bit and try again.',
  failed: 'Could not resubscribe. Try again.',
};

export function SuppressionsTable({ rows }: { rows: SuppressionRow[] }): ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const doResubscribe = (row: SuppressionRow): void => {
    setError(null);
    start(async () => {
      const res = await resubscribeAction({ source: row.source, id: row.id, email: row.email });
      if (res.ok) {
        setConfirming(null);
        router.refresh();
      } else {
        setError(ERRORS[res.error ?? ''] ?? 'Something went wrong.');
        setConfirming(null);
      }
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email"
          className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
        />
        <span className="text-[12px] text-faint">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md border border-alert-ink/40 bg-alert-bg px-4 py-2.5 text-[13px] text-alert-ink">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-[13px] text-muted">
          {rows.length === 0
            ? "No suppressions yet. Everyone is still reachable."
            : 'No suppressed address matches that filter.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                <th className="pb-2 pr-4 font-semibold">Email</th>
                <th className="pb-2 pr-4 font-semibold">Source</th>
                <th className="pb-2 pr-4 font-semibold">Reason</th>
                <th className="pb-2 pr-4 font-semibold">Suppressed</th>
                <th className="pb-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="py-2.5 pr-4 text-ink">{row.email}</td>
                  <td className="py-2.5 pr-4 text-muted">{SOURCE_LABEL[row.source]}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] ${REASON_TONE[row.reason]}`}>
                      {REASON_LABEL[row.reason]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-faint">
                    {row.suppressedAt.slice(0, 10)}
                  </td>
                  <td className="py-2.5 text-right">
                    {confirming === row.key ? (
                      <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <span className="text-[12px] text-muted">Resubscribe?</span>
                        <button
                          type="button"
                          onClick={() => doResubscribe(row)}
                          disabled={pending}
                          className="tf-press text-[12px] font-semibold text-ink hover:underline disabled:opacity-50"
                        >
                          {pending ? 'Working...' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={pending}
                          className="tf-press text-[12px] text-faint hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(row.key)}
                        className="tf-press text-[12px] font-semibold text-ink hover:underline"
                      >
                        Resubscribe
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
