// GET /api/coach/clients/export -> CSV of every client contact in the coach's company. Coach-gated.
import { NextResponse } from 'next/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { toCsv } from '@/lib/csv/csv';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return NextResponse.json({ error: 'no_company' }, { status: 400 });

  const svc = createServiceClient();
  const { data } = await svc
    .from('contacts')
    .select('first_name, last_name, email, phone, language, lifecycle_stage, product_type, owner, is_legacy, was_lead, created_at, client_subscriptions(status, billing_health, next_billing_date, grandfathered_price_cents, currency)')
    .eq('company_id', ctx.companyId)
    .eq('type', 'client')
    .order('created_at', { ascending: true })
    .limit(5000);

  type Sub = { status: string | null; billing_health: string | null; next_billing_date: string | null; grandfathered_price_cents: number | null; currency: string | null };
  type Row = {
    first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
    language: string | null; lifecycle_stage: string | null; product_type: string | null; owner: string | null;
    is_legacy: boolean | null; was_lead: boolean | null; created_at: string; client_subscriptions: Sub | Sub[] | null;
  };
  const one = (s: Sub | Sub[] | null): Sub | null => (Array.isArray(s) ? s[0] ?? null : s);

  const headers = ['First name', 'Last name', 'Email', 'Phone', 'Language', 'Lifecycle', 'Product', 'Owner', 'Legacy', 'Was lead', 'Status', 'Billing health', 'Next billing', 'Price', 'Currency', 'Created'];
  const rows = ((data ?? []) as Row[]).map((r) => {
    const sub = one(r.client_subscriptions);
    return [
      r.first_name, r.last_name, r.email, r.phone, r.language, r.lifecycle_stage, r.product_type, r.owner,
      r.is_legacy ? 'yes' : 'no', r.was_lead ? 'yes' : 'no',
      sub?.status ?? '', sub?.billing_health ?? '', sub?.next_billing_date ?? '',
      sub?.grandfathered_price_cents != null ? (sub.grandfathered_price_cents / 100).toFixed(2) : '',
      sub?.currency ?? '', r.created_at,
    ];
  });

  const csv = toCsv(headers, rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="thickandfit-clients-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
