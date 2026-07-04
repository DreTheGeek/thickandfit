// Knowledge base: the RAG corpus behind the AI coach (Stephanie's voice + ingested docs). The
// foundation the FitnessOS knowledge graph builds on once RAG is validated in prod.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { getKnowledge, getGraph } from '@/lib/admin/portal';
import { AdminPage, Card, Stat, Row } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const k = ctx.companyId ? await getKnowledge(ctx.companyId) : null;
  const g = ctx.companyId ? await getGraph(ctx.companyId) : null;

  return (
    <AdminPage title="Knowledge base" subtitle="What the AI coach retrieves from. Her voice + method, embedded for RAG.">
      {!k ? (
        <Card>No data.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Sources" value={String(k.sources.length)} />
            <Stat label="Chunks" value={String(k.totalChunks)} />
            <Stat label="Embedded (RAG-ready)" value={`${k.embedded}/${k.totalChunks}`} tone={k.embedded === k.totalChunks ? 'good' : 'warn'} />
          </div>
          <Card title="Sources">
            {k.sources.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-faint">No knowledge ingested yet.</p>
            ) : (
              k.sources.map((s) => (
                <Row key={s.source} left={<span className="font-medium text-ink">{s.title}</span>} right={<span className="text-[12px] text-soft">{s.chunks} chunk{s.chunks > 1 ? 's' : ''}</span>} />
              ))
            )}
          </Card>
          <Card title="Knowledge graph" action={<Link href="/admin/graph" className="text-[12px] font-semibold text-muted hover:text-ink">Open graph</Link>}>
            {g && g.nodes.length > 0 ? (
              <p className="text-[13px] leading-relaxed text-soft">
                Live: <span className="font-semibold text-ink">{g.nodes.length.toLocaleString('en-US')}</span> entities and{' '}
                <span className="font-semibold text-ink">{g.edges.length.toLocaleString('en-US')}</span> relationships across{' '}
                {g.byType.client ?? 0} clients, their goals, injuries, dietary rules, plans, and most-logged foods, built from the
                migrated intake + food-log data. The AI coach reads a client&apos;s graph neighborhood as grounded facts on every chat.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed text-soft">
                The knowledge graph is built from client intake, plans, and food logs. Open the graph and rebuild it to populate.
              </p>
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
}
