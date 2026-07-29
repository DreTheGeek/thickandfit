// Admin subscribers table (server component). Search input POSTs the ?q= param via GET form; no
// client JS needed for the filter itself. Deep-links "View" to /coach/subscribers/[id] which is
// the same surface the coach already uses — one canonical subscriber detail page across roles.
import type { ReactElement } from 'react';
import Link from 'next/link';
import type { SubscriberRow, SubscribersListResult } from '@/lib/admin/subscribers-list';

type Props = {
  result: SubscribersListResult;
  q: string;
  basePath: string; // e.g. '/admin/subscribers'
  rateLimited?: boolean;
};

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'muted'> = {
  active: 'good',
  trialing: 'good',
  past_due: 'warn',
  unpaid: 'warn',
  paused: 'warn',
  canceled: 'bad',
  churned: 'bad',
  incomplete: 'muted',
};

export function SubscribersTable({ result, q, basePath, rateLimited }: Props): ReactElement {
  const { rows, page, pageSize, total, hasPrev, hasNext } = result;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-4">
      <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search email or name"
          className="w-full max-w-md rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          aria-label="Search subscribers"
        />
        <button
          type="submit"
          className="rounded-lg border border-line bg-warm px-3 py-2 text-[12px] font-semibold uppercase tracking-[1px] text-ink hover:bg-surface"
        >
          Search
        </button>
        {q ? (
          <Link
            href={basePath}
            className="text-[12px] font-semibold uppercase tracking-[1px] text-muted hover:text-ink"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {rateLimited ? (
        <p className="rounded-lg border border-line bg-alert px-3 py-2 text-[12px] text-alert-ink">
          Too many searches. Wait a minute, then try again.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">
          {q
            ? `No subscribers match "${q}".`
            : 'No subscribers yet. Once Stripe or Lenus import lands, they surface here.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                <th className="pb-2 pr-4 font-semibold">Name</th>
                <th className="pb-2 pr-4 font-semibold">Email</th>
                <th className="pb-2 pr-4 font-semibold">Plan</th>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 pr-4 font-semibold text-right">MRR</th>
                <th className="pb-2 pr-4 font-semibold">Started</th>
                <th className="pb-2 pr-4 font-semibold">Ends</th>
                <th className="pb-2 pr-4 font-semibold">Cancel at</th>
                <th className="pb-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <SubscriberRowLine key={row.key} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
          <span>
            {start}-{end} of {total}
          </span>
          <div className="flex items-center gap-2">
            <PagerLink label="Prev" basePath={basePath} q={q} page={page - 1} disabled={!hasPrev} />
            <PagerLink label="Next" basePath={basePath} q={q} page={page + 1} disabled={!hasNext} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubscriberRowLine({ row }: { row: SubscriberRow }): ReactElement {
  const statusTone = row.status ? STATUS_TONE[row.status] ?? 'muted' : 'muted';
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2.5 pr-4 text-ink">
        <div className="flex items-center gap-2">
          <span>{row.name}</span>
          <span
            className="rounded-full bg-warm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-soft"
            title={row.source === 'native' ? 'In-app Stripe subscriber' : 'Legacy Lenus / CRM import'}
          >
            {row.source === 'native' ? 'App' : 'CRM'}
          </span>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-muted">{row.email || '-'}</td>
      <td className="py-2.5 pr-4 text-muted">{row.plan || '-'}</td>
      <td className="py-2.5 pr-4">
        <StatusPill status={row.status} tone={statusTone} />
      </td>
      <td className="py-2.5 pr-4 text-right text-ink tabular-nums">
        {row.mrrCents != null ? formatMoney(row.mrrCents) : '-'}
      </td>
      <td className="py-2.5 pr-4 text-muted tabular-nums">{formatDate(row.startedAt)}</td>
      <td className="py-2.5 pr-4 text-muted tabular-nums">{formatDate(row.endsAt)}</td>
      <td className="py-2.5 pr-4 text-muted tabular-nums">{formatDate(row.cancelAt)}</td>
      <td className="py-2.5 text-right">
        {row.linkId ? (
          <Link
            href={`/coach/subscribers/${row.linkId}`}
            className="text-[12px] font-semibold uppercase tracking-[1px] text-ink hover:underline"
          >
            View
          </Link>
        ) : (
          <span className="text-[12px] text-faint">Unclaimed</span>
        )}
      </td>
    </tr>
  );
}

function StatusPill({
  status,
  tone,
}: {
  status: string | null;
  tone: 'good' | 'warn' | 'bad' | 'muted';
}): ReactElement {
  const label = status ?? 'unknown';
  const cls =
    tone === 'good'
      ? 'bg-[#E7F1EA] text-[#1F7A46]'
      : tone === 'warn'
        ? 'bg-[#FBEED2] text-[#B98A1C]'
        : tone === 'bad'
          ? 'bg-[#F6DCD2] text-[#B4462F]'
          : 'bg-warm text-soft';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[1px] ${cls}`}>
      {label}
    </span>
  );
}

function PagerLink({
  label,
  basePath,
  q,
  page,
  disabled,
}: {
  label: string;
  basePath: string;
  q: string;
  page: number;
  disabled: boolean;
}): ReactElement {
  const base =
    'rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[1px]';
  if (disabled) {
    return <span className={`${base} bg-warm text-faint`}>{label}</span>;
  }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const href = params.toString() ? `${basePath}?${params.toString()}` : basePath;
  return (
    <Link href={href} className={`${base} bg-surface text-ink hover:bg-warm`}>
      {label}
    </Link>
  );
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}
