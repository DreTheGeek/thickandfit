// Support tickets: log + work member support requests.
import type { ReactElement } from 'react';
import { requireOperator } from '@/lib/auth/guards';
import { getSupportTickets } from '@/lib/admin/portal';
import { AdminPage } from '@/components/admin/ui';
import { SupportBoard } from '@/components/admin/support-board';

export const dynamic = 'force-dynamic';

export default async function SupportPage(): Promise<ReactElement> {
  const ctx = await requireOperator();
  const { tickets } = ctx.companyId ? await getSupportTickets(ctx.companyId) : { tickets: [] };
  return (
    <AdminPage title="Support tickets" subtitle="Member support requests, worked from open to resolved.">
      <SupportBoard tickets={tickets} />
    </AdminPage>
  );
}
