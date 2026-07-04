// Knowledge graph: the operator's map of the whole client base as a living force-directed graph -
// Stephanie at the center, every client hung off her, and each client wired to their goals,
// injuries, dietary rules, plans, and most-logged foods. Built by kg_rebuild() from the migrated
// structured data; this is the FitnessOS knowledge graph, live (not a roadmap card anymore).
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getGraph } from '@/lib/admin/portal';
import { GraphCanvas } from '@/components/admin/graph-canvas';

export const dynamic = 'force-dynamic';

const TYPE_ORDER = ['client', 'plan', 'food', 'injury', 'goal', 'dietary', 'coach'];

export default async function GraphPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const g = ctx.companyId
    ? await getGraph(ctx.companyId)
    : { nodes: [], edges: [], builtAt: null, byType: {}, byRel: {} };
  const built = g.builtAt ? new Date(g.builtAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div className="flex h-full flex-col gap-3 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-tight text-ink">Knowledge graph</h1>
          <p className="mt-0.5 text-[13px] text-soft">
            {g.nodes.length.toLocaleString('en-US')} nodes · {g.edges.length.toLocaleString('en-US')} relationships
            {built ? ` · built ${built}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-soft">
          {TYPE_ORDER.filter((t) => g.byType[t]).map((t) => (
            <span key={t}>
              <span className="font-semibold text-ink">{g.byType[t]}</span> {t}
              {g.byType[t] > 1 && t !== 'coach' ? 's' : ''}
            </span>
          ))}
        </div>
      </div>

      {g.nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-surface">
          <p className="max-w-md text-center text-[13px] text-faint">
            The graph is empty. Click <span className="font-semibold text-soft">Rebuild from client data</span> to build it from
            client intake, meal plans, and food logs.
          </p>
        </div>
      ) : (
        <GraphCanvas nodes={g.nodes} edges={g.edges} />
      )}
    </div>
  );
}
