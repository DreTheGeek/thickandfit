'use server';
// Operator knowledge-graph actions. Rebuild re-runs the deterministic kg_rebuild() over the migrated
// structured data (intake, plans, food logs). Internal ops tool, English-only.
import { revalidatePath } from 'next/cache';
import { requireOperator } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export type RebuildResult = { ok: boolean; nodes?: number; edges?: number; error?: string };

export async function rebuildGraphAction(): Promise<RebuildResult> {
  const ctx = await requireOperator();
  if (!ctx.companyId) return { ok: false, error: 'no company' };
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('kg_rebuild', { p_company: ctx.companyId });
  if (error) {
    console.error('rebuildGraphAction:', error.message);
    return { ok: false, error: error.message };
  }
  const res = (data ?? {}) as { nodes?: number; edges?: number };
  revalidatePath('/admin/graph');
  return { ok: true, nodes: res.nodes, edges: res.edges };
}
