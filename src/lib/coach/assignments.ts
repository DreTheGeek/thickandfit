// Coaching-assignments data layer (PRD-30, WP8). Read-only helpers over coaching_assignments: the
// assignment table (assistant <-> client + monthly rate) and the per-assistant payout rollup (count of
// active clients x their rates, tracking only, no Stripe transfer in WP8). Service client (server-only):
// company_id is pinned by the caller from ctx, never from searchParams. Names are joined from profiles
// at read time (the getThreads idiom), never denormalized onto the assignment row.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type AssignmentStatus = 'active' | 'paused' | 'ended';

export type AssignmentRow = {
  id: string;
  assistantId: string;
  assistantName: string;
  clientId: string;
  clientName: string;
  monthlyRateCents: number;
  status: AssignmentStatus;
};

export type PayoutRollup = {
  assistantId: string;
  assistantName: string;
  activeClients: number;
  monthlyPayoutCents: number;
};

export type CoachProfileLite = { id: string; name: string };

type AssignmentRaw = {
  id: string;
  assistant_id: string;
  client_id: string;
  monthly_rate_cents: number;
  status: string;
};

function nameOf(p: { full_name: string | null; email: string | null } | undefined): string {
  if (!p) return 'Unknown';
  return (p.full_name || p.email || 'Unknown').trim();
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const sb = createServiceClient();
  const { data } = await sb.from('profiles').select('id, full_name, email').in('id', unique);
  const rows = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  return new Map(rows.map((p) => [p.id, nameOf(p)]));
}

// All assignments in the tenant (assignment-management table). Approver-scoped: the page guards with
// requireApprover, so the operator sees every assistant's roster here.
export async function listAssignments(companyId: string): Promise<AssignmentRow[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coaching_assignments')
    .select('id, assistant_id, client_id, monthly_rate_cents, status')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as AssignmentRaw[];
  if (rows.length === 0) return [];
  const names = await namesFor(rows.flatMap((r) => [r.assistant_id, r.client_id]));
  return rows.map((r) => ({
    id: r.id,
    assistantId: r.assistant_id,
    assistantName: names.get(r.assistant_id) ?? 'Unknown',
    clientId: r.client_id,
    clientName: names.get(r.client_id) ?? 'Unknown',
    monthlyRateCents: Number(r.monthly_rate_cents ?? 0),
    status: (r.status as AssignmentStatus) ?? 'active',
  }));
}

// AC-3 payout rollup: per assistant, the count of ACTIVE assignments and the summed monthly rate. This
// is the "tracked for payout" figure (no payment execution in WP8).
export async function getPayoutByAssistant(companyId: string): Promise<PayoutRollup[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coaching_assignments')
    .select('assistant_id, monthly_rate_cents')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .limit(2000);
  const rows = (data ?? []) as { assistant_id: string; monthly_rate_cents: number }[];
  const byAssistant = new Map<string, { activeClients: number; monthlyPayoutCents: number }>();
  for (const r of rows) {
    const e = byAssistant.get(r.assistant_id) ?? { activeClients: 0, monthlyPayoutCents: 0 };
    e.activeClients += 1;
    e.monthlyPayoutCents += Number(r.monthly_rate_cents ?? 0);
    byAssistant.set(r.assistant_id, e);
  }
  if (byAssistant.size === 0) return [];
  const names = await namesFor([...byAssistant.keys()]);
  return [...byAssistant.entries()]
    .map(([assistantId, e]) => ({
      assistantId,
      assistantName: names.get(assistantId) ?? 'Unknown',
      activeClients: e.activeClients,
      monthlyPayoutCents: e.monthlyPayoutCents,
    }))
    .sort((a, b) => b.monthlyPayoutCents - a.monthlyPayoutCents);
}

// Internal guard for the assistant draft scope: is this client actively assigned to this assistant?
// Used by submitDraft so an assistant cannot draft for a client they are not assigned to. RLS does not
// help here (service client bypasses it), so this is an explicit query.
export async function isAssignedTo(
  companyId: string,
  assistantId: string,
  clientId: string,
): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coaching_assignments')
    .select('id')
    .eq('company_id', companyId)
    .eq('assistant_id', assistantId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data);
}

// The clients (subscriber profiles) THIS assistant is actively assigned to, for the draft composer's
// recipient picker. Approvers may draft for anyone, so this is only the narrowing list for assistants.
export async function listAssignedClients(
  companyId: string,
  assistantId: string,
): Promise<CoachProfileLite[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coaching_assignments')
    .select('client_id')
    .eq('company_id', companyId)
    .eq('assistant_id', assistantId)
    .eq('status', 'active')
    .limit(500);
  const ids = ((data ?? []) as { client_id: string }[]).map((r) => r.client_id);
  if (ids.length === 0) return [];
  const names = await namesFor(ids);
  return [...new Set(ids)].map((id) => ({ id, name: names.get(id) ?? 'Unknown' }));
}

// Pickers for the assignment-management table: the assistant_coach roster + the subscriber roster.
export async function listAssistants(companyId: string): Promise<CoachProfileLite[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .eq('company_id', companyId)
    .eq('role', 'assistant_coach')
    .order('full_name', { ascending: true })
    .limit(200);
  const rows = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  return rows.map((p) => ({ id: p.id, name: nameOf(p) }));
}

export async function listSubscribers(companyId: string): Promise<CoachProfileLite[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .eq('company_id', companyId)
    .in('role', ['subscriber', 'free'])
    .order('full_name', { ascending: true })
    .limit(1000);
  const rows = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  return rows.map((p) => ({ id: p.id, name: nameOf(p) }));
}
