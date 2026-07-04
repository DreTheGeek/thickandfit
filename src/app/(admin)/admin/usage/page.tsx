// AI usage & spend: 30-day rollup by feature + scan volume + rate-limit hits.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getUsage } from '@/lib/admin/portal';
import { AdminPage, Card, Stat, Row } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function UsagePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const u = ctx.companyId ? await getUsage(ctx.companyId) : null;
  const usd = (c: number): string => `$${(c / 100).toFixed(2)}`;
  const k = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <AdminPage title="AI usage & spend" subtitle="OpenRouter/model usage over the last 30 days. Metered per call.">
      {!u ? (
        <Card>No data.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="AI calls (30d)" value={k(u.total.calls)} />
            <Stat label="Spend (30d)" value={usd(u.total.costCents)} />
            <Stat label="Tokens (30d)" value={k(u.total.tokens)} />
            <Stat label="Rate-limit hits (24h)" value={String(u.rateHits24h)} tone={u.rateHits24h > 50 ? 'warn' : undefined} />
          </div>
          <Card title="By feature (30 days)">
            {u.byFeature.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-faint">No AI usage logged yet (needs OPENROUTER_API_KEY + real traffic).</p>
            ) : (
              u.byFeature.map((f) => (
                <Row
                  key={f.feature}
                  left={<span className="font-medium capitalize text-ink">{f.feature.replace(/[-_]/g, ' ')}</span>}
                  right={
                    <span className="text-[12px] text-soft">
                      {k(f.calls)} calls · {k(f.promptTokens + f.completionTokens)} tok · <span className="font-semibold text-ink">{usd(f.costCents)}</span>
                    </span>
                  }
                />
              ))
            )}
          </Card>
          <Card title="Photo scans (7 days)">
            <Row left="Scans processed" right={<span className="font-semibold text-ink">{u.scans7d}</span>} />
            <p className="pt-2 text-[11px] text-faint">Watch tier caps here as volume grows: OpenRouter spend, Gemini free-tier limits, Supabase edge invocations.</p>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
