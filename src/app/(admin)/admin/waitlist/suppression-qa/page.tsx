// /admin/waitlist/suppression-qa — the Aug-4 protection harness.
//
// kb-funnels route rule: "Ship the suppression logic before you ship the first email. Test it
// before you write the second one." The mis-send that hurts is "doors close in 24 hours" landing
// in a buyer's inbox, or the double-opt-in drip firing at someone who never confirmed. This page
// proves the contract holds by running a throwaway lead through the real signup path and asserting
// each state transition, then lets the operator delete the evidence.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card } from '@/components/admin/ui';
import { SuppressionQaRunner } from '@/components/admin/suppression-qa-runner';
import { listQaLeads, QA_EMAIL_DOMAIN } from '@/lib/admin/suppression-qa';

export const dynamic = 'force-dynamic';

export default async function SuppressionQaPage(): Promise<ReactElement> {
  await requireOperator();
  const existing = await listQaLeads();

  return (
    <AdminPage
      title="Suppression QA"
      subtitle="Seed a throwaway signup through the real funnel and assert the suppression contract before Aug 4."
    >
      <Card title="Run the harness">
        <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-muted">
          This seeds a lead at <span className="font-mono text-[12px]">qa-&lt;timestamp&gt;@{QA_EMAIL_DOMAIN}</span>{' '}
          using the same submitSignup path production traffic uses, waits for the fire-and-forget side
          effects to settle, then walks the row: signup must NOT auto-confirm, the confirm token must
          flip confirmed_at, and a simulated Stripe conversion must flip converted_at (which is what
          suppresses every later drip send). Nothing is emailed to a real inbox.
        </p>
        <SuppressionQaRunner />
      </Card>

      <Card title={`Leftover test rows (${existing.length})`}>
        {existing.length === 0 ? (
          <p className="text-[13px] text-muted">None. The tenant is clean.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[1px] text-faint">
                  <th className="pb-2 pr-4 font-semibold">Email</th>
                  <th className="pb-2 pr-4 font-semibold">Created</th>
                  <th className="pb-2 pr-4 font-semibold">Confirmed</th>
                  <th className="pb-2 font-semibold">Converted</th>
                </tr>
              </thead>
              <tbody>
                {existing.map((r) => (
                  <tr key={r.email} className="border-t border-line">
                    <td className="py-2.5 pr-4 font-mono text-[12px] text-ink">{r.email}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-faint">{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.confirmed_at ? 'yes' : 'no'}</td>
                    <td className="py-2.5 text-muted">{r.converted_at ? 'yes' : 'no'}</td>
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
