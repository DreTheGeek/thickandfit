// /admin/security/audit-log — admin-action audit log. Fort Knox anti-get-sued pillar: every
// destructive mutation (coach action, DB trigger on companies/profiles) lands in public.audit_log
// and this page is where an operator (or a lawyer) reads it back.
//
// Read-only. Filters come in via query params and are Zod-parsed in parseAuditFilters, so a
// hand-edited URL cannot inject anything. Cursor pagination on created_at (stable ordering).
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import {
  parseAuditFilters,
  getAuditKpis,
  getAuditFilterOptions,
  listAuditPage,
  AUDIT_LOG_PAGE_SIZE,
  type AuditRow,
} from '@/lib/admin/audit-log-view';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const sp = await searchParams;
  const { filters, cursor } = parseAuditFilters(sp);

  if (!ctx.companyId) {
    return (
      <AdminPage title="Audit log" subtitle="Every admin + coach mutation, with before/after state.">
        <Card>
          <p className="text-[13px] text-muted">No company scope on your account.</p>
        </Card>
      </AdminPage>
    );
  }

  const [kpis, options, pageResult] = await Promise.all([
    getAuditKpis(ctx.companyId),
    getAuditFilterOptions(ctx.companyId),
    listAuditPage(ctx.companyId, filters, cursor),
  ]);

  // Preserve active filters when building the "next page" link.
  const nextHref = pageResult.nextCursor
    ? `/admin/security/audit-log?${new URLSearchParams({
        ...(filters.actor ? { actor: filters.actor } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        cursor: pageResult.nextCursor,
      }).toString()}`
    : null;

  const hasFilters = Boolean(filters.actor || filters.action || filters.entityType || filters.from || filters.to);

  return (
    <AdminPage
      title="Audit log"
      subtitle="Every admin + coach mutation with before/after state. Written by logCoachAction and the DB audit triggers."
    >
      <Card title="Activity">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Actions 24h" value={String(kpis.actions24h)} />
          <Stat label="Actions 7d" value={String(kpis.actions7d)} />
          <Stat label="Unique actors 7d" value={String(kpis.uniqueActors7d)} />
          <Stat
            label="Destructive 7d"
            value={String(kpis.destructive7d)}
            sub="delete / revoke / refund"
            tone={kpis.destructive7d > 0 ? 'warn' : undefined}
          />
        </div>
      </Card>

      {/* Filters are a plain GET form: no client JS, bookmarkable, and the server Zod-parses. */}
      <Card title="Filter">
        <form method="GET" action="/admin/security/audit-log" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">Actor</span>
            <select name="actor" defaultValue={filters.actor ?? ''} className={SELECT_CLS}>
              <option value="">Any</option>
              {options.actors.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">Action</span>
            <select name="action" defaultValue={filters.action ?? ''} className={SELECT_CLS}>
              <option value="">Any</option>
              {options.actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">Entity</span>
            <select name="entityType" defaultValue={filters.entityType ?? ''} className={SELECT_CLS}>
              <option value="">Any</option>
              {options.entityTypes.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">From</span>
            <input type="date" name="from" defaultValue={filters.from ?? ''} className={SELECT_CLS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-faint">To</span>
            <input type="date" name="to" defaultValue={filters.to ?? ''} className={SELECT_CLS} />
          </label>
          <button
            type="submit"
            className="tf-press rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-surface"
          >
            Apply
          </button>
          {hasFilters && (
            <Link href="/admin/security/audit-log" className="text-[12px] text-muted underline-offset-4 hover:underline">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card title={`Entries (${pageResult.rows.length}${pageResult.nextCursor ? '+' : ''})`}>
        {pageResult.rows.length === 0 ? (
          <p className="text-[13px] text-muted">
            {hasFilters
              ? 'No entries match those filters. Widen the range or clear them.'
              : 'No admin actions logged in the last 30 days.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pageResult.rows.map((row) => (
              <AuditEntry key={row.id} row={row} />
            ))}
          </div>
        )}
        {nextHref && (
          <div className="mt-4">
            <Link
              href={nextHref}
              className="tf-press inline-block rounded-xl border border-line px-4 py-2 text-[13px] font-semibold text-ink"
            >
              Next {AUDIT_LOG_PAGE_SIZE}
            </Link>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

const SELECT_CLS =
  'rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink';

/** One audit row. <details> gives us before/after JSON on demand with zero client JS. */
function AuditEntry({ row }: { row: AuditRow }): ReactElement {
  const when = new Date(row.createdAt);
  const actor = row.actorName?.trim() || row.actorEmail || (row.actorId ? `${row.actorId.slice(0, 8)}...` : 'system');
  const isDestructive = /delete|revoke|refund/i.test(row.action);
  const hasState = row.before != null || row.after != null;

  return (
    <details className="rounded-md border border-line bg-surface px-3 py-2.5">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[13px] [&::-webkit-details-marker]:hidden">
        <span className="tabular-nums text-[12px] text-faint">
          {when.toISOString().slice(0, 16).replace('T', ' ')}
        </span>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]',
            isDestructive ? 'bg-alert-bg text-alert-ink' : 'bg-warm text-soft',
          ].join(' ')}
        >
          {row.action}
        </span>
        <span className="font-medium text-ink">{actor}</span>
        <span className="text-[12px] text-muted">
          {row.entityType}
          {row.entityId ? ` ${row.entityId.slice(0, 8)}...` : ''}
        </span>
        {row.ipAddress && <span className="text-[11px] text-faint">{row.ipAddress}</span>}
      </summary>
      {hasState ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StateBlock label="Before" value={row.before} />
          <StateBlock label="After" value={row.after} />
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-faint">No state snapshot recorded for this action.</p>
      )}
    </details>
  );
}

function StateBlock({ label, value }: { label: string; value: unknown }): ReactElement {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[1px] text-faint">{label}</div>
      <pre className="max-h-56 overflow-auto rounded bg-bg p-2 text-[11px] leading-snug text-soft">
        {value == null ? '-' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
