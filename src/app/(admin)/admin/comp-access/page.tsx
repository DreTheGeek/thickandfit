// /admin/comp-access — grant free entitlement without a Stripe subscription.
//
// The launch-blocking reason this page exists: roughly 256 Lenus clients were imported into
// client_subscriptions but have no native subscriptions row. The moment STRIPE_SECRET_KEY lands,
// requireEntitled arms and every one of them gets paywalled out of an app they already paid for.
// Comping them before the cutover is the fix; "Bulk-comp legacy clients" does exactly that cohort
// (imported subscription AND no native row), so it is safe to press more than once.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { createServiceClient } from '@/lib/supabase/service';
import { CompAccessForm, RevokeCompButton } from '@/components/admin/comp-access-form';
import { profileIdsFromJoin, type LegacyJoinRow } from '@/lib/admin/legacy-join';

export const dynamic = 'force-dynamic';

type CompRow = { id: string; email: string | null; full_name: string | null; comp_access_until: string };

export default async function CompAccessPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const svc = createServiceClient();
  const nowIso = new Date().toISOString();

  const [activeRes, legacyPendingCount] = await Promise.all([
    ctx.companyId
      ? svc
          .from('profiles')
          .select('id, email, full_name, comp_access_until')
          .eq('company_id', ctx.companyId)
          .not('comp_access_until', 'is', null)
          .gt('comp_access_until', nowIso)
          .order('comp_access_until', { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] as CompRow[] }),
    countLegacyNeedingComp(ctx.companyId),
  ]);

  const active = ((activeRes.data ?? []) as CompRow[]);

  return (
    <AdminPage
      title="Comp access"
      subtitle="Grant entitlement without a Stripe subscription. Use this to carry legacy clients across the paywall cutover."
    >
      <Card title="Status">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Active comps" value={String(active.length)} sub="not yet expired" />
          <Stat
            label="Legacy needing comp"
            value={legacyPendingCount == null ? '-' : String(legacyPendingCount)}
            sub="imported sub, no native row"
            tone={legacyPendingCount != null && legacyPendingCount > 0 ? 'warn' : 'good'}
          />
          <Stat label="Paywall" value="disarmed" sub="arms when STRIPE_SECRET_KEY lands" />
        </div>
      </Card>

      <Card title="Grant">
        <CompAccessForm />
      </Card>

      <Card title={`Active comps (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nobody is comped right now. Bulk-comp the legacy cohort before Stripe goes live so they keep access.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold">Until</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2.5 pr-4 text-ink">{r.full_name ?? '(no name)'}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.email ?? '-'}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-muted">{r.comp_access_until.slice(0, 10)}</td>
                    <td className="py-2.5 text-right">
                      <RevokeCompButton profileId={r.id} email={r.email ?? 'this member'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}

/**
 * How many legacy clients would be paywalled today: linked to a CRM contact that carries an
 * imported client_subscriptions row, but with no native subscriptions row and no live comp.
 * Returns null when we cannot compute it (no company scope) so the tile renders "-" not "0".
 */
async function countLegacyNeedingComp(companyId: string | null): Promise<number | null> {
  if (!companyId) return null;
  const svc = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: legacyRows, error } = await svc
    .from('client_subscriptions')
    .select('contact_id, contacts!inner(profile_id, company_id)')
    .eq('contacts.company_id', companyId)
    .not('contacts.profile_id', 'is', null);
  if (error) {
    console.error('countLegacyNeedingComp:', error.message);
    return null;
  }

  const ids = new Set<string>();
  for (const row of (legacyRows ?? []) as unknown as LegacyJoinRow[]) {
    for (const pid of profileIdsFromJoin(row)) ids.add(pid);
  }
  if (ids.size === 0) return 0;

  const [{ data: native }, { data: comped }] = await Promise.all([
    svc.from('subscriptions').select('profile_id').in('profile_id', [...ids]),
    svc
      .from('profiles')
      .select('id')
      .in('id', [...ids])
      .not('comp_access_until', 'is', null)
      .gt('comp_access_until', nowIso),
  ]);
  for (const row of (native ?? []) as { profile_id: string }[]) ids.delete(row.profile_id);
  for (const row of (comped ?? []) as { id: string }[]) ids.delete(row.id);
  return ids.size;
}
