// Coach Billing & Renewals data. Reuses the imported CRM (contacts + client_subscriptions) to show
// who renews soon, who has failed/overdue billing, and MRR. Service client (server-only aggregates).
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

export async function getBillingRenewals(companyId: string): Promise<BillingRenewals> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('contacts')
    .select(
      'id, first_name, last_name, email, client_subscriptions(status, billing_health, grandfathered_price_cents, currency, next_billing_date)',
    )
    .eq('company_id', companyId)
    .eq('type', 'client')
    .limit(20000);

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

  rows.sort((a, b) => {
    if (a.flag === 'failed' && b.flag !== 'failed') return -1;
    if (b.flag === 'failed' && a.flag !== 'failed') return 1;
    const at = a.nextBillingDate ? new Date(a.nextBillingDate).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.nextBillingDate ? new Date(b.nextBillingDate).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return { mrrCents, renewSoon, failedOverdue, rows: rows.slice(0, 300) };
}
