// One-way GoHighLevel -> Supabase sync of pipelines + opportunities. Server-only. Shared by the
// in-app "Sync now" action and the scheduled cron route. Idempotent (upsert on ghl ids).
// Ports the hardened .qa-visual/ghl-sync.cjs: ghl_contact_id-primary linking, empty-string->null,
// NaN-guard on money (GHL monetaryValue is dollars -> *100 cents), batch-length pagination.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const BASE = 'https://services.leadconnectorhq.com';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const nn = <T>(v: T | '' | null | undefined): T | null => (v === '' || v == null ? null : v);

export type SyncResult = {
  ok: boolean;
  pipelines: number;
  stages: number;
  opportunities: number;
  linked: number;
  unmatched: number;
  error?: string;
};

type GhlStage = { id: string; name: string };
type GhlPipeline = { id: string; name: string; stages?: GhlStage[] };
type GhlOpp = {
  id: string;
  name?: string | null;
  monetaryValue?: number | null;
  pipelineId?: string | null;
  pipelineStageId?: string | null;
  status?: string | null;
  source?: string | null;
  lostReasonId?: string | null;
  lostReasonName?: string | null;
  assignedTo?: string | null;
  forecastProbability?: number | null;
  contactId?: string | null;
  contact?: { email?: string | null } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastStageChangeAt?: string | null;
  lastStatusChangeAt?: string | null;
};

function ghlHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: '2021-07-28',
    Accept: 'application/json',
  };
}

async function ghlGet(pathname: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${BASE}${pathname}`, { headers: ghlHeaders() });
    if (r.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`GHL ${r.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text) as Record<string, unknown>;
  }
  throw new Error('GHL rate limited');
}

/** Sync GHL pipelines + opportunities into the given company. */
export async function syncGhlPipelines(companyId: string): Promise<SyncResult> {
  const loc = process.env.GHL_LOCATION_ID;
  if (!process.env.GHL_API_TOKEN || !loc) {
    return { ok: false, pipelines: 0, stages: 0, opportunities: 0, linked: 0, unmatched: 0, error: 'ghl_not_configured' };
  }
  const sb = createServiceClient();

  // 1) pipelines + stages
  const pl = (await ghlGet(`/opportunities/pipelines?locationId=${loc}`)) as { pipelines?: GhlPipeline[] };
  const pipes = pl.pipelines ?? [];
  const { data: pr, error: pe } = await sb
    .from('pipelines')
    .upsert(
      pipes.map((p) => ({ company_id: companyId, ghl_pipeline_id: p.id, name: p.name, raw: p })),
      { onConflict: 'company_id,ghl_pipeline_id' },
    )
    .select('id, ghl_pipeline_id');
  if (pe) return { ok: false, pipelines: 0, stages: 0, opportunities: 0, linked: 0, unmatched: 0, error: pe.message };
  const pipeMap = new Map((pr ?? []).map((r) => [r.ghl_pipeline_id, r.id]));

  const stageRows = pipes.flatMap((p) =>
    (p.stages ?? []).map((s, i) => ({ company_id: companyId, pipeline_id: pipeMap.get(p.id), ghl_stage_id: s.id, name: s.name, position: i })),
  );
  const { data: sr, error: se } = await sb
    .from('pipeline_stages')
    .upsert(stageRows, { onConflict: 'company_id,ghl_stage_id' })
    .select('id, ghl_stage_id');
  if (se) return { ok: false, pipelines: pipes.length, stages: 0, opportunities: 0, linked: 0, unmatched: 0, error: se.message };
  const stageMap = new Map((sr ?? []).map((r) => [r.ghl_stage_id, r.id]));

  // 2) all opportunities (batch-length-driven cursor)
  const opps: GhlOpp[] = [];
  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = (await ghlGet(`/opportunities/search?location_id=${loc}&limit=100${cursor}`)) as {
      opportunities?: GhlOpp[];
      meta?: { startAfter?: number; startAfterId?: string };
    };
    const batch = page.opportunities ?? [];
    opps.push(...batch);
    const meta = page.meta ?? {};
    if (batch.length < 100 || !meta.startAfterId) break;
    const next = `&startAfter=${meta.startAfter}&startAfterId=${meta.startAfterId}`;
    if (next === cursor) break;
    cursor = next;
    await sleep(200);
  }

  // 3) contact link maps
  const { data: contacts } = await sb
    .from('contacts')
    .select('id, email, ghl_contact_id')
    .eq('company_id', companyId)
    .limit(20000);
  const emailMap = new Map((contacts ?? []).filter((c) => c.email).map((c) => [String(c.email).toLowerCase(), c.id]));
  const ghlIdMap = new Map((contacts ?? []).filter((c) => c.ghl_contact_id).map((c) => [c.ghl_contact_id, c.id]));

  // 4) map + count
  let linked = 0;
  let unmatched = 0;
  const rows = opps.map((o) => {
    const email = o.contact?.email ? o.contact.email.toLowerCase() : null;
    const contactId = (o.contactId && ghlIdMap.get(o.contactId)) || (email && emailMap.get(email)) || null;
    if (contactId) linked++;
    else unmatched++;
    const n = Number(o.monetaryValue);
    return {
      company_id: companyId,
      contact_id: contactId,
      ghl_opportunity_id: o.id,
      ghl_contact_id: o.contactId ?? null,
      name: o.name ?? null,
      pipeline_id: o.pipelineId ? (pipeMap.get(o.pipelineId) ?? null) : null,
      stage_id: o.pipelineStageId ? (stageMap.get(o.pipelineStageId) ?? null) : null,
      status: ['open', 'won', 'lost', 'abandoned'].includes(o.status ?? '') ? o.status : 'open',
      monetary_value_cents: Number.isFinite(n) ? Math.round(n * 100) : 0,
      forecast_probability: nn(o.forecastProbability),
      source: o.source ?? null,
      lost_reason_id: o.lostReasonId ?? null,
      lost_reason: o.lostReasonName ?? null,
      assigned_to: o.assignedTo ?? null,
      ghl_created_at: nn(o.createdAt),
      ghl_updated_at: nn(o.updatedAt),
      last_stage_change_at: nn(o.lastStageChangeAt),
      last_status_change_at: nn(o.lastStatusChangeAt),
      synced_at: new Date().toISOString(),
    };
  });

  // 5) upsert in batches
  for (let i = 0; i < rows.length; i += 300) {
    const { error } = await sb
      .from('opportunities')
      .upsert(rows.slice(i, i + 300), { onConflict: 'company_id,ghl_opportunity_id' });
    if (error) return { ok: false, pipelines: pipes.length, stages: stageRows.length, opportunities: i, linked, unmatched, error: error.message };
  }

  return { ok: true, pipelines: pipes.length, stages: stageRows.length, opportunities: rows.length, linked, unmatched };
}
