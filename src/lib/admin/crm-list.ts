import 'server-only';
// Admin CRM list aggregator: reads public.contacts (0013) — the unified home for Lenus imports,
// waitlist syncs, and app signups — and returns everything /admin/crm/contacts renders in one
// call. Head-only counts for KPIs, one bounded fetch for the source + stage histograms, and a
// filtered page fetch for the table. Every query pins company_id from the caller. Safe defaults
// on unreachable DB: return zeros + empty page so the page still renders.
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

export const PAGE_SIZE = 50;

// Cap the histogram scan so a runaway contacts table can never OOM the page. Stephanie's tenant
// is ~500 rows today; 25k is generous headroom and still cheap to aggregate in JS.
const HISTOGRAM_CAP = 25000;

const FiltersSchema = z.object({
  q: z.string().trim().min(1).max(80).optional().nullable(),
  source: z.string().trim().min(1).max(40).optional().nullable(),
  stage: z.string().trim().min(1).max(40).optional().nullable(),
  product: z.string().trim().min(1).max(60).optional().nullable(),
  lang: z.enum(['en', 'es']).optional().nullable(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});

export type CrmFiltersInput = Record<string, string | string[] | undefined>;
export type CrmFilters = {
  q: string | null;
  source: string | null;
  stage: string | null;
  product: string | null;
  lang: 'en' | 'es' | null;
  page: number;
};

/** Parse + sanitize raw searchParams into typed filters. Wraps Zod so an out-of-range param
 *  degrades to the default instead of crashing the page. */
export function parseCrmFilters(raw: CrmFiltersInput): CrmFilters {
  const flatten = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const parsed = FiltersSchema.safeParse({
    q: flatten(raw.q) || null,
    source: flatten(raw.source) || null,
    stage: flatten(raw.stage) || null,
    product: flatten(raw.product) || null,
    lang: flatten(raw.lang) || null,
    page: flatten(raw.page) || 1,
  });
  if (!parsed.success) {
    return { q: null, source: null, stage: null, product: null, lang: null, page: 1 };
  }
  return {
    q: parsed.data.q ?? null,
    source: parsed.data.source ?? null,
    stage: parsed.data.stage ?? null,
    product: parsed.data.product ?? null,
    lang: parsed.data.lang ?? null,
    page: parsed.data.page,
  };
}

export type CrmContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: string;
  lifecycleStage: string;
  productType: string | null;
  language: 'en' | 'es' | null;
  createdAt: string;
  lastActivityAt: string; // contacts.updated_at (touched on any CRM update or sync)
};

export type CrmListPage = {
  total: number; // total contacts in the tenant, unfiltered
  filteredTotal: number; // matches the current filter set
  page: number;
  pageSize: number;
  totalPages: number;
  bySource: Record<string, number>;
  byStage: Record<string, number>;
  sourceOptions: string[];
  stageOptions: string[];
  productOptions: string[];
  langOptions: Array<'en' | 'es'>;
  rows: CrmContactRow[];
  filters: CrmFilters;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  source: string | null;
  lifecycle_stage: string | null;
  product_type: string | null;
  language: string | null;
  created_at: string;
  updated_at: string | null;
};

type HistogramRow = {
  source: string | null;
  lifecycle_stage: string | null;
  product_type: string | null;
  language: string | null;
};

/** Escape a substring for a Postgres ilike pattern so `%` / `_` from user input stay literal. */
function escapeIlike(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Read everything /admin/crm/contacts renders in one aggregated call. Never throws. */
export async function getCrmContactsPage(
  companyId: string,
  filters: CrmFilters,
): Promise<CrmListPage> {
  const sb = createServiceClient();

  // Base builder factory: every query is pinned to the operator's company_id. Filters that come
  // from the user go through the same builder so the count and the page fetch stay in lockstep.
  const baseFiltered = () => {
    let q = sb.from('contacts').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    if (filters.source) q = q.eq('source', filters.source);
    if (filters.stage) q = q.eq('lifecycle_stage', filters.stage);
    if (filters.product) q = q.eq('product_type', filters.product);
    if (filters.lang) q = q.eq('language', filters.lang);
    if (filters.q) {
      const pat = `%${escapeIlike(filters.q)}%`;
      q = q.or(`email.ilike.${pat},first_name.ilike.${pat},last_name.ilike.${pat}`);
    }
    return q;
  };

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const rowsQuery = (() => {
    let q = sb
      .from('contacts')
      .select(
        'id, first_name, last_name, email, source, lifecycle_stage, product_type, language, created_at, updated_at',
      )
      .eq('company_id', companyId);
    if (filters.source) q = q.eq('source', filters.source);
    if (filters.stage) q = q.eq('lifecycle_stage', filters.stage);
    if (filters.product) q = q.eq('product_type', filters.product);
    if (filters.lang) q = q.eq('language', filters.lang);
    if (filters.q) {
      const pat = `%${escapeIlike(filters.q)}%`;
      q = q.or(`email.ilike.${pat},first_name.ilike.${pat},last_name.ilike.${pat}`);
    }
    return q.order('updated_at', { ascending: false, nullsFirst: false }).range(from, to);
  })();

  const [totalRes, filteredRes, rowsRes, histoRes] = await Promise.all([
    sb.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    baseFiltered(),
    rowsQuery,
    // KPI histograms scan the tenant unfiltered so the KPIs match the source-of-truth counts
    // regardless of what filter the operator has applied. Bounded to HISTOGRAM_CAP so the query
    // is cheap even if the tenant ever grows past that (we'd upgrade to a materialized view then).
    sb
      .from('contacts')
      .select('source, lifecycle_stage, product_type, language')
      .eq('company_id', companyId)
      .limit(HISTOGRAM_CAP),
  ]);

  const total = totalRes.count ?? 0;
  const filteredTotal = filteredRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const bySource: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const productSet = new Set<string>();
  const langSet = new Set<'en' | 'es'>();
  for (const r of (histoRes.data ?? []) as HistogramRow[]) {
    const src = r.source ?? '(unknown)';
    bySource[src] = (bySource[src] ?? 0) + 1;
    const stg = r.lifecycle_stage ?? '(unknown)';
    byStage[stg] = (byStage[stg] ?? 0) + 1;
    if (r.product_type) productSet.add(r.product_type);
    if (r.language === 'en' || r.language === 'es') langSet.add(r.language);
  }

  const rows: CrmContactRow[] = ((rowsRes.data ?? []) as ContactRow[]).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    source: r.source ?? '(unknown)',
    lifecycleStage: r.lifecycle_stage ?? '(unknown)',
    productType: r.product_type,
    language: r.language === 'en' || r.language === 'es' ? r.language : null,
    createdAt: r.created_at,
    lastActivityAt: r.updated_at ?? r.created_at,
  }));

  return {
    total,
    filteredTotal,
    page: Math.min(filters.page, totalPages),
    pageSize: PAGE_SIZE,
    totalPages,
    bySource,
    byStage,
    sourceOptions: Object.keys(bySource).sort(),
    stageOptions: Object.keys(byStage).sort(),
    productOptions: Array.from(productSet).sort(),
    langOptions: Array.from(langSet).sort() as Array<'en' | 'es'>,
    rows,
    filters,
  };
}
