// Leads pipeline server data layer. Reads the GHL-synced opportunities (+ embedded contact/tags),
// scoped per pipeline, then groups into stage columns and computes KPIs in memory. company_id is
// pinned by the caller from requireCoach ctx. Pure types live in leads-types.ts (re-exported).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { pipelineSlug, toLeadStatus } from '@/lib/coach/lead-standing';
import type { Bucket, TagLite } from '@/lib/coach/clients-types';
import {
  COLUMN_CARD_CAP,
  type LeadCardRow,
  type LeadDetail,
  type LeadFilters,
  type LeadTimelineEntry,
  type PipelineBoard,
  type PipelineMeta,
  type StageColumn,
} from '@/lib/coach/leads-types';

export * from '@/lib/coach/leads-types';

/** Most recent opportunity sync timestamp (for the "last synced" label). */
export async function getLastSync(companyId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('opportunities')
    .select('synced_at')
    .eq('company_id', companyId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.synced_at as string | undefined) ?? null;
}

type TagJoin = { tag: TagLite | TagLite[] | null };
type ContactEmbed = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  owner: string | null;
  language: string | null;
  contact_tags: TagJoin[] | null;
} | null;
type OppRaw = {
  id: string;
  name: string | null;
  monetary_value_cents: number | null;
  status: string | null;
  stage_id: string | null;
  source: string | null;
  assigned_to: string | null;
  last_stage_change_at: string | null;
  created_at: string | null;
  contact: ContactEmbed | ContactEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '') || name[0] || '?').toUpperCase();
}
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86400000));
}
function tally(rows: { key: string | null }[]): Bucket[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.key) continue;
    m.set(r.key, (m.get(r.key) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function mapCard(o: OppRaw, stageName: string): LeadCardRow {
  const c = one(o.contact);
  const name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || o.name || '' : o.name || '';
  const tags: TagLite[] = (c?.contact_tags ?? []).map((t) => one(t.tag)).filter((t): t is TagLite => t != null);
  return {
    id: o.id,
    name,
    initials: initialsOf(name || '?'),
    contactId: c?.id ?? null,
    email: c?.email ?? null,
    phone: c?.phone ?? null,
    valueCents: o.monetary_value_cents,
    currency: 'USD',
    status: toLeadStatus(o.status),
    stageId: o.stage_id,
    stageName,
    source: o.source,
    owner: c?.owner ?? o.assigned_to ?? null,
    daysInStage: daysSince(o.last_stage_change_at),
    tags,
    createdAt: o.created_at,
  };
}

const OPP_SELECT =
  'id, name, monetary_value_cents, status, stage_id, source, assigned_to, last_stage_change_at, created_at, ' +
  'contact:contacts(id, first_name, last_name, email, phone, owner, language, contact_tags(tag:tags(slug, label, category, color)))';

export async function getPipelineBoard(companyId: string, filters: LeadFilters): Promise<PipelineBoard> {
  const sb = createServiceClient();
  const { data: pipeData, error: pipeErr } = await sb
    .from('pipelines')
    .select('id, name')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  if (pipeErr) throw new Error(`getPipelineBoard pipelines: ${pipeErr.message}`);
  const pipelines: PipelineMeta[] = ((pipeData ?? []) as { id: string; name: string }[]).map((p) => ({
    id: p.id,
    name: p.name,
    slug: pipelineSlug(p.name),
  }));
  const active = pipelines.find((p) => p.slug === filters.pipeline) ?? pipelines[0];
  const activeSlug = active?.slug ?? 'marketing';

  if (!active) {
    return { pipelines, activeSlug, columns: [], shownCount: 0, kpis: { open: 0, won: 0, lost: 0, total: 0, openValueCents: 0, wonValueCents: 0, winRatePct: 0 }, statusCounts: [], ownerCounts: [], sourceCounts: [] };
  }

  const { data: stageData } = await sb
    .from('pipeline_stages')
    .select('id, name, position')
    .eq('company_id', companyId)
    .eq('pipeline_id', active.id)
    .order('position', { ascending: true });
  const stages = (stageData ?? []) as { id: string; name: string; position: number }[];
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  const { data: oppData, error: oppErr } = await sb
    .from('opportunities')
    .select(OPP_SELECT)
    .eq('company_id', companyId)
    .eq('pipeline_id', active.id)
    .limit(2000);
  if (oppErr) throw new Error(`getPipelineBoard opportunities: ${oppErr.message}`);
  const opps = (oppData ?? []) as unknown as OppRaw[];

  // KPIs over the whole pipeline (status-independent)
  const kpis = opps.reduce(
    (acc, o) => {
      const v = Number(o.monetary_value_cents ?? 0);
      acc.total += 1;
      if (o.status === 'won') {
        acc.won += 1;
        acc.wonValueCents += v;
      } else if (o.status === 'lost') acc.lost += 1;
      else if (o.status !== 'abandoned') {
        acc.open += 1;
        acc.openValueCents += v;
      }
      return acc;
    },
    { open: 0, won: 0, lost: 0, total: 0, openValueCents: 0, wonValueCents: 0, winRatePct: 0 },
  );
  kpis.winRatePct = kpis.won + kpis.lost > 0 ? Math.round((kpis.won / (kpis.won + kpis.lost)) * 100) : 0;

  const statusCounts = tally(opps.map((o) => ({ key: o.status })));
  const ownerCounts = tally(opps.map((o) => ({ key: one(o.contact)?.owner ?? o.assigned_to ?? null })));
  const sourceCounts = tally(opps.map((o) => ({ key: o.source })));

  // The board columns show one status set (default: open). Apply filters.
  const effStatus = filters.status.length ? filters.status : ['open'];
  const q = filters.q.toLowerCase();
  const cards = opps
    .filter((o) => effStatus.includes(o.status ?? 'open'))
    .map((o) => mapCard(o, stageName.get(o.stage_id ?? '') ?? ''))
    .filter((c) => (filters.stage.length ? filters.stage.includes(c.stageId ?? '') : true))
    .filter((c) => (filters.owner.length ? filters.owner.includes(c.owner ?? '') : true))
    .filter((c) => (filters.source.length ? filters.source.includes(c.source ?? '') : true))
    .filter((c) => (filters.tags.length ? filters.tags.some((t) => c.tags.some((tag) => tag.slug === t)) : true))
    .filter((c) => (q ? `${c.name} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q) : true));

  let shownCount = 0;
  const columns: StageColumn[] = stages.map((s) => {
    const colCards = cards.filter((c) => c.stageId === s.id);
    shownCount += colCards.length;
    return {
      id: s.id,
      name: s.name,
      position: s.position,
      cards: colCards.slice(0, COLUMN_CARD_CAP),
      count: colCards.length,
      valueCents: colCards.reduce((a, c) => a + Number(c.valueCents ?? 0), 0),
    };
  });

  return { pipelines, activeSlug, columns, shownCount, kpis, statusCounts, ownerCounts, sourceCounts };
}

export async function getLeadDetail(companyId: string, oppId: string): Promise<LeadDetail | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('opportunities')
    .select(
      'id, name, monetary_value_cents, status, source, lost_reason, forecast_probability, created_at, ghl_updated_at, last_stage_change_at, ghl_contact_id, assigned_to, ' +
        'contact:contacts(id, first_name, last_name, email, phone, owner, language, contact_tags(tag:tags(slug, label, category, color))), ' +
        'stage:pipeline_stages(name), pipeline:pipelines(name)',
    )
    .eq('company_id', companyId)
    .eq('id', oppId)
    .maybeSingle();
  if (error) throw new Error(`getLeadDetail: ${error.message}`);
  if (!data) return null;

  const o = data as unknown as OppRaw & {
    lost_reason: string | null;
    forecast_probability: number | null;
    ghl_updated_at: string | null;
    ghl_contact_id: string | null;
    stage: { name: string } | { name: string }[] | null;
    pipeline: { name: string } | { name: string }[] | null;
  };
  const c = one(o.contact);
  const name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || o.name || '' : o.name || '';
  const tags: TagLite[] = (c?.contact_tags ?? []).map((t) => one(t.tag)).filter((t): t is TagLite => t != null);

  const { data: auditData } = await sb
    .from('opportunity_audit')
    .select('field_name, old_value, new_value, source, changed_at')
    .eq('company_id', companyId)
    .eq('opportunity_id', oppId)
    .order('changed_at', { ascending: false })
    .limit(100);
  const timeline: LeadTimelineEntry[] = ((auditData ?? []) as { field_name: string; old_value: string | null; new_value: string | null; source: string; changed_at: string }[]).map((a) => ({
    field: a.field_name,
    from: a.old_value,
    to: a.new_value,
    source: a.source,
    at: a.changed_at,
  }));

  return {
    id: o.id,
    name,
    initials: initialsOf(name || '?'),
    contactId: c?.id ?? null,
    ghlContactId: o.ghl_contact_id,
    email: c?.email ?? null,
    phone: c?.phone ?? null,
    owner: c?.owner ?? o.assigned_to ?? null,
    language: c?.language ?? null,
    status: toLeadStatus(o.status),
    valueCents: o.monetary_value_cents,
    currency: 'USD',
    pipelineName: one(o.pipeline)?.name ?? null,
    stageName: one(o.stage)?.name ?? null,
    source: o.source,
    lostReason: o.lost_reason,
    forecastProbability: o.forecast_probability,
    createdAt: o.created_at,
    updatedAt: o.ghl_updated_at,
    daysInStage: daysSince(o.last_stage_change_at),
    tags,
    timeline,
  };
}
