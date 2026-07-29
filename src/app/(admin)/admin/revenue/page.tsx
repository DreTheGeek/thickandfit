// Admin revenue dashboard. Single source of truth for "how the company is actually doing" — MRR,
// active subscribers, trials, churn, ARPU. Reads BOTH billing tables (native Stripe + legacy CRM)
// via the same UNION reconciliation the coach's billing-renewals surface uses, so a member who
// exists in both tables never inflates the count.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { getRevenueMetrics, type ChurnRow, type RevenueMetrics } from '@/lib/admin/revenue-metrics';

export const dynamic = 'force-dynamic';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT = new Intl.NumberFormat('en-US');

export default async function AdminRevenuePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const m: RevenueMetrics = ctx.companyId
    ? await getRevenueMetrics(ctx.companyId)
    : emptyMetrics();

  if (!m.hasAnyData) {
    return (
      <AdminPage title="Revenue" subtitle="MRR, trials, churn, ARPU. Reads native Stripe + imported CRM subs.">
        <Card>
          <p className="text-[13px] text-muted">No subscriptions yet - Stripe not armed.</p>
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Revenue" subtitle="MRR, trials, churn, ARPU. Native Stripe + imported CRM subs, deduped.">
      <Card title="Live revenue">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Active MRR" value={USD.format(m.mrrCents / 100)} sub="all sources, monthly" tone={m.mrrCents > 0 ? 'good' : undefined} />
          <Stat label="Active subs" value={INT.format(m.activeSubscribers)} sub="status=active" />
          <Stat label="Trials" value={INT.format(m.trials)} sub="status=trialing" />
          <Stat label="New this week" value={INT.format(m.newThisWeek)} sub="last 7d" tone={m.newThisWeek > 0 ? 'good' : undefined} />
          <Stat label="Cancels 30d" value={INT.format(m.cancelsThisMonth)} sub="last 30d" tone={m.cancelsThisMonth > 0 ? 'warn' : undefined} />
          <Stat label="Churn 30d" value={`${m.churnPct30d.toFixed(1)}%`} sub="cancels / (active + cancels)" tone={m.churnPct30d >= 10 ? 'bad' : m.churnPct30d >= 5 ? 'warn' : undefined} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label="ARPU" value={USD_CENTS.format(m.arpuCents / 100)} sub="MRR / active subs" />
        </div>
      </Card>

      <Card title={`Recent churn (${m.recentChurn.length})`}>
        {m.recentChurn.length === 0 ? (
          <p className="text-[13px] text-muted">No cancellations in the last 30 days. Streak intact.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">Member</th>
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold">Tier</th>
                  <th className="pb-2 pr-4 font-semibold text-right">Monthly</th>
                  <th className="pb-2 pr-4 font-semibold">Canceled</th>
                  <th className="pb-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {m.recentChurn.map((r: ChurnRow) => (
                  <tr key={`${r.source}-${r.key}`} className="border-t border-line">
                    <td className="py-2.5 pr-4 text-ink">{r.name}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.email ?? '-'}</td>
                    <td className="py-2.5 pr-4 font-mono text-[12px] text-faint">{r.tier ?? '-'}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink">
                      {r.monthlyAmountCents != null ? USD_CENTS.format(r.monthlyAmountCents / 100) : '-'}
                    </td>
                    <td className="py-2.5 pr-4 text-muted tabular-nums">{fmtDate(r.canceledAt)}</td>
                    <td className="py-2.5">
                      <span className="rounded-full bg-warm px-2.5 py-0.5 text-[11px] font-semibold text-soft">
                        {r.source === 'stripe' ? 'Stripe' : 'Lenus'}
                      </span>
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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emptyMetrics(): RevenueMetrics {
  return {
    mrrCents: 0,
    activeSubscribers: 0,
    trials: 0,
    newThisWeek: 0,
    cancelsThisMonth: 0,
    churnPct30d: 0,
    arpuCents: 0,
    hasAnyData: false,
    recentChurn: [],
  };
}
