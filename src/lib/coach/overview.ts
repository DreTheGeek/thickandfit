// Business Overview data layer. Reads the imported CRM (contacts/subscriptions/transactions/tags)
// and returns real, computed business metrics for the coach command center. Service client
// (server-only) so aggregates run regardless of RLS session.
import { createServiceClient } from '@/lib/supabase/service';

export type Bucket = { key: string; count: number };
export type MonthlyRevenue = { month: string; label: string; grossCents: number; coachCents: number };
export type TagStat = { slug: string; label: string; category: string; color: string; count: number };
export type TagGroup = { category: string; tags: TagStat[] };

export type BusinessOverview = {
  mrrCents: number;
  activeClients: number;
  payingCurrent: number;
  atRisk: number;
  churned: number;
  totalClients: number;
  convertedFromLeads: number;
  newThisMonth: number;
  openLeads: number;
  wonLeads: number;
  lostLeads: number;
  winRatePct: number;
  lifetimeGrossCents: number;
  lifetimeCoachCents: number;
  statusBreakdown: Bucket[];
  productBreakdown: Bucket[];
  pipeline: Bucket[];
  lostReasons: Bucket[];
  revenueByMonth: MonthlyRevenue[];
  tagGroups: TagGroup[];
  topTags: TagStat[];
};

const AT_RISK_HEALTH = new Set(['lapsed', 'due-soon/late']);
const AT_RISK_STATUS = new Set(['past_due', 'unpaid']);
const CHURNED_STATUS = new Set(['canceled', 'churned']);
const CATEGORY_ORDER = ['program', 'tier', 'health', 'service', 'lifecycle', 'language', 'special', 'custom'];

function tally(rows: { v: string | null }[]): Bucket[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r.v ?? '').trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export async function getBusinessOverview(companyId: string): Promise<BusinessOverview> {
  const sb = createServiceClient();
  const [subsRes, clientsRes, leadsRes, txnRes, tagRes] = await Promise.all([
    sb
      .from('client_subscriptions')
      .select('status, billing_health, grandfathered_price_cents, product_type, started_at')
      .eq('company_id', companyId),
    sb.from('contacts').select('was_lead').eq('company_id', companyId).eq('type', 'client'),
    sb.from('contacts').select('lead_stage, lost_reason').eq('company_id', companyId).eq('type', 'lead'),
    sb
      .from('monthly_revenue')
      .select('month, gross_cents, coach_cents')
      .eq('company_id', companyId)
      .order('month', { ascending: true }),
    sb.from('contact_tags').select('tag:tags(slug, label, category, color)').eq('company_id', companyId),
  ]);

  type SubRow = {
    status: string | null;
    billing_health: string | null;
    grandfathered_price_cents: number | null;
    product_type: string | null;
    started_at: string | null;
  };
  const subs = (subsRes.data ?? []) as SubRow[];
  const clients = (clientsRes.data ?? []) as { was_lead: boolean | null }[];
  const leads = (leadsRes.data ?? []) as { lead_stage: string | null; lost_reason: string | null }[];
  const months = (txnRes.data ?? []) as { month: string; gross_cents: number | null; coach_cents: number | null }[];
  const tagRows = (tagRes.data ?? []) as {
    tag: { slug: string; label: string; category: string; color: string } | { slug: string; label: string; category: string; color: string }[] | null;
  }[];

  // Subscriptions / clients
  let mrrCents = 0;
  let activeClients = 0;
  let payingCurrent = 0;
  let atRisk = 0;
  let churned = 0;
  let newThisMonth = 0;
  const now = new Date();
  const ymNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (const s of subs) {
    const status = s.status ?? '';
    const health = s.billing_health ?? '';
    if (status === 'active') {
      activeClients += 1;
      mrrCents += Number(s.grandfathered_price_cents ?? 0);
    }
    if (health === 'paying-current') payingCurrent += 1;
    if (AT_RISK_HEALTH.has(health) || AT_RISK_STATUS.has(status)) atRisk += 1;
    if (CHURNED_STATUS.has(status)) churned += 1;
    if (s.started_at && s.started_at.slice(0, 7) === ymNow) newThisMonth += 1;
  }

  const statusBreakdown = tally(subs.map((s) => ({ v: s.status })));
  const productBreakdown = tally(subs.map((s) => ({ v: s.product_type })));
  const totalClients = clients.length;
  const convertedFromLeads = clients.filter((c) => c.was_lead).length;

  // Leads / pipeline
  const pipeline = tally(leads.map((l) => ({ v: l.lead_stage })));
  const lostReasons = tally(leads.map((l) => ({ v: l.lost_reason })));
  const wonLeads = convertedFromLeads + leads.filter((l) => (l.lead_stage ?? '') === 'Won').length;
  const lostLeads = leads.filter((l) => (l.lead_stage ?? '') === 'Lost').length;
  const openLeads = leads.filter((l) => {
    const st = l.lead_stage ?? '';
    return st !== 'Won' && st !== 'Lost';
  }).length;
  const totalEverLeads = leads.length + convertedFromLeads;
  const winRatePct = totalEverLeads > 0 ? Math.round((wonLeads / totalEverLeads) * 100) : 0;

  // Revenue (aggregated in the DB via the monthly_revenue view; avoids PostgREST row caps)
  let lifetimeGrossCents = 0;
  let lifetimeCoachCents = 0;
  const fmtMonth = new Intl.DateTimeFormat('en', { month: 'short' });
  const sortedMonths = [...months].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of sortedMonths) {
    lifetimeGrossCents += Number(m.gross_cents ?? 0);
    lifetimeCoachCents += Number(m.coach_cents ?? 0);
  }
  const revenueByMonth: MonthlyRevenue[] = sortedMonths.slice(-12).map((m) => {
    const ym = m.month.slice(0, 7);
    const [y, mm] = ym.split('-');
    return {
      month: ym,
      label: fmtMonth.format(new Date(Number(y), Number(mm) - 1, 1)),
      grossCents: Number(m.gross_cents ?? 0),
      coachCents: Number(m.coach_cents ?? 0),
    };
  });

  // Tags
  const tagMap = new Map<string, TagStat>();
  for (const row of tagRows) {
    const tag = Array.isArray(row.tag) ? row.tag[0] : row.tag;
    if (!tag) continue;
    const existing = tagMap.get(tag.slug);
    if (existing) existing.count += 1;
    else tagMap.set(tag.slug, { slug: tag.slug, label: tag.label, category: tag.category, color: tag.color, count: 1 });
  }
  const allTags = [...tagMap.values()];
  const topTags = [...allTags].sort((a, b) => b.count - a.count);
  const tagGroups: TagGroup[] = CATEGORY_ORDER.map((category) => ({
    category,
    tags: allTags.filter((t) => t.category === category).sort((a, b) => b.count - a.count),
  })).filter((g) => g.tags.length > 0);

  return {
    mrrCents,
    activeClients,
    payingCurrent,
    atRisk,
    churned,
    totalClients,
    convertedFromLeads,
    newThisMonth,
    openLeads,
    wonLeads,
    lostLeads,
    winRatePct,
    lifetimeGrossCents,
    lifetimeCoachCents,
    statusBreakdown,
    productBreakdown,
    pipeline,
    lostReasons,
    revenueByMonth,
    tagGroups,
    topTags,
  };
}
