// System health: live service checks + data-volume sanity + automation heartbeat + deploy info
// (from getSystemHealth), plus the coverage checklist.
//
// This absorbed /coach/health, which was the same getSystemHealth() call rendered twice. The two
// things the coach page had and this one did not (deploy commit/env/region, and the coverage
// checklist) are below, so nothing was lost in the merge.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getSystemHealth } from '@/lib/admin/system-health';
import { AdminPage, Card, Row, Dot } from '@/components/admin/ui';
import { CoverageView } from '@/components/admin/coverage-view';

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
            <Row left="GHL cron schedule" right={<span className="font-mono text-[12px] text-soft">{h.automation.ghlCron}</span>} />
            <Row left="Checked at" right={<span className="text-[12px] text-faint">{new Date(h.checkedAtIso).toLocaleString('en-US')}</span>} />
          </Card>
          <Card title="Deploy">
            <Row left="Environment" right={<span className="text-[12px] capitalize text-soft">{h.deploy.env}</span>} />
            <Row left="Commit" right={<span className="font-mono text-[12px] text-soft">{h.deploy.commit ?? '-'}</span>} />
            <Row left="Region" right={<span className="text-[12px] text-soft">{h.deploy.region ?? '-'}</span>} />
          </Card>
          <Card title="Coverage">
            <p className="mb-4 text-[12px] text-faint">
              What should work, what it connects to, and what action produces what reaction. Keep the
              statuses honest: this doubles as the QA checklist.
            </p>
            <CoverageView />
          </Card>
        </>
      )}
    </AdminPage>
  );
}
