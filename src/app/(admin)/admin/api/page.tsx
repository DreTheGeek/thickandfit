// API Usage Analytics: request volume, latency, error rates, endpoint breakdown, top consumers,
// recent errors, rate-limit breaches - the command-center view, live from api_request_log.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getApiAnalytics } from '@/lib/admin/portal';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { VolumeChart } from '@/components/admin/volume-chart';

export const dynamic = 'force-dynamic';

function ago(iso: string): string {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

export default async function ApiAnalyticsPage(): Promise<ReactElement> {
  await requireOperator();
  const a = await getApiAnalytics(30);

  return (
    <AdminPage title="API usage analytics" subtitle="Request volume, latency, and error rates across every endpoint (last 30 days).">
      {!a ? (
        <Card>No data yet.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total requests" value={a.totals.requests.toLocaleString('en-US')} sub="past 30 days" />
            <Stat label="Error rate" value={`${a.totals.error_rate}%`} sub="4xx + 5xx" tone={a.totals.error_rate > 5 ? 'bad' : a.totals.error_rate > 1 ? 'warn' : 'good'} />
            <Stat label="p95 latency" value={`${a.totals.p95} ms`} />
            <Stat label="p99 latency" value={`${a.totals.p99} ms`} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Anonymous traffic" value={a.totals.anon.toLocaleString('en-US')} sub="public + failed-auth" />
            <Stat label="Auth failures (401/403)" value={a.totals.auth_fail.toLocaleString('en-US')} sub="watch for spikes" tone={a.totals.auth_fail > 200 ? 'warn' : undefined} />
            <Stat label="Public endpoint hits" value={a.totals.public_hits.toLocaleString('en-US')} sub="2xx, no user" />
          </div>

          <Card title="Request volume"><VolumeChart data={a.volume} /></Card>

          <Card title="Endpoint breakdown">
            {a.endpoints.length === 0 ? <p className="py-4 text-center text-[13px] text-faint">No requests logged yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead><tr className="border-b border-line text-left text-[10px] uppercase tracking-[1px] text-faint">
                    <th className="py-2 pr-3 font-semibold">Endpoint</th><th className="px-3 py-2 font-semibold">Method</th><th className="px-3 py-2 text-right font-semibold">Requests</th><th className="px-3 py-2 text-right font-semibold">Error rate</th><th className="px-3 py-2 text-right font-semibold">Avg</th>
                  </tr></thead>
                  <tbody>{a.endpoints.map((e, i) => (
                    <tr key={i} className="border-b border-divider last:border-0">
                      <td className="py-2 pr-3 font-mono text-[12px] text-soft">{e.path}</td>
                      <td className="px-3 py-2"><span className="rounded bg-warm px-1.5 py-0.5 text-[10px] font-semibold text-soft">{e.method}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.requests}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${e.error_rate > 0 ? 'text-[#B4462F]' : 'text-faint'}`}>{e.error_rate}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-soft">{e.avg_ms} ms</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Latency by endpoint (p50 / p95 / p99)">
            {a.latency.length === 0 ? <p className="py-4 text-center text-[13px] text-faint">No timing samples yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead><tr className="border-b border-line text-left text-[10px] uppercase tracking-[1px] text-faint">
                    <th className="py-2 pr-3 font-semibold">Endpoint</th><th className="px-3 py-2 text-right font-semibold">Reqs</th><th className="px-3 py-2 text-right font-semibold">p50</th><th className="px-3 py-2 text-right font-semibold">p95</th><th className="px-3 py-2 text-right font-semibold">p99</th>
                  </tr></thead>
                  <tbody>{a.latency.map((l, i) => (
                    <tr key={i} className="border-b border-divider last:border-0">
                      <td className="py-2 pr-3 font-mono text-[12px] text-soft">{l.path}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.requests}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.p50} ms</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.p95} ms</td>
                      <td className="px-3 py-2 text-right tabular-nums text-soft">{l.p99} ms</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Top API consumers">
            {a.consumers.length === 0 ? <p className="py-4 text-center text-[13px] text-faint">No authenticated traffic yet.</p> : a.consumers.map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[13px] last:border-0">
                <span className="truncate font-medium text-ink">{c.email}</span>
                <span className="shrink-0 text-[12px] text-soft">{c.requests} reqs · <span className={c.errors > 0 ? 'text-[#B4462F]' : ''}>{c.errors} err</span> · {ago(c.last)}</span>
              </div>
            ))}
          </Card>

          <Card title={`Recent errors (${a.recent_errors.length})`}>
            {a.recent_errors.length === 0 ? <p className="py-4 text-center text-[13px] text-[#1F7A46]">No errors in this period. ✓</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12px]">
                  <thead><tr className="border-b border-line text-left text-[10px] uppercase tracking-[1px] text-faint">
                    <th className="py-2 pr-3 font-semibold">When</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Endpoint</th><th className="px-3 py-2 text-right font-semibold">Latency</th><th className="px-3 py-2 font-semibold">User</th>
                  </tr></thead>
                  <tbody>{a.recent_errors.map((e, i) => (
                    <tr key={i} className="border-b border-divider last:border-0">
                      <td className="py-2 pr-3 text-soft">{ago(e.ts)}</td>
                      <td className="px-3 py-2"><span className="rounded bg-[#F6E2DC] px-1.5 py-0.5 font-semibold text-[#8C3325]">{e.status}</span></td>
                      <td className="px-3 py-2 font-mono text-soft">{e.method} {e.path}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-faint">{e.duration_ms ? `${e.duration_ms}ms` : '-'}</td>
                      <td className="px-3 py-2 text-faint">{e.email}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Rate-limit breaches (HTTP 429)">
            {a.rate_limits.length === 0 ? <p className="py-4 text-center text-[13px] text-[#1F7A46]">No rate-limit breaches in this period. ✓</p> : a.rate_limits.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b border-divider py-2 text-[12px] last:border-0">
                <span className="font-mono text-soft">{r.path}</span><span className="text-faint">{r.email} · {ago(r.ts)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </AdminPage>
  );
}
