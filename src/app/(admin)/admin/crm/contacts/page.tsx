// Admin CRM contacts. Unified view over public.contacts (0013) — the single home for Lenus
// imports, waitlist sync (ensureCrmContact), app signups, and manual entries. One aggregator
// (getCrmContactsPage) reads KPIs + histograms + a filtered page in one round trip; filters and
// pagination live in the URL so the page is shareable and back-safe. English-only ops tool.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import {
  getCrmContactsPage,
  parseCrmFilters,
  type CrmContactRow,
  type CrmFilters,
  type CrmListPage,
} from '@/lib/admin/crm-list';

export const dynamic = 'force-dynamic';

// Stable labels for the two enum-ish columns; unknown values fall through to the raw string.
const SOURCE_LABEL: Record<string, string> = {
  lenus: 'Lenus',
  waitlist: 'Waitlist',
  app: 'App',
  manual: 'Manual',
  ghl: 'GHL',
  import: 'Import',
};
const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  active: 'Active',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  churned: 'Churned',
  won: 'Won',
  lost: 'Lost',
};

export default async function AdminCrmContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const filters = parseCrmFilters(await searchParams);

  if (!ctx.companyId) {
    return (
      <AdminPage title="CRM contacts" subtitle="Unified contact table (Lenus + waitlist + app + manual)">
        <Card>
          <p className="text-[13px] text-muted">This operator is not attached to a company yet.</p>
        </Card>
      </AdminPage>
    );
  }

  const page = await getCrmContactsPage(ctx.companyId, filters);

  return (
    <AdminPage
      title="CRM contacts"
      subtitle="Unified contact table. One row per person across Lenus, waitlist signups, app members, and manual entries."
    >
      {/* KPIs */}
      <Card title="Totals">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="All contacts" value={fmt(page.total)} sub="in tenant" />
          <Stat
            label="Active"
            value={fmt(page.byStage['active'] ?? 0)}
            sub={page.total > 0 ? `${pct(page.byStage['active'] ?? 0, page.total)}% of total` : '-'}
            tone={(page.byStage['active'] ?? 0) > 0 ? 'good' : undefined}
          />
          <Stat
            label="Leads"
            value={fmt(page.byStage['lead'] ?? 0)}
            sub={page.total > 0 ? `${pct(page.byStage['lead'] ?? 0, page.total)}% of total` : '-'}
          />
          <Stat
            label="Churned"
            value={fmt(page.byStage['churned'] ?? 0)}
            sub={page.total > 0 ? `${pct(page.byStage['churned'] ?? 0, page.total)}% of total` : '-'}
            tone={(page.byStage['churned'] ?? 0) > 0 ? 'warn' : undefined}
          />
        </div>
      </Card>

      {/* Source + stage histograms — the raw counts behind the KPI tiles */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="By source">
          <HistogramList counts={page.bySource} labels={SOURCE_LABEL} total={page.total} />
        </Card>
        <Card title="By lifecycle stage">
          <HistogramList counts={page.byStage} labels={STAGE_LABEL} total={page.total} />
        </Card>
      </div>

      {/* Filters — a GET form so state lives in the URL. Reset link clears every param. */}
      <Card title="Search + filter">
        <form
          method="get"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          action="/admin/crm/contacts"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
              Search (email or name)
            </label>
            <input
              type="text"
              id="q"
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="jane@example.com"
              maxLength={80}
              className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-faint"
            />
          </div>
          <SelectFilter
            id="source"
            label="Source"
            value={filters.source}
            options={page.sourceOptions}
            labels={SOURCE_LABEL}
          />
          <SelectFilter
            id="stage"
            label="Lifecycle stage"
            value={filters.stage}
            options={page.stageOptions}
            labels={STAGE_LABEL}
          />
          <SelectFilter
            id="product"
            label="Product tier"
            value={filters.product}
            options={page.productOptions}
          />
          <SelectFilter
            id="lang"
            label="Language"
            value={filters.lang}
            options={page.langOptions}
            labels={{ en: 'English', es: 'Spanish' }}
          />
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="rounded-md border border-line bg-ink px-4 py-2 text-[13px] font-semibold text-bg hover:opacity-90"
            >
              Apply
            </button>
            <Link
              href="/admin/crm/contacts"
              className="rounded-md border border-line px-4 py-2 text-[13px] font-semibold text-muted hover:text-ink"
            >
              Reset
            </Link>
            {filterCount(filters) > 0 ? (
              <span className="ml-2 text-[12px] text-faint">
                {filterCount(filters)} filter{filterCount(filters) === 1 ? '' : 's'} applied ·{' '}
                {fmt(page.filteredTotal)} match{page.filteredTotal === 1 ? '' : 'es'}
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Table + pagination */}
      <Card
        title={`Contacts (${fmt(page.filteredTotal)})`}
        action={
          page.totalPages > 1 ? (
            <span className="text-[11px] text-faint">
              Page {page.page} of {page.totalPages}
            </span>
          ) : null
        }
      >
        {page.rows.length === 0 ? (
          <p className="text-[13px] text-muted">No contacts yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                    <th className="pb-2 pr-4 font-semibold">Name</th>
                    <th className="pb-2 pr-4 font-semibold">Email</th>
                    <th className="pb-2 pr-4 font-semibold">Source</th>
                    <th className="pb-2 pr-4 font-semibold">Stage</th>
                    <th className="pb-2 pr-4 font-semibold">Product</th>
                    <th className="pb-2 pr-4 font-semibold">Created</th>
                    <th className="pb-2 pr-4 font-semibold">Last activity</th>
                    <th className="pb-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((r) => (
                    <ContactRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} filters={filters} />
          </>
        )}
      </Card>
    </AdminPage>
  );
}

// ────────────────────────────────────────────────────────────────────────────────

function ContactRow({ row }: { row: CrmContactRow }): ReactElement {
  const name =
    [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || '(no name)';
  return (
    <tr className="border-t border-line">
      <td className="py-2.5 pr-4 text-ink">{name}</td>
      <td className="py-2.5 pr-4 text-muted">{row.email ?? '-'}</td>
      <td className="py-2.5 pr-4">
        <span className="rounded-full bg-warm px-2.5 py-0.5 text-[11px] font-semibold text-soft">
          {SOURCE_LABEL[row.source] ?? row.source}
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <StagePill stage={row.lifecycleStage} />
      </td>
      <td className="py-2.5 pr-4 text-muted">{row.productType ?? '-'}</td>
      <td className="py-2.5 pr-4 tabular-nums text-faint">{fmtDate(row.createdAt)}</td>
      <td className="py-2.5 pr-4 tabular-nums text-faint">{fmtDate(row.lastActivityAt)}</td>
      <td className="py-2.5 text-right">
        <Link
          href={`/coach/clients/${row.id}`}
          className="text-[12px] font-semibold text-ink underline underline-offset-2 hover:opacity-80"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function StagePill({ stage }: { stage: string }): ReactElement {
  const good = stage === 'active' || stage === 'won';
  const warn = stage === 'past_due' || stage === 'unpaid';
  const bad = stage === 'churned' || stage === 'canceled' || stage === 'lost';
  const cls = bad
    ? 'bg-alert text-alert-ink'
    : warn
      ? 'bg-warm text-soft'
      : good
        ? 'bg-warm text-ink'
        : 'bg-warm text-soft';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

function SelectFilter({
  id,
  label,
  value,
  options,
  labels,
}: {
  id: string;
  label: string;
  value: string | null;
  options: readonly string[];
  labels?: Record<string, string>;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value ?? ''}
        className="rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function HistogramList({
  counts,
  labels,
  total,
}: {
  counts: Record<string, number>;
  labels?: Record<string, string>;
  total: number;
}): ReactElement {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-[13px] text-muted">No data.</p>;
  return (
    <ul className="flex flex-col">
      {entries.map(([key, count]) => (
        <li
          key={key}
          className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[13px] last:border-0"
        >
          <span className="text-ink">{labels?.[key] ?? key}</span>
          <span className="tabular-nums text-muted">
            {fmt(count)}
            {total > 0 ? <span className="ml-2 text-faint">{pct(count, total)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pagination({ page, filters }: { page: CrmListPage; filters: CrmFilters }): ReactElement | null {
  if (page.totalPages <= 1) return null;
  const build = (n: number): string => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.source) params.set('source', filters.source);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.product) params.set('product', filters.product);
    if (filters.lang) params.set('lang', filters.lang);
    if (n > 1) params.set('page', String(n));
    const qs = params.toString();
    return qs ? `/admin/crm/contacts?${qs}` : '/admin/crm/contacts';
  };
  const prev = Math.max(1, page.page - 1);
  const next = Math.min(page.totalPages, page.page + 1);
  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.filteredTotal);
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="text-[12px] text-faint">
        Showing {fmt(from)}-{fmt(to)} of {fmt(page.filteredTotal)}
      </span>
      <span className="flex items-center gap-2">
        <PageLink href={build(prev)} disabled={page.page === 1}>
          Prev
        </PageLink>
        <span className="text-[12px] text-faint">
          {page.page} / {page.totalPages}
        </span>
        <PageLink href={build(next)} disabled={page.page === page.totalPages}>
          Next
        </PageLink>
      </span>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: string;
}): ReactElement {
  if (disabled) {
    return (
      <span className="rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-faint opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:opacity-80"
    >
      {children}
    </Link>
  );
}

function filterCount(f: CrmFilters): number {
  return [f.q, f.source, f.stage, f.product, f.lang].filter((v) => v != null && v !== '').length;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

// Suppress "unused import" noise on the type re-exports.
export type _Refs = CrmContactRow;
