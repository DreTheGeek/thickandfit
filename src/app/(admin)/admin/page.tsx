// Admin Overview: the one-glance operator dashboard.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { getOverview } from '@/lib/admin/portal';
import { AdminPage, Card, Stat } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const o = ctx.companyId ? await getOverview(ctx.companyId) : null;
  const usd = (c: number): string => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <AdminPage title="Overview" subtitle="Everything you run from here. Live from the database + integrations.">
      {!o ? (
        <Card>No company context.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Members" value={String(o.members)} />
            <Stat label="Clients (CRM)" value={String(o.clients)} />
            <Stat label="Active subs" value={String(o.activeSubs)} />
            <Stat label="MRR" value={usd(o.mrrCents)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Scans (7d)" value={String(o.scans7d)} />
            <Stat label="Open tickets" value={String(o.openTickets)} tone={o.openTickets > 0 ? 'warn' : 'good'} />
            <Stat label="Cron fails (7d)" value={String(o.cronFails7d)} tone={o.cronFails7d > 0 ? 'bad' : 'good'} />
            <Stat label="Critical integrations missing" value={String(o.connectionsMissing)} tone={o.connectionsMissing > 0 ? 'bad' : 'good'} />
          </div>
          <Card title="Jump to">
            <div className="flex flex-wrap gap-2">
              {[
                ['System health', '/admin/health'],
                ['Connections', '/admin/connections'],
                ['AI usage & spend', '/admin/usage'],
                ['Status & crons', '/admin/status'],
                ['Support tickets', '/admin/support'],
                ['Knowledge base', '/admin/knowledge'],
                ['Launch QA board', '/admin/qa'],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="tf-press rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
