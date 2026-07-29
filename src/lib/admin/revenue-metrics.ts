import 'server-only';
// Admin revenue metrics — one aggregator, one page. Unifies BOTH billing sources into a single
// picture so the operator sees actual company MRR, not just one half of it:
//   * public.subscriptions        — native Stripe subs written by the checkout + webhook (0025)
//   * public.client_subscriptions — imported CRM subs from Lenus / GHL (0013), joined to contacts
//
// Follows the reconciliation pattern in src/lib/coach/billing-renewals.ts: contact-linked CRM subs
// are counted first, then we union in native subs whose profile_id is NOT already represented by a
// linked contact (so a member who ALSO has a legacy Lenus row is not double-counted).
//
// Money is BIGINT cents throughout. Never touch numeric/decimal. Display formatting lives on the page.
import { createServiceClient } from '@/lib/supabase/service';

const DAY_MS = 86_400_000;

export type ChurnRow = {
  key: string;               // profile_id or contact_id (stable per source)
  name: string;
  email: string | null;
  tier: string | null;       // stripe_price_id or product_type
  monthlyAmountCents: number | null;
  canceledAt: string;        // ISO
  source: 'stripe' | 'lenus';
};

export type RevenueMetrics = {
  mrrCents: number;
  activeSubscribers: number;
  trials: number;
  newThisWeek: number;
  cancelsThisMonth: number;
  churnPct30d: number;       // 0..100
  arpuCents: number;
  hasAnyData: boolean;       // false only when BOTH source tables are empty for this company
  recentChurn: ChurnRow[];
};

type NativeSub = {
  profile_id: string;
  status: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  trial_end: string | null;
  created_at: string;
  current_period_end: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type CrmSub = {
  id: string;
  contact_id: string;
  status: string | null;
  product_type: string | null;
  grandfathered_price_cents: number | null;
  next_amount_cents: number | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  contacts: {
    id: string;
    profile_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

const CANCELED_STATUSES = new Set(['canceled', 'churned']);

export async function getRevenueMetrics(companyId: string): Promise<RevenueMetrics> {
  const sb = createServiceClient();
  // Window comparisons below are done in epoch ms against this single `now`, so the whole rollup
  // is computed against one consistent instant (a per-row Date.now() could straddle a boundary).
  const now = Date.now();

  const [nativeRes, crmRes] = await Promise.all([
    sb
      .from('subscriptions')
      .select(
        'profile_id, status, price_cents, stripe_price_id, cancel_at_period_end, canceled_at, trial_end, created_at, current_period_end, profiles ( full_name, email )',
      )
      .eq('company_id', companyId)
      .limit(20000),
    sb
      .from('client_subscriptions')
      .select(
        'id, contact_id, status, product_type, grandfathered_price_cents, next_amount_cents, started_at, ended_at, updated_at, contacts!inner ( id, profile_id, first_name, last_name, email )',
      )
      .eq('company_id', companyId)
      .limit(20000),
  ]);

  const native = (nativeRes.data ?? []) as unknown as NativeSub[];
  const crm = (crmRes.data ?? []) as unknown as CrmSub[];

  // Dedup: any profile already counted through a CRM contact is suppressed on the native pass.
  const linkedProfiles = new Set<string>();

  let mrrCents = 0;
  let activeSubscribers = 0;
  let trials = 0;
  let newThisWeek = 0;
  let cancelsThisMonth = 0;
  const churn: ChurnRow[] = [];

  // --- CRM pass first (matches billing-renewals ordering) --------------------------------------
  for (const s of crm) {
    const contact = s.contacts;
    if (contact?.profile_id) linkedProfiles.add(contact.profile_id);
    const status = s.status ?? null;
    const price = pickPrice(s.grandfathered_price_cents, s.next_amount_cents);
    if (status === 'active') {
      mrrCents += price;
      activeSubscribers += 1;
      if (s.started_at && new Date(s.started_at).getTime() >= now - 7 * DAY_MS) {
        newThisWeek += 1;
      }
    }
    if (status && CANCELED_STATUSES.has(status)) {
      const canceledIso = s.ended_at ?? s.updated_at;
      if (canceledIso && new Date(canceledIso).getTime() >= now - 30 * DAY_MS) {
        cancelsThisMonth += 1;
        churn.push({
          key: s.id,
          name: contactName(contact),
          email: contact?.email ?? null,
          tier: s.product_type,
          monthlyAmountCents: price || null,
          canceledAt: canceledIso,
          source: 'lenus',
        });
      }
    }
  }

  // --- Native Stripe pass (skip profiles already counted through a linked CRM contact) ----------
  for (const s of native) {
    if (linkedProfiles.has(s.profile_id)) continue;
    const status = s.status ?? null;
    const price = Number(s.price_cents ?? 0);
    if (status === 'active') {
      mrrCents += price;
      activeSubscribers += 1;
      if (new Date(s.created_at).getTime() >= now - 7 * DAY_MS) newThisWeek += 1;
    } else if (status === 'trialing') {
      trials += 1;
    }
    // canceled_at is set by the Stripe webhook on cancellation; canceled subs may still be status
    // 'active' if they cancel at period end, so we filter on the timestamp itself, not the status.
    if (s.canceled_at && new Date(s.canceled_at).getTime() >= now - 30 * DAY_MS) {
      cancelsThisMonth += 1;
      churn.push({
        key: s.profile_id,
        name: (s.profiles?.full_name ?? s.profiles?.email ?? '').trim() || 'App member',
        email: s.profiles?.email ?? null,
        tier: s.stripe_price_id,
        monthlyAmountCents: price || null,
        canceledAt: s.canceled_at,
        source: 'stripe',
      });
    }
  }

  churn.sort((a, b) => new Date(b.canceledAt).getTime() - new Date(a.canceledAt).getTime());
  const recentChurn = churn.slice(0, 20);

  // Churn % = cancels in the last 30d over the population at risk (active now + those who left).
  const denom = activeSubscribers + cancelsThisMonth;
  const churnPct30d = denom === 0 ? 0 : Math.round((cancelsThisMonth / denom) * 1000) / 10;
  const arpuCents = activeSubscribers === 0 ? 0 : Math.round(mrrCents / activeSubscribers);
  const hasAnyData = native.length > 0 || crm.length > 0;

  return {
    mrrCents,
    activeSubscribers,
    trials,
    newThisWeek,
    cancelsThisMonth,
    churnPct30d,
    arpuCents,
    hasAnyData,
    recentChurn,
  };
}

// Prefer the grandfathered price (locked at import) and fall back to next_amount when the import
// only carried the upcoming invoice amount. Never falls through to 0 silently — a null/0 stays 0.
function pickPrice(grandfathered: number | null, next: number | null): number {
  if (grandfathered != null && grandfathered > 0) return Number(grandfathered);
  if (next != null && next > 0) return Number(next);
  return 0;
}

function contactName(c: CrmSub['contacts']): string {
  if (!c) return 'Unknown';
  const full = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return full || c.email || 'Unknown';
}
