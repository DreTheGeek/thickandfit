// Full referrer leaderboard. The top-10 on /admin/waitlist is a preview; this is the whole loop.
// Two audiences: (1) Stephanie / Rodney checking who to shout out on stories, (2) Dre confirming
// the share loop is healthy (K-factor rising, cap-hitters showing up, top-heavy vs long-tail).
//
// Reads getTopReferrers(500) once — server does one pass over waitlist_entry_events and joins to
// waitlist_leads, so this page is a single aggregation. Top 100 render in the table, top 500 flow
// into the CSV button.
import type { ReactElement } from 'react';
import Link from 'next/link';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { getTopReferrers, type ReferrerRow } from '@/lib/admin/waitlist-metrics';
import { ReferrersCsvButton, type CsvReferrerRow } from '@/components/admin/referrers-csv-button';

export const dynamic = 'force-dynamic';

const DISPLAY_LIMIT = 100;
const EXPORT_LIMIT = 500;
const REFERRAL_CAP = 20; // matches the ledger cap in 0090

export default async function AdminWaitlistReferrersPage(): Promise<ReactElement> {
  await requireOperator();
  const { referrers, totalReferrals, uniqueReferrers } = await getTopReferrers(EXPORT_LIMIT);

  const kFactor = uniqueReferrers === 0 ? 0 : Math.round((totalReferrals / uniqueReferrers) * 100) / 100;
  const segments = computeSegments(referrers);
  const display = referrers.slice(0, DISPLAY_LIMIT);
  const csvRows = toCsvRows(referrers);

  return (
    <AdminPage
      title="Referrer leaderboard"
      subtitle="Every credited referrer. Ranked by share-loop volume. Top 10 is on /admin/waitlist; this is the full 100."
    >
      <Card>
        <Link
          href="/admin/waitlist"
          className="text-[11px] font-semibold uppercase tracking-[1.2px] text-muted hover:text-ink"
        >
          &larr; Back to waitlist
        </Link>
      </Card>

      <Card title="Share loop KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Referrals credited"
            value={fmt(totalReferrals)}
            sub="+3 entries each"
            tone={totalReferrals > 0 ? 'good' : undefined}
          />
          <Stat
            label="Unique referrers"
            value={fmt(uniqueReferrers)}
            sub="brought at least 1 friend"
          />
          <Stat
            label="K-factor"
            value={kFactor.toFixed(2)}
            sub={kFactor >= 0.5 ? 'viral' : kFactor >= 0.3 ? 'healthy' : uniqueReferrers > 5 ? 'weak' : 'early'}
            tone={kFactor >= 0.5 ? 'good' : uniqueReferrers > 20 && kFactor < 0.3 ? 'warn' : undefined}
          />
        </div>
      </Card>

      <Card title="Segments by referral count">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="1 referral" value={fmt(segments.s1)} sub="just started" />
          <Stat label="2 to 4" value={fmt(segments.s2to4)} sub="warming up" />
          <Stat label="5 to 9" value={fmt(segments.s5to9)} sub="dependable" />
          <Stat label="10 to 19" value={fmt(segments.s10to19)} sub="core loop" tone={segments.s10to19 > 0 ? 'good' : undefined} />
          <Stat
            label={`${REFERRAL_CAP} (cap)`}
            value={fmt(segments.sCap)}
            sub="hit the ceiling"
            tone={segments.sCap > 0 ? 'good' : undefined}
          />
        </div>
      </Card>

      <Card
        title={`Leaderboard (top ${display.length} of ${fmt(uniqueReferrers)})`}
        action={<ReferrersCsvButton rows={csvRows} />}
      >
        {display.length === 0 ? (
          <p className="text-[13px] text-muted">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold text-right">Referrals</th>
                  <th className="pb-2 pr-4 font-semibold text-right">Entries</th>
                  <th className="pb-2 pr-4 font-semibold">Share code</th>
                  <th className="pb-2 pr-4 font-semibold">Milestones</th>
                  <th className="pb-2 font-semibold">First referred</th>
                </tr>
              </thead>
              <tbody>
                {display.map((r, i) => (
                  <tr key={r.leadId} className="border-t border-line align-top">
                    <td className="py-2.5 pr-4 tabular-nums text-faint">{i + 1}</td>
                    <td className="py-2.5 pr-4 text-ink">{formatName(r)}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.email}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-ink tabular-nums">{r.referralCount}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted">{r.entryCount}</td>
                    <td className="py-2.5 pr-4 font-mono text-[12px] text-faint">{r.referralCode}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {r.milestones.map((m) => (
                          <span
                            key={m}
                            className="rounded border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 text-faint tabular-nums">{formatDate(r.firstReferredAt)}</td>
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

// ────────────────────────────────────────────────────────────────────────────────

type SegmentCounts = { s1: number; s2to4: number; s5to9: number; s10to19: number; sCap: number };

function computeSegments(rows: ReferrerRow[]): SegmentCounts {
  const out: SegmentCounts = { s1: 0, s2to4: 0, s5to9: 0, s10to19: 0, sCap: 0 };
  for (const r of rows) {
    const n = r.referralCount;
    if (n >= REFERRAL_CAP) out.sCap += 1;
    else if (n >= 10) out.s10to19 += 1;
    else if (n >= 5) out.s5to9 += 1;
    else if (n >= 2) out.s2to4 += 1;
    else if (n >= 1) out.s1 += 1;
  }
  return out;
}

function toCsvRows(rows: ReferrerRow[]): CsvReferrerRow[] {
  return rows.map((r, i) => ({
    rank: i + 1,
    name: formatName(r),
    email: r.email,
    referralCount: r.referralCount,
    entryCount: r.entryCount,
    referralCode: r.referralCode,
    firstReferredAt: r.firstReferredAt,
    milestones: r.milestones,
  }));
}

function formatName(r: ReferrerRow): string {
  const parts = [r.firstName, r.lastName].filter((s): s is string => Boolean(s && s.trim()));
  return parts.length > 0 ? parts.join(' ') : '(no name)';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}
