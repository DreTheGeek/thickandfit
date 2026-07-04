// Status & crons: scheduled-job health (last run + failures) and the deploy fingerprint.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getCronStatus } from '@/lib/admin/portal';
import { AdminPage, Card, Row, Dot } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default async function StatusPage(): Promise<ReactElement> {
  await requireOperator();
  const crons = await getCronStatus();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const region = process.env.VERCEL_REGION ?? null;
  const env = process.env.VERCEL_ENV ?? 'development';

  return (
    <AdminPage title="Status & crons" subtitle="Scheduled jobs and the running deployment.">
      <Card title="Scheduled jobs (last 7 days)">
        {crons.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">No cron runs logged in the last 7 days.</p>
        ) : (
          crons.map((c) => (
            <Row
              key={c.name}
              left={
                <div className="flex items-center gap-2.5">
                  <Dot ok={c.fails7d === 0} />
                  <div>
                    <span className="font-medium text-ink">{c.name}</span>
                    <div className="text-[11px] text-faint">{c.runs7d} runs · {c.fails7d} failed</div>
                  </div>
                </div>
              }
              right={<span className="text-[12px] text-soft">last {ago(c.lastRun)}</span>}
            />
          ))
        )}
      </Card>
      <Card title="Deployment">
        <Row left="Environment" right={<span className="font-medium capitalize text-ink">{env}</span>} />
        <Row left="Commit" right={<span className="font-mono text-[12px] text-soft">{commit ? commit.slice(0, 8) : 'n/a'}</span>} />
        <Row left="Region" right={<span className="text-[12px] text-soft">{region ?? 'n/a'}</span>} />
      </Card>
    </AdminPage>
  );
}
