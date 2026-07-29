// Consent capture viewer (Fort Knox / anti-get-sued evidence). Read-only. Shows the last N
// consent_captures rows scoped to this tenant with three KPIs at the top: signups w/ consent 7d,
// billing consent captures 7d, and the health-ack acceptance rate across the active member base.
// Search by email and filter by consent_type via URL params (GET form submit); no mutations.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { getConsentSnapshot } from '@/lib/admin/consent-viewer';

export const dynamic = 'force-dynamic';

type SearchParams = { q?: string; type?: string };

export default async function ConsentViewerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 200) : '';
  const type = typeof sp.type === 'string' ? sp.type.slice(0, 60) : '';
  const snap = await getConsentSnapshot(ctx.companyId, {
    q: q || undefined,
    type: type || undefined,
  });

  return (
    <AdminPage
      title="Consent capture"
      subtitle="Timestamped, versioned acceptance records: Terms, Privacy, billing, auto-renewal, health disclaimer. Read-only evidence surface for chargebacks + subpoenas."
    >
      <Card title="Last 7 days">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Signups w/ consent"
            value={fmt(snap.kpi.signupsWithConsent7d)}
            sub="distinct users, Terms + Privacy"
            tone={snap.kpi.signupsWithConsent7d > 0 ? 'good' : undefined}
          />
          <Stat
            label="Billing consents"
            value={fmt(snap.kpi.billingConsents7d)}
            sub="incl. auto-renewal disclosure"
            tone={snap.kpi.billingConsents7d > 0 ? 'good' : undefined}
          />
          <Stat
            label="Health-ack rate"
            value={`${snap.kpi.healthAckPct}%`}
            sub={`${fmt(snap.kpi.healthAckAcked)} of ${fmt(snap.kpi.healthAckTotal)} members`}
            tone={
              snap.kpi.healthAckTotal === 0
                ? undefined
                : snap.kpi.healthAckPct >= 90
                  ? 'good'
                  : snap.kpi.healthAckPct < 60
                    ? 'warn'
                    : undefined
            }
          />
        </div>
      </Card>

      <Card
        title={`Captures (${fmt(snap.totalMatching)}${snap.totalMatching > snap.rows.length ? ` shown ${snap.rows.length}` : ''})`}
        action={
          <a
            href="/admin/security/consent"
            className="text-[11px] font-semibold uppercase tracking-[1px] text-faint hover:text-ink"
          >
            Reset
          </a>
        }
      >
        <form method="GET" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-[11px] uppercase tracking-[1px] text-faint">
            Search email
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="user@example.com"
              className="rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[1px] text-faint sm:w-64">
            Consent type
            <select
              name="type"
              defaultValue={type}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
            >
              <option value="">All types</option>
              {snap.distinctTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg border border-line bg-ink px-4 py-2 text-[12px] font-semibold uppercase tracking-[1px] text-bg hover:opacity-90"
          >
            Apply
          </button>
        </form>

        {snap.rows.length === 0 ? (
          <p className="text-[13px] text-muted">No consent records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">Time</th>
                  <th className="pb-2 pr-4 font-semibold">Profile</th>
                  <th className="pb-2 pr-4 font-semibold">Consent type</th>
                  <th className="pb-2 pr-4 font-semibold">Version</th>
                  <th className="pb-2 pr-4 font-semibold">IP</th>
                  <th className="pb-2 font-semibold">User agent</th>
                </tr>
              </thead>
              <tbody>
                {snap.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-muted">{fmtTime(r.createdAt)}</td>
                    <td className="py-2.5 pr-4 text-ink">
                      <div>{r.email ?? '(unknown)'}</div>
                      {r.fullName ? <div className="text-[11px] text-faint">{r.fullName}</div> : null}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-warm px-2.5 py-0.5 text-[11px] font-semibold text-soft">
                        {r.consentType}
                      </span>
                      {!r.accepted && (
                        <span className="ml-2 rounded-full bg-alert px-2.5 py-0.5 text-[11px] font-semibold text-alert-ink">
                          declined
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-muted">{r.version}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-[12px] text-muted">
                      {r.ipAddress ?? '-'}
                    </td>
                    <td className="max-w-[420px] truncate py-2.5 text-[12px] text-muted" title={r.userAgent ?? ''}>
                      {r.userAgent ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
