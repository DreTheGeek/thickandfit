// /admin/comms/suppressions — one board for every "do not contact" record.
//
// Two sources merge here: waitlist drip opt-outs (waitlist_leads.unsubscribed_at) and the global
// email suppression list (Resend-webhook-fed bounces + complaints, plus manual entries). Gmail and
// Yahoo bulk-sender rules make this a compliance surface, not a nicety: sending again to someone
// who complained is a reputation hit that damages every later send, including launch day.
//
// SMS/TCPA STOP is not here yet - no phone suppression table exists until Twilio 10DLC lands.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { AdminPage, Card, Stat } from '@/components/admin/ui';
import { SuppressionsTable } from '@/components/admin/suppressions-table';
import { getSuppressionBoard } from '@/lib/admin/suppressions';

export const dynamic = 'force-dynamic';

export default async function SuppressionsPage(): Promise<ReactElement> {
  const ctx = await requireOperator();

  if (!ctx.companyId) {
    return (
      <AdminPage title="Suppressions" subtitle="Every do-not-contact record across email and the waitlist drip.">
        <Card>
          <p className="text-[13px] text-muted">No company scope on your account.</p>
        </Card>
      </AdminPage>
    );
  }

  const board = await getSuppressionBoard(ctx.companyId);
  const s = board.summary;

  return (
    <AdminPage
      title="Suppressions"
      subtitle="Every do-not-contact record across email and the waitlist drip. Resubscribing is audited."
    >
      <Card title="Breakdown">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Total" value={String(s.total)} />
          <Stat label="Waitlist opt-out" value={String(s.byWaitlist)} />
          <Stat
            label="Bounced"
            value={String(s.byEmailBounce)}
            tone={s.byEmailBounce > 0 ? 'warn' : undefined}
          />
          <Stat
            label="Complained"
            value={String(s.byEmailComplaint)}
            sub="reputation risk"
            tone={s.byEmailComplaint > 0 ? 'bad' : undefined}
          />
          <Stat label="Manual" value={String(s.byManual)} />
        </div>
      </Card>

      <Card title="Suppressed addresses">
        <SuppressionsTable rows={board.rows} />
      </Card>
    </AdminPage>
  );
}
