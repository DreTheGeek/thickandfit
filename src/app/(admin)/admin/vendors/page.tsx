// Vendors: live per-vendor health tiles (superset of /admin/connections, which only reports env
// presence). Each tile runs a real auth-gated probe with a 3s timeout so one slow vendor cannot
// stall the page. Refresh is a full page reload (server component; no client mutation needed).
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card } from '@/components/admin/ui';
import { getVendorHealth, type VendorStatus } from '@/lib/admin/vendor-health';

export const dynamic = 'force-dynamic';

const DOT: Record<VendorStatus, string> = {
  green: '#1F7A46',
  yellow: '#B98A1C',
  red: '#B4462F',
  unset: '#A8A29E',
};

const LABEL: Record<VendorStatus, string> = {
  green: 'Healthy',
  yellow: 'Slow',
  red: 'Failing',
  unset: 'Not configured',
};

function StatusPill({ status }: { status: VendorStatus }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-soft">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DOT[status] }} aria-hidden />
      {LABEL[status]}
    </span>
  );
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

export default async function VendorsPage(): Promise<ReactElement> {
  await requireOperator();
  const vendors = await getVendorHealth();
  const renderedAt = new Date().toISOString();

  const counts = vendors.reduce<Record<VendorStatus, number>>(
    (acc, v) => {
      acc[v.status] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, unset: 0 },
  );

  return (
    <AdminPage
      title="Vendors"
      subtitle="Live probes of every third-party the app talks to. Each tile hits a lightweight auth-gated endpoint on the vendor with a 3s timeout, so one slow vendor never blocks this page."
    >
      <Card
        title="Fleet health"
        action={
          <form method="get">
            <button
              type="submit"
              className="rounded-full border border-line bg-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-ink hover:bg-warm"
            >
              Refresh
            </button>
          </form>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span className="text-ink">{vendors.length} vendors</span>
          <span aria-hidden>-</span>
          <span>{counts.green} healthy</span>
          <span aria-hidden>-</span>
          <span>{counts.yellow} slow</span>
          <span aria-hidden>-</span>
          <span>{counts.red} failing</span>
          <span aria-hidden>-</span>
          <span>{counts.unset} not configured</span>
          <span aria-hidden>-</span>
          <span>Rendered {fmtTime(renderedAt)} UTC</span>
        </div>
      </Card>

      {vendors.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">No vendor probes returned. Check src/lib/admin/vendor-health.ts.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vendors.map((v) => (
            <div key={v.name} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT[v.status] }} aria-hidden />
                  <span className="font-medium text-ink">{v.name}</span>
                </div>
                <StatusPill status={v.status} />
              </div>
              <div className="mt-2 text-[12px] text-muted break-words">{v.detail}</div>
              <div className="mt-2 text-[10px] uppercase tracking-[1px] text-faint">Checked {fmtTime(v.lastCheckedIso)} UTC</div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
