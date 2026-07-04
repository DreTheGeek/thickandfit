// System health: live service checks + data-volume sanity + automation heartbeat (from getSystemHealth).
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getSystemHealth } from '@/lib/coach/system-health';
import { AdminPage, Card, Row, Dot } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function HealthPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const h = ctx.companyId ? await getSystemHealth(ctx.companyId) : null;
  const isUp = (status: string): boolean => status === 'operational' || status === 'configured';

  return (
    <AdminPage title="System health" subtitle="Live checks against the database, storage, and integrations.">
      {!h ? (
        <Card>No company context.</Card>
      ) : (
        <>
          <Card title="Services">
            {h.services.map((s) => (
              <Row
                key={s.key}
                left={<div className="flex items-center gap-2.5"><Dot ok={isUp(s.status)} /><span className="font-medium text-ink">{s.name}</span></div>}
                right={<span className="text-[12px] text-faint">{s.detail}</span>}
              />
            ))}
          </Card>
          <Card title="Data volumes">
            <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {h.data.map((d) => (
                <Row key={d.key} left={<span className="text-soft">{d.label}</span>} right={<span className="font-semibold tabular-nums text-ink">{d.value.toLocaleString('en-US')}</span>} />
              ))}
            </div>
          </Card>
          <Card title="Automation">
            <Row left="GHL last sync" right={<span className="text-[12px] text-soft">{h.automation.ghlLastSyncLabel}</span>} />
            <Row left="Checked at" right={<span className="text-[12px] text-faint">{new Date(h.checkedAtIso).toLocaleString('en-US')}</span>} />
          </Card>
        </>
      )}
    </AdminPage>
  );
}
