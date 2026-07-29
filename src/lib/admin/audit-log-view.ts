import 'server-only';
// Read-model for /admin/security/audit-log. One aggregator, one page.
// Reads public.audit_log (schema in 0001_foundation): id, company_id, user_id, entity_type,
// entity_id, action, previous_state, new_state, created_at. logCoachAction (src/lib/coach/audit.ts)
// writes this table on every coach mutation, and DB triggers (audit_trigger_func) write on any
// INSERT/UPDATE/DELETE against companies/profiles/etc. Every read here is scoped by company_id
// so a leak across tenants is impossible even if the table's RLS is bypassed (service client).
//
// Note on ip_address / user_agent: the current schema does not carry these columns; the row shape
// returns null for both so the UI can render "-" today and light up automatically once/if the
// schema is extended. Not adding a migration here per the file-list constraint.
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const PAGE_SIZE = 100;
const FILTER_LOOKBACK_ROWS = 2000; // rows scanned to build the actor/action/entity dropdowns.

// Any action label containing one of these tokens is counted as destructive on the KPI tile.
// TG_OP writes 'DELETE' (uppercase) from the DB trigger; coach code writes lowercase verbs.
const DESTRUCTIVE_TOKENS = ['delete', 'revoke', 'refund'] as const;

export type AuditKpis = {
  actions24h: number;
  actions7d: number;
  uniqueActors7d: number;
  destructive7d: number;
};

export type AuditRow = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
};

export type AuditFilters = {
  actor?: string;
  action?: string;
  entityType?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

export type AuditPageResult = {
  rows: AuditRow[];
  nextCursor: string | null; // ISO of the last row's created_at, or null when no more pages.
};

export type FilterOptions = {
  actors: { id: string; label: string }[];
  actions: string[];
  entityTypes: string[];
};

// Zod at the URL boundary: /admin/security/audit-log?actor=<uuid>&action=<x>&entityType=<x>
// &from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=<iso>. Bad input silently becomes "no filter."
const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDatetime = z.string().datetime();
const filtersSchema = z.object({
  actor: uuid.optional(),
  action: z.string().min(1).max(120).optional(),
  entityType: z.string().min(1).max(120).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  cursor: isoDatetime.optional(),
});

export function parseAuditFilters(
  sp: Record<string, string | string[] | undefined>,
): { filters: AuditFilters; cursor?: string } {
  const flat: Record<string, string | undefined> = {};
  for (const k of ['actor', 'action', 'entityType', 'from', 'to', 'cursor'] as const) {
    const v = sp[k];
    if (typeof v === 'string' && v.length > 0) flat[k] = v;
  }
  const parsed = filtersSchema.safeParse(flat);
  if (!parsed.success) return { filters: {} };
  const { cursor, ...filters } = parsed.data;
  return { filters, cursor };
}

// KPI tiles: destructive count uses postgrest .or() with three ilike patterns so the token match
// stays server-side (a client filter after fetch would misreport if there are more than PAGE_SIZE
// rows in the 7-day window). uniqueActors is set-sized in JS off a small user_id-only projection.
export async function getAuditKpis(companyId: string): Promise<AuditKpis> {
  const sb = createServiceClient();
  const now = Date.now();
  const day = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const week = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const orDestructive = DESTRUCTIVE_TOKENS.map((t) => `action.ilike.%${t}%`).join(',');

  const [c24, c7, actors7, destr7] = await Promise.all([
    sb.from('audit_log').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('created_at', day),
    sb.from('audit_log').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('created_at', week),
    sb.from('audit_log').select('user_id')
      .eq('company_id', companyId).gte('created_at', week).not('user_id', 'is', null).limit(5000),
    sb.from('audit_log').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('created_at', week).or(orDestructive),
  ]);

  const actorRows = (actors7.data ?? []) as { user_id: string | null }[];
  const uniq = new Set<string>();
  for (const r of actorRows) if (r.user_id) uniq.add(r.user_id);

  return {
    actions24h: c24.count ?? 0,
    actions7d: c7.count ?? 0,
    uniqueActors7d: uniq.size,
    destructive7d: destr7.count ?? 0,
  };
}

// Dropdown options derived from the recent slice of the log. Postgrest can't DISTINCT for us,
// so we scan up to FILTER_LOOKBACK_ROWS most-recent rows and dedupe. This keeps the query small
// even on a huge log; older-only values just drop out of the dropdown, which is fine.
export async function getAuditFilterOptions(companyId: string): Promise<FilterOptions> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('audit_log')
    .select('user_id, action, entity_type')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(FILTER_LOOKBACK_ROWS);

  const rows = (data ?? []) as { user_id: string | null; action: string; entity_type: string }[];
  const userIds = new Set<string>();
  const actions = new Set<string>();
  const entityTypes = new Set<string>();
  for (const r of rows) {
    if (r.user_id) userIds.add(r.user_id);
    if (r.action) actions.add(r.action);
    if (r.entity_type) entityTypes.add(r.entity_type);
  }

  let actors: { id: string; label: string }[] = [];
  if (userIds.size > 0) {
    const { data: profs } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(userIds));
    const rowsP = (profs ?? []) as { id: string; full_name: string | null; email: string | null }[];
    actors = rowsP
      .map((p) => ({
        id: p.id,
        label: (p.full_name?.trim() || p.email || p.id.slice(0, 8)) as string,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    actors,
    actions: Array.from(actions).sort((a, b) => a.localeCompare(b)),
    entityTypes: Array.from(entityTypes).sort((a, b) => a.localeCompare(b)),
  };
}

// Cursor pagination: rows come back created_at DESC; the next-page cursor is the last row's
// created_at. Next page filter is `created_at < cursor`. Ties on created_at (same microsecond)
// could theoretically drop a row across the boundary; audit_log rows are timestamped by default
// now() and we sort at microsecond precision, so this is acceptable for an ops log.
export async function listAuditPage(
  companyId: string,
  filters: AuditFilters,
  cursor?: string,
): Promise<AuditPageResult> {
  const sb = createServiceClient();

  let q = sb
    .from('audit_log')
    .select('id, created_at, user_id, action, entity_type, entity_id, previous_state, new_state')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (filters.actor) q = q.eq('user_id', filters.actor);
  if (filters.action) q = q.eq('action', filters.action);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.from) q = q.gte('created_at', `${filters.from}T00:00:00.000Z`);
  if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59.999Z`);
  if (cursor) q = q.lt('created_at', cursor);

  const { data } = await q;
  const raw = (data ?? []) as {
    id: string;
    created_at: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    previous_state: unknown;
    new_state: unknown;
  }[];

  // Batch-hydrate actor names / emails in one round-trip. Missing profile => actor label falls
  // back to a short id, so a purged user still renders instead of blanking the row.
  const actorIds = Array.from(new Set(raw.map((r) => r.user_id).filter((x): x is string => !!x)));
  const actorById = new Map<string, { name: string | null; email: string | null }>();
  if (actorIds.length > 0) {
    const { data: profs } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    for (const p of (profs ?? []) as {
      id: string; full_name: string | null; email: string | null;
    }[]) {
      actorById.set(p.id, { name: p.full_name, email: p.email });
    }
  }

  const rows: AuditRow[] = raw.map((r) => {
    const prof = r.user_id ? actorById.get(r.user_id) ?? null : null;
    return {
      id: r.id,
      createdAt: r.created_at,
      actorId: r.user_id,
      actorName: prof?.name ?? null,
      actorEmail: prof?.email ?? null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      // Not in schema today; the row shape holds the slot so the UI keeps working when it lands.
      ipAddress: null,
      userAgent: null,
      before: r.previous_state ?? null,
      after: r.new_state ?? null,
    };
  });

  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].createdAt : null;
  return { rows, nextCursor };
}

export const AUDIT_LOG_PAGE_SIZE = PAGE_SIZE;
