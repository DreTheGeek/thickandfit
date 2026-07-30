import 'server-only';
// Consent viewer aggregator (Fort Knox evidence surface). Reads consent_captures + profiles for
// the current tenant, returns three KPIs (signups w/ consent 7d, billing consent 7d, health-ack
// rate across active members) plus a filtered row list (by email search + consent_type).
//
// Never throws: on DB error every field falls back to zero / empty so /admin/security/consent
// still renders. Every query is scoped to the caller's companyId, no cross-tenant leaks.
import { createServiceClient } from '@/lib/supabase/service';
import { MEMBER_ROLES } from '@/lib/auth/session';

export type ConsentRow = {
  id: string;
  createdAt: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  consentType: string;
  version: string;
  accepted: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

export type ConsentSnapshot = {
  kpi: {
    signupsWithConsent7d: number;   // distinct user_id w/ terms_of_service|privacy_policy|signup in 7d
    billingConsents7d: number;      // count of billing|auto_renewal_disclosure captures in 7d
    healthAckPct: number;           // profiles.health_ack_at NOT NULL / total members (subscriber+free)
    healthAckAcked: number;
    healthAckTotal: number;
  };
  rows: ConsentRow[];
  totalMatching: number;   // total rows matching filter (rows[] is capped for render)
  distinctTypes: string[]; // for the filter dropdown
};

export type ConsentFilters = {
  q?: string;              // email contains (case-insensitive)
  type?: string;           // exact consent_type match
  limit?: number;          // row cap (default 200)
};

const ROW_CAP_DEFAULT = 200;
const SIGNUP_TYPES = ['terms_of_service', 'privacy_policy', 'signup'] as const;
const BILLING_TYPES = ['billing', 'auto_renewal_disclosure'] as const;
// Was a local copy of the same two roles. Now imported from session.ts so "who is a member" has one
// definition: a fifth role added later must not silently mean one thing here and another in the
// onboarding guard.

export async function getConsentSnapshot(
  companyId: string | null,
  filters: ConsentFilters = {},
): Promise<ConsentSnapshot> {
  if (!companyId) return empty();
  const sb = createServiceClient();
  const nowMs = Date.now();
  const weekAgoIso = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cap = filters.limit ?? ROW_CAP_DEFAULT;

  try {
    // Head-only counts first; row fetch is a separate query joined against profiles for email.
    const [signupRes, billingRes, ackedRes, totalMembersRes, distinctRes] = await Promise.all([
      sb
        .from('consent_captures')
        .select('user_id', { count: 'exact' })
        .eq('company_id', companyId)
        .in('consent_type', SIGNUP_TYPES as unknown as string[])
        .gte('created_at', weekAgoIso),
      sb
        .from('consent_captures')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('consent_type', BILLING_TYPES as unknown as string[])
        .gte('created_at', weekAgoIso),
      sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('role', MEMBER_ROLES as unknown as string[])
        .not('health_ack_at', 'is', null),
      sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('role', MEMBER_ROLES as unknown as string[]),
      // Small select to build the filter dropdown; capped so we don't scan the whole table.
      sb
        .from('consent_captures')
        .select('consent_type')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const signupRows = (signupRes.data ?? []) as { user_id: string }[];
    const distinctSignupUsers = new Set(signupRows.map((r) => r.user_id)).size;
    const billingCount = billingRes.count ?? 0;
    const acked = ackedRes.count ?? 0;
    const totalMembers = totalMembersRes.count ?? 0;
    const healthAckPct = totalMembers === 0 ? 0 : Math.round((acked / totalMembers) * 100);

    const distinctSet = new Set<string>();
    for (const r of (distinctRes.data ?? []) as { consent_type: string }[]) {
      if (r.consent_type) distinctSet.add(r.consent_type);
    }
    const distinctTypes = Array.from(distinctSet).sort();

    // Row fetch. Filter by type first (indexed cheap), then by email if provided (requires join
    // via IN on profile ids). No PostgREST embed for profiles because RLS on profiles + service
    // client mixing embeds is fussy; two-step keeps types honest.
    let rowQuery = sb
      .from('consent_captures')
      .select('id, created_at, user_id, consent_type, consent_version, accepted, ip_address, user_agent', {
        count: 'exact',
      })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(cap);
    if (filters.type) rowQuery = rowQuery.eq('consent_type', filters.type);

    // If email search present, resolve matching profile ids first and restrict rowQuery to them.
    if (filters.q && filters.q.trim().length > 0) {
      const q = filters.q.trim();
      const { data: matched } = await sb
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .ilike('email', `%${q}%`)
        .limit(500);
      const ids = ((matched ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) {
        return {
          kpi: {
            signupsWithConsent7d: distinctSignupUsers,
            billingConsents7d: billingCount,
            healthAckPct,
            healthAckAcked: acked,
            healthAckTotal: totalMembers,
          },
          rows: [],
          totalMatching: 0,
          distinctTypes,
        };
      }
      rowQuery = rowQuery.in('user_id', ids);
    }

    const rowRes = await rowQuery;
    const rawRows = (rowRes.data ?? []) as {
      id: string;
      created_at: string;
      user_id: string;
      consent_type: string;
      consent_version: string;
      accepted: boolean;
      ip_address: string | null;
      user_agent: string | null;
    }[];

    // Hydrate emails in a batched second query (avoids N+1 and keeps types clean).
    const userIds = Array.from(new Set(rawRows.map((r) => r.user_id)));
    const emailByUser = new Map<string, { email: string | null; fullName: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await sb
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      for (const p of (profs ?? []) as { id: string; email: string | null; full_name: string | null }[]) {
        emailByUser.set(p.id, { email: p.email, fullName: p.full_name });
      }
    }

    const rows: ConsentRow[] = rawRows.map((r) => {
      const prof = emailByUser.get(r.user_id);
      return {
        id: r.id,
        createdAt: r.created_at,
        userId: r.user_id,
        email: prof?.email ?? null,
        fullName: prof?.fullName ?? null,
        consentType: r.consent_type,
        version: r.consent_version,
        accepted: r.accepted,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
      };
    });

    return {
      kpi: {
        signupsWithConsent7d: distinctSignupUsers,
        billingConsents7d: billingCount,
        healthAckPct,
        healthAckAcked: acked,
        healthAckTotal: totalMembers,
      },
      rows,
      totalMatching: rowRes.count ?? rows.length,
      distinctTypes,
    };
  } catch {
    // Never break the page. Ops can retry; a DB blip must not gate access to the evidence view.
    return empty();
  }
}

function empty(): ConsentSnapshot {
  return {
    kpi: {
      signupsWithConsent7d: 0,
      billingConsents7d: 0,
      healthAckPct: 0,
      healthAckAcked: 0,
      healthAckTotal: 0,
    },
    rows: [],
    totalMatching: 0,
    distinctTypes: [],
  };
}
