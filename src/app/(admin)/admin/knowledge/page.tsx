// Knowledge base: the RAG corpus behind the AI coach (Stephanie's voice + ingested docs). The
// foundation the FitnessOS knowledge graph builds on once RAG is validated in prod.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { getKnowledge } from '@/lib/admin/portal';
import { AdminPage, Card, Stat, Row } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const k = ctx.companyId ? await getKnowledge(ctx.companyId) : null;

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
          <Card title="Sources" action={<Link href="/coach/settings/knowledge" className="text-[12px] font-semibold text-muted hover:text-ink">Add / manage</Link>}>
            {k.sources.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-faint">No knowledge ingested yet.</p>
            ) : (
              k.sources.map((s) => (
                <Row key={s.source} left={<span className="font-medium text-ink">{s.title}</span>} right={<span className="text-[12px] text-soft">{s.chunks} chunk{s.chunks > 1 ? 's' : ''}</span>} />
              ))
            )}
          </Card>
          <Card title="Knowledge graph (roadmap)">
            <p className="text-[13px] leading-relaxed text-soft">
              The entity/relationship knowledge graph is Phase 4, gated on RAG being validated in production first (per the FitnessOS architecture doc).
              This page is that foundation: the corpus above is what the graph will be built from. Today the AI coach already retrieves from it
              (Stephanie&apos;s real coaching voice + any docs you add).
            </p>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
