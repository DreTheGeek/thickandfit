import 'server-only';
// Admin subscribers-list: unified query over native Stripe subscriptions (subscriptions + profiles)
// and the imported CRM (client_subscriptions + contacts). Matches the union pattern used by
// src/lib/coach/billing-renewals.ts so a member who signed up in-app AND has a linked contact
// surfaces once, with the native row winning (that's the live source of truth). Server-only.
import { createServiceClient } from '@/lib/supabase/service';

export type SubscriberSource = 'native' | 'crm';

export type SubscriberRow = {
  // Deep link id: profile_id when we have one (the coach /subscribers/[id] page is profile-keyed);
  // for CRM-only contacts we still surface the row but disable the View link (would 404 otherwise).
  linkId: string | null;
  // Stable key for React (unique across the union).
  key: string;
  source: SubscriberSource;
  name: string;
  email: string;
  plan: string | null;                // stripe_price_id (native) or product_type/tier (CRM)
  status: string | null;              // active|trialing|past_due|canceled|unpaid|paused|churned
  mrrCents: number | null;            // 0 when not currently billing
  startedAt: string | null;           // ISO date
  endsAt: string | null;              // next billing / current_period_end (ISO date)
  cancelAt: string | null;            // canceled_at OR ended_at (ISO date)
};

export type SubscribersListResult = {
  rows: SubscriberRow[];
  page: number;
  pageSize: number;
  total: number;                      // rows in the merged, filtered union (post-dedup)
  hasPrev: boolean;
  hasNext: boolean;
};

export type SubscribersListInput = {
  companyId: string;
  q?: string;                         // email/name substring (case-insensitive)
  page?: number;                      // 1-indexed
  pageSize?: number;                  // default 50
};

// Ceiling on rows pulled per source before merge + paginate. Union pagination has to happen in
// memory because Postgres can't page across two tables in one round-trip cheaply; 5k per source
// covers Stephanie's entire book (~256 Lenus + native to date) many times over.
const SOURCE_CEILING = 5000;

type NativeSub = {
  id: string;
  profile_id: string;
  stripe_price_id: string | null;
  status: string | null;
  price_cents: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type CrmContact = {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  client_subscriptions: Array<{
    status: string | null;
    product_type: string | null;
    grandfathered_price_cents: number | null;
    started_at: string | null;
    ended_at: string | null;
    next_billing_date: string | null;
  }> | null;
};

export async function getSubscribersList(input: SubscribersListInput): Promise<SubscribersListResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.max(1, Math.min(200, Math.floor(input.pageSize ?? 50)));
  const q = (input.q ?? '').trim();
  const like = q.length > 0 ? `%${escapeLike(q)}%` : null;

  const sb = createServiceClient();

  // Native Stripe subscriptions, filtered on the joined profile's name/email when a query is set.
  // Supabase's !inner join makes the profile filter actually gate rows (a normal join would return
  // subs with a null profile even when the filter didn't match).
  let nativeQ = sb
    .from('subscriptions')
    .select(
      'id, profile_id, stripe_price_id, status, price_cents, current_period_end, cancel_at_period_end, canceled_at, created_at, profiles!inner ( full_name, email )',
    )
    .eq('company_id', input.companyId)
    .order('created_at', { ascending: false })
    .limit(SOURCE_CEILING);
  if (like) nativeQ = nativeQ.or(`full_name.ilike.${like},email.ilike.${like}`, { referencedTable: 'profiles' });

  // CRM contacts + their (0..1) client_subscription. We keep contacts with no sub too — Stephanie
  // still wants to see a client whose Lenus sub churned but who's on the roster.
  let crmQ = sb
    .from('contacts')
    .select(
      'id, profile_id, first_name, last_name, email, client_subscriptions ( status, product_type, grandfathered_price_cents, started_at, ended_at, next_billing_date )',
    )
    .eq('company_id', input.companyId)
    .eq('type', 'client')
    .limit(SOURCE_CEILING);
  if (like) crmQ = crmQ.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);

  const [nativeRes, crmRes] = await Promise.all([nativeQ, crmQ]);

  const nativeRows = (nativeRes.data ?? []) as unknown as NativeSub[];
  const crmRows = (crmRes.data ?? []) as unknown as CrmContact[];

  // Dedup: profiles that already appear in a CRM row's profile_id AND have a native sub — the
  // native row wins (live billing beats the imported snapshot). Mirror of billing-renewals.ts.
  const nativeProfileIds = new Set<string>(nativeRows.map((r) => r.profile_id));

  const merged: SubscriberRow[] = [];

  for (const n of nativeRows) {
    const status = n.status ?? null;
    const mrrCents = status === 'active' || status === 'trialing' ? Number(n.price_cents ?? 0) : 0;
    const name = (n.profiles?.full_name ?? '').trim() || (n.profiles?.email ?? '').trim() || 'App member';
    merged.push({
      linkId: n.profile_id,
      key: `native:${n.id}`,
      source: 'native',
      name,
      email: (n.profiles?.email ?? '').trim(),
      plan: n.stripe_price_id ?? null,
      status,
      mrrCents,
      startedAt: n.created_at,
      endsAt: n.cancel_at_period_end ? null : n.current_period_end,
      cancelAt: n.canceled_at,
    });
  }

  for (const c of crmRows) {
    if (c.profile_id && nativeProfileIds.has(c.profile_id)) continue; // native wins
    const sub = c.client_subscriptions?.[0] ?? null;
    const status = sub?.status ?? null;
    const mrrCents = status === 'active' ? Number(sub?.grandfathered_price_cents ?? 0) : 0;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unknown';
    merged.push({
      linkId: c.profile_id, // null when the CRM contact hasn't claimed an app account yet
      key: `crm:${c.id}`,
      source: 'crm',
      name,
      email: (c.email ?? '').trim(),
      plan: sub?.product_type ?? null,
      status,
      mrrCents,
      startedAt: sub?.started_at ?? null,
      endsAt: sub?.next_billing_date ?? null,
      cancelAt: sub?.ended_at ?? null,
    });
  }

  merged.sort((a, b) => {
    const at = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bt = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bt - at;
  });

  const total = merged.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const rows = merged.slice(start, end);

  return {
    rows,
    page,
    pageSize,
    total,
    hasPrev: page > 1,
    hasNext: end < total,
  };
}

// PostgREST .or() with ilike takes a comma-separated list where each token is `col.op.value`.
// A raw comma or percent in the user's query would break the parser or match too much, so we
// escape both. Backslashes are LIKE-special too; escape those first so we don't double-escape.
function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}
