// Connections: which integrations are wired (runtime env check), critical ones first.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getConnections } from '@/lib/admin/portal';
import { AdminPage, Card, Row, Dot } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage(): Promise<ReactElement> {
  await requireOperator();
  const conns = getConnections().sort((a, b) => Number(b.critical) - Number(a.critical) || Number(a.configured) - Number(b.configured));
  const missingCritical = conns.filter((c) => c.critical && !c.configured);

  return (
    <AdminPage title="Connections" subtitle="Third-party services this app depends on. Green = wired in production.">
      {missingCritical.length > 0 && (
        <Card>
          <p className="text-[13px] text-[#B4462F]">
            {missingCritical.length} critical integration{missingCritical.length > 1 ? 's' : ''} not configured: {missingCritical.map((c) => c.label).join(', ')}. The app runs, but these gate a real launch.
          </p>
        </Card>
      )}
      <Card title="Integrations">
        {conns.map((c) => (
          <Row
            key={c.key}
            left={
              <div className="flex items-center gap-2.5">
                <Dot ok={c.configured} />
                <div>
                  <span className="font-medium text-ink">{c.label}</span>
                  {c.critical && <span className="ml-2 rounded-full bg-warm px-1.5 py-0.5 text-[9px] font-semibold uppercase text-soft">critical</span>}
                  <div className="text-[11px] text-faint">{c.note}</div>
                </div>
              </div>
            }
            right={<span className={c.configured ? 'text-[12px] font-semibold text-[#1F7A46]' : 'text-[12px] font-semibold text-[#B4462F]'}>{c.configured ? 'Connected' : 'Not set'}</span>}
          />
        ))}
      </Card>
    </AdminPage>
  );
}
