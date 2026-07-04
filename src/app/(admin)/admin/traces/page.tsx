// Agent observability: a trace per AI call (feature, model, latency, tokens, status, in/out preview).
// This is the trace-level view the 2026 agent stack calls for - every model call the app makes, live,
// with the failures surfaced first. Fed by ai_trace, written from the AI client choke point.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getTraces, type TraceRow } from '@/lib/admin/portal';
import { AdminPage, Card, Stat } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

function StatusPill({ status }: { status: string }): ReactElement {
  const tone = status === 'ok' ? 'text-[#2f8f4e] bg-[#5EBE62]/12' : status === 'notConfigured' ? 'text-soft bg-warm' : 'text-[#b4372e] bg-[#e5675e]/12';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{status}</span>;
}

function TraceLine({ t }: { t: TraceRow }): ReactElement {
  return (
    <details className="border-b border-line py-2 last:border-0">
      <summary className="flex cursor-pointer items-center gap-2 text-[12px]">
        <StatusPill status={t.status} />
        <span className="font-semibold text-ink">{t.feature}</span>
        <span className="text-faint">{t.operation}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-soft">
          {t.model && <span className="hidden max-w-40 truncate sm:inline">{t.model}</span>}
          {t.retrievalCount != null && t.retrievalCount > 0 && <span title="RAG docs retrieved">{t.retrievalCount} docs</span>}
          {(t.promptTokens || t.completionTokens) ? <span>{(t.promptTokens ?? 0) + (t.completionTokens ?? 0)} tok</span> : null}
          <span className="tabular-nums">{t.latencyMs != null ? `${t.latencyMs}ms` : '-'}</span>
          <span className="tabular-nums text-faint">{new Date(t.ts).toLocaleTimeString('en-US')}</span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 pl-2">
        {t.error && <p className="rounded bg-[#e5675e]/10 px-2 py-1 text-[11px] text-[#b4372e]">{t.error}</p>}
        {t.inputPreview && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Input</p>
            <p className="whitespace-pre-wrap break-words text-[11px] text-soft">{t.inputPreview}</p>
          </div>
        )}
        {t.outputPreview && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Output</p>
            <p className="whitespace-pre-wrap break-words text-[11px] text-soft">{t.outputPreview}</p>
          </div>
        )}
      </div>
    </details>
  );
}

export default async function TracesPage(): Promise<ReactElement> {
  await requireOperator();
  const t = await getTraces(80);
  const errorRate = t.total > 0 ? Math.round((t.errors / Math.max(1, t.byFeature.reduce((a, f) => a + f.calls, 0))) * 100) : 0;

  return (
    <AdminPage title="Agent traces" subtitle="Every AI call the app makes: feature, model, latency, tokens, retrieval, and the input/output. Failures first.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Calls (all time)" value={t.total.toLocaleString('en-US')} />
        <Stat label="Last 24h" value={t.last24h.toLocaleString('en-US')} />
        <Stat label="Error rate (7d)" value={`${errorRate}%`} tone={errorRate > 5 ? 'bad' : errorRate > 0 ? 'warn' : 'good'} />
        <Stat label="Avg latency (7d)" value={`${t.avgLatencyMs.toLocaleString('en-US')}ms`} />
      </div>

      {t.total === 0 ? (
        <Card>
          <p className="py-6 text-center text-[13px] text-faint">
            No traces yet. Every photo scan, text-to-macro, coach chat, plan generation, and embedding will appear here the moment it runs.
          </p>
        </Card>
      ) : (
        <>
          <Card title="By feature (last 7 days)">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="py-1.5 font-semibold">Feature</th>
                    <th className="py-1.5 text-right font-semibold">Calls</th>
                    <th className="py-1.5 text-right font-semibold">Errors</th>
                    <th className="py-1.5 text-right font-semibold">Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  {t.byFeature.map((f) => (
                    <tr key={f.feature} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 font-medium text-ink">{f.feature}</td>
                      <td className="py-1.5 text-right tabular-nums text-soft">{f.calls}</td>
                      <td className={`py-1.5 text-right tabular-nums ${f.errors > 0 ? 'text-[#b4372e]' : 'text-faint'}`}>{f.errors}</td>
                      <td className="py-1.5 text-right tabular-nums text-soft">{f.avgLatencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {t.recentErrors.length > 0 && (
            <Card title={`Recent errors (${t.recentErrors.length})`}>
              {t.recentErrors.map((r) => <TraceLine key={r.id} t={r} />)}
            </Card>
          )}

          <Card title="Recent calls">
            {t.recent.map((r) => <TraceLine key={r.id} t={r} />)}
          </Card>
        </>
      )}
    </AdminPage>
  );
}
