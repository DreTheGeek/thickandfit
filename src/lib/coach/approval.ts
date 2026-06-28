// Approval-queue data layer (PRD-30, WP8). Read helpers over approval_queue. Service client
// (server-only): the coach app reads via the service client which BYPASSES RLS, so the assistant
// draft-inbox MUST filter drafted_by = ctx.userId in code (never rely on RLS to do it). Names are
// joined from profiles at read time.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type QueueStatus = 'pending' | 'approved' | 'rejected';
export type QueueItemType = 'message' | 'meal_plan';

export type QueueRow = {
  id: string;
  itemType: QueueItemType;
  clientId: string;
  clientName: string;
  draftedById: string;
  draftedByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  decisionNote: string | null;
  status: QueueStatus;
  payload: Record<string, unknown>;
  createdAt: string;
};

type QueueRaw = {
  id: string;
  item_type: string;
  client_id: string;
  drafted_by: string;
  approved_by: string | null;
  approved_at: string | null;
  decision_note: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const COLS =
  'id, item_type, client_id, drafted_by, approved_by, approved_at, decision_note, status, payload, created_at';

async function withNames(rows: QueueRaw[]): Promise<QueueRow[]> {
  if (rows.length === 0) return [];
  const sb = createServiceClient();
  const ids = [
    ...new Set(rows.flatMap((r) => [r.client_id, r.drafted_by, r.approved_by]).filter((v): v is string => Boolean(v))),
  ];
  const { data } = await sb.from('profiles').select('id, full_name, email').in('id', ids);
  const names = new Map(
    ((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      (p.full_name || p.email || 'Unknown').trim(),
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    itemType: r.item_type as QueueItemType,
    clientId: r.client_id,
    clientName: names.get(r.client_id) ?? 'Unknown',
    draftedById: r.drafted_by,
    draftedByName: names.get(r.drafted_by) ?? 'Unknown',
    approvedById: r.approved_by,
    approvedByName: r.approved_by ? names.get(r.approved_by) ?? 'Unknown' : null,
    approvedAt: r.approved_at,
    decisionNote: r.decision_note,
    status: r.status as QueueStatus,
    payload: r.payload ?? {},
    createdAt: r.created_at,
  }));
}

// Drafts authored by ONE drafter (the assistant's own inbox). The drafted_by filter is in code on
// purpose: the service client bypasses RLS, so an assistant must never see another assistant's drafts.
export async function listMyDrafts(companyId: string, draftedBy: string): Promise<QueueRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('approval_queue')
    .select(COLS)
    .eq('company_id', companyId)
    .eq('drafted_by', draftedBy)
    .order('created_at', { ascending: false })
    .limit(200);
  return withNames((data ?? []) as QueueRaw[]);
}

// The approver queue: all PENDING drafts across assistants, oldest first (FIFO review).
export async function listPendingQueue(companyId: string): Promise<QueueRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('approval_queue')
    .select(COLS)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(500);
  return withNames((data ?? []) as QueueRaw[]);
}

// Recently decided drafts (approved/rejected), for the approver's history panel.
export async function listDecidedQueue(companyId: string): Promise<QueueRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('approval_queue')
    .select(COLS)
    .eq('company_id', companyId)
    .in('status', ['approved', 'rejected'])
    .order('approved_at', { ascending: false })
    .limit(100);
  return withNames((data ?? []) as QueueRaw[]);
}
