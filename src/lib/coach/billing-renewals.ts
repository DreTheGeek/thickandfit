// Coach Billing & Renewals data: the imported CRM (contacts + client_subscriptions) UNIONED with
// native in-app Stripe subscriptions. Before the union, a member who subscribed through the app
// never appeared here and never counted toward MRR (the CRM table is only fed by the ghl-sync cron).
// Service client (server-only aggregates).
import { createServiceClient } from '@/lib/supabase/service';

export type RenewalFlag = 'failed' | 'soon' | 'ok';

export type RenewalRow = {
  contactId: string;
  name: string;
  priceCents: number | null;
  currency: string;
  nextBillingDate: string | null;
  status: string | null;
  flag: RenewalFlag;
};

export type BillingRenewals = {
  mrrCents: number;
  renewSoon: number;
  failedOverdue: number;
  rows: RenewalRow[];
};

const FAILED_STATUS = new Set(['past_due', 'unpaid']);
const FAILED_HEALTH = new Set(['lapsed', 'due-soon/late']);

type Sub = {
  status: string | null;
  billing_health: string | null;
  grandfathered_price_cents: number | null;
  currency: string | null;
  next_billing_date: string | null;
};
type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  client_subscriptions: Sub | Sub[] | null;
};

type NativeSub = {
  profile_id: string;
  status: string | null;
  price_cents: number | null;
  currency: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export async function getBillingRenewals(companyId: string): Promise<BillingRenewals> {
  const sb = createServiceClient();
  const [{ data }, { data: nativeData }, { data: linkRows }] = await Promise.all([
    sb
      .from('contacts')
      .select(
        'id, first_name, last_name, email, client_subscriptions(status, billing_health, grandfathered_price_cents, currency, next_billing_date)',
      )
      .eq('company_id', companyId)
      .eq('type', 'client')
      .limit(20000),
    // Native in-app Stripe subscriptions (webhook-driven), joined to the member for a display name.
    sb
      .from('subscriptions')
      .select(
        'profile_id, status, price_cents, currency, current_period_end, cancel_at_period_end, profiles ( full_name, email )',
      )
      .eq('company_id', companyId)
      .limit(20000),
    // Contact<->profile links so a member with BOTH a CRM row and a native sub is not double-counted.
    sb
      .from('contacts')
      .select('profile_id')
      .eq('company_id', companyId)
      .not('profile_id', 'is', null)
      .limit(20000),
  ]);
  const linkedProfiles = new Set(
    ((linkRows ?? []) as { profile_id: string | null }[]).map((r) => r.profile_id).filter(Boolean) as string[],
  );

  const now = Date.now();
  const in30 = now + 30 * 86400 * 1000;
  const dayAgo = now - 86400 * 1000;

  let mrrCents = 0;
  let renewSoon = 0;
  let failedOverdue = 0;
  const rows: RenewalRow[] = [];

  for (const c of (data ?? []) as unknown as ContactRow[]) {
    const sub = Array.isArray(c.client_subscriptions) ? c.client_subscriptions[0] : c.client_subscriptions;
    if (!sub) continue;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unknown';
    const status = sub.status ?? null;
    const health = sub.billing_health ?? null;
    const price = sub.grandfathered_price_cents ?? null;
    if (status === 'active') mrrCents += Number(price ?? 0);

    const nextTs = sub.next_billing_date ? new Date(sub.next_billing_date).getTime() : null;
    let flag: RenewalFlag = 'ok';
    if ((status && FAILED_STATUS.has(status)) || (health && FAILED_HEALTH.has(health))) {
      flag = 'failed';
      failedOverdue += 1;
    } else if (nextTs !== null && nextTs <= in30 && nextTs >= dayAgo) {
      flag = 'soon';
      renewSoon += 1;
    }
    rows.push({
      contactId: c.id,
      name,
      priceCents: price,
      currency: sub.currency ?? 'usd',
      nextBillingDate: sub.next_billing_date ?? null,
      status,
      flag,
    });
  }

  // Union in native app subscribers not already represented by a linked CRM contact.
  for (const s of (nativeData ?? []) as unknown as NativeSub[]) {
    if (linkedProfiles.has(s.profile_id)) continue;
    const status = s.status ?? null;
    const price = s.price_cents != null ? Number(s.price_cents) : null;
    if (status === 'active' || status === 'trialing') mrrCents += Number(price ?? 0);

    const nextTs =
      s.current_period_end && !s.cancel_at_period_end ? new Date(s.current_period_end).getTime() : null;
    let flag: RenewalFlag = 'ok';
    if (status && FAILED_STATUS.has(status)) {
      flag = 'failed';
      failedOverdue += 1;
    } else if (nextTs !== null && nextTs <= in30 && nextTs >= dayAgo) {
      flag = 'soon';
      renewSoon += 1;
    }
    rows.push({
      contactId: s.profile_id,
      name: (s.profiles?.full_name ?? s.profiles?.email ?? '').trim() || 'App member',
      priceCents: price,
      currency: s.currency ?? 'usd',
      nextBillingDate: s.current_period_end ? s.current_period_end.slice(0, 10) : null,
      status,
      flag,
    });
  }

  rows.sort((a, b) => {
    if (a.flag === 'failed' && b.flag !== 'failed') return -1;
    if (b.flag === 'failed' && a.flag !== 'failed') return 1;
    const at = a.nextBillingDate ? new Date(a.nextBillingDate).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.nextBillingDate ? new Date(b.nextBillingDate).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return { mrrCents, renewSoon, failedOverdue, rows: rows.slice(0, 300) };
}
