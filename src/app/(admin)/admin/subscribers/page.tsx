// /admin/subscribers: searchable subscriber table across native Stripe subs and the CRM imports.
// Read-only view; row-level actions live at /coach/subscribers/[id] (same detail surface the
// coach already uses, one canonical page across roles).
//
// Kept deliberately separate from /coach/subscribers despite the shared name. This one answers "who
// is paying", unioning two billing sources with pagination and a rate-limited search. That one
// answers "who is in the app", reading profiles with workout counts. Different question, different
// source, same people. Both deep-link into the one member record.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage } from '@/components/admin/ui';
import { SubscribersTable } from '@/components/admin/subscribers-table';
import { getSubscribersList } from '@/lib/admin/subscribers-list';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const ctx = await requireOperator();
  const sp = await searchParams;

  const q = ((typeof sp.q === 'string' ? sp.q : Array.isArray(sp.q) ? sp.q[0] : '') || '').trim().slice(0, 120);
  const pageRaw = typeof sp.page === 'string' ? sp.page : Array.isArray(sp.page) ? sp.page[0] : '1';
  const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1);

  // Search is rate-limited per operator so a stuck typeahead never storms the union scan.
  const rateOk = await checkRateLimit(ctx.userId, 'admin-subs-search', 30, 60, { failClosed: false });

  const result = ctx.companyId && rateOk
    ? await getSubscribersList({ companyId: ctx.companyId, q, page, pageSize: 50 })
    : { rows: [], page, pageSize: 50, total: 0, hasPrev: false, hasNext: false };

  return (
    <AdminPage
      title="Subscribers"
      subtitle={`${result.total} unified across native Stripe + CRM imports. Search filters both sources; row View deep-links to the coach detail page.`}
    >
      <SubscribersTable result={result} q={q} basePath="/admin/subscribers" rateLimited={!rateOk} />
    </AdminPage>
  );
}
