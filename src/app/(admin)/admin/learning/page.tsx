// AI Learning: proof the system is learning + growing - knowledge corpus growth, the correction
// signal (portion training data), scan volume, and insights generated.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getLearning } from '@/lib/admin/portal';
import { AdminPage, Card, Stat, Row } from '@/components/admin/ui';
import { VolumeChart } from '@/components/admin/volume-chart';

export const dynamic = 'force-dynamic';

export default async function LearningPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const l = ctx.companyId ? await getLearning(ctx.companyId) : null;

  return (
    <AdminPage title="AI learning & growth" subtitle="How the system is getting smarter: knowledge growing, corrections teaching it, insights generated.">
      {!l ? (
        <Card>No data.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Knowledge chunks" value={l.knowledge.chunks.toLocaleString('en-US')} sub={`${l.knowledge.sources} sources`} />
            <Stat label="Added this week" value={`+${l.knowledge.addedThisWeek}`} tone={l.knowledge.addedThisWeek > 0 ? 'good' : undefined} />
            <Stat label="Corrections (training signal)" value={l.corrections.total.toLocaleString('en-US')} sub={`${l.corrections.last30} in 30d`} />
            <Stat label="Insights generated" value={l.insights.total.toLocaleString('en-US')} sub={`${l.insights.last7} this week`} />
          </div>

          <Card title="Knowledge base growth (last 30 days)">
            <VolumeChart data={l.knowledge.growth.map((g) => ({ day: g.day, requests: g.count, errors: 0 }))} />
            <p className="mt-2 text-[12px] text-soft">
              The AI coach retrieves from this corpus live - {l.knowledge.chunks} chunks across {l.knowledge.sources} sources (incl. Stephanie&apos;s real coaching voice).
              Add sources from the coach Knowledge Base; they&apos;re used on the next chat with no redeploy.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="Photo-scan volume">
              <Row left="Scans processed (all time)" right={<span className="font-semibold text-ink">{l.scans.total}</span>} />
              <Row left="Scans this week" right={<span className="font-semibold text-ink">{l.scans.last7}</span>} />
              <Row left="Corrected by user (learning)" right={<span className="font-semibold text-ink">{l.scans.withCorrection}</span>} />
              <p className="pt-2 text-[11px] text-faint">Every correction becomes supervised training data for portion estimation - the hardest problem in the category, and the moat.</p>
            </Card>
            <Card title="Most-corrected foods">
              {l.corrections.topFoods.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-faint">No corrections yet. They accumulate as members re-portion scanned foods.</p>
              ) : l.corrections.topFoods.map((f, i) => (
                <Row key={i} left={<span className="capitalize text-soft">{f.name}</span>} right={<span className="font-semibold text-ink">{f.n}</span>} />
              ))}
            </Card>
          </div>

          <Card title="How it keeps growing">
            <ul className="list-inside list-disc space-y-1 text-[13px] leading-relaxed text-soft">
              <li><strong>Voice corpus:</strong> Stephanie&apos;s real coaching messages are embedded, so the AI answers in her voice - re-runnable as she sends more.</li>
              <li><strong>Correction loop:</strong> every re-portioned scan writes a delta to ai_inferences, teaching the food matcher.</li>
              <li><strong>Per-client intake:</strong> 265 migrated clients&apos; goals/injuries/dietary now feed plan-gen + chat as hard constraints.</li>
              <li><strong>Nightly insights:</strong> the insights cron reads each member&apos;s recent logs and writes a personalized read.</li>
            </ul>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
