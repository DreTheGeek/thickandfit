// Past-client segments (F3) and the launch offer each one gets (F5).
//
// This is the page Stephanie and Dre work before doors open: it says exactly how many people are in
// each bucket, what offer that bucket should receive, and lets the list be exported for the
// hand-correction pass (F2). Every number is derived live from `contacts`, so a corrected
// lifecycle_stage or product_type is reflected the next time the page loads.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card } from '@/components/admin/ui';
import { segmentCounts, SEGMENT_OFFER, type Segment } from '@/lib/admin/segments';

export const dynamic = 'force-dynamic';

const LABEL: Record<Segment, string> = {
  coaching_active: 'Active coaching clients',
  coaching_past: 'Past coaching clients',
  bootcamp: 'Bootcamp buyers',
  solon: 'Solon one-off buyers',
  lead_never_bought: 'Leads (never bought)',
};

const OFFER_LABEL: Record<string, string> = {
  comp_transition: 'Comp them in',
  founding_rate: 'Founding $19.97 for life',
  waitlist_funnel: 'Standard waitlist nurture',
};

export default async function SegmentsPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const counts = ctx.companyId ? await segmentCounts(ctx.companyId) : [];
  const total = counts.reduce((s, c) => s + c.count, 0);

  return (
    <AdminPage
      title="Past-client segments"
      subtitle="Who gets which offer when doors open. Derived live from the CRM, so corrections show up here immediately."
    >
      <Card title={`Segments (${total} contacts)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                <th className="pb-2 pr-4 font-semibold">Segment</th>
                <th className="pb-2 pr-4 font-semibold text-right">People</th>
                <th className="pb-2 pr-4 font-semibold">Launch offer</th>
                <th className="pb-2 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.segment} className="border-t border-line align-top">
                  <td className="py-2.5 pr-4 font-semibold text-ink">{LABEL[c.segment]}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink">{c.count}</td>
                  <td className="py-2.5 pr-4 text-muted">{OFFER_LABEL[c.offer] ?? c.offer}</td>
                  <td className="py-2.5 text-[12px] leading-[1.5] text-soft">
                    {SEGMENT_OFFER[c.segment].why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <a
                key={c.segment}
                href={`/api/internal/segments/export?segment=${c.segment}`}
                className="tf-press rounded-full border border-line px-3.5 py-2 text-[12px] font-semibold hover:border-ink"
              >
                Export {LABEL[c.segment]} (CSV)
              </a>
            ))}
        </div>
      </Card>

      <Card title="Known gaps">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-[1.55] text-soft">
          <li>
            <strong className="text-ink">Solon buyers are not imported.</strong> That list lives in a
            CSV that has never been loaded, so the segment reads 0. Nobody is labelled solon by guess:
            a wrong label here means a wrong launch offer to a real customer.
          </li>
          <li>
            <strong className="text-ink">936 of 1,503 Lenus charges have no contact link</strong>{' '}
            ($195,578 of $305,110 gross). Those payments carry a `lenus_customer_id` that does not
            match any id in the client export, so the two Lenus subsystems cannot be joined with what
            we have. Per-client revenue is understated until Lenus re-exports with the mapping.
          </li>
          <li>
            Segment boundaries come from `product_type` and `lifecycle_stage` as they were at
            migration. Anyone whose status changed after the export needs correcting in the CRM, which
            is what the exports above are for.
          </li>
        </ul>
      </Card>
    </AdminPage>
  );
}
