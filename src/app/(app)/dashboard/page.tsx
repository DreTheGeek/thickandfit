// Subscriber home. Requires auth; SSRs the summary, widgets handle the four states client-side.
import { requireAuth } from '@/lib/auth/guards';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireAuth();
  let summary: DashboardSummary | null = null;
  if (ctx.companyId) summary = await getDashboardSummary(ctx.companyId, ctx.userId);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
      <PageHeader title="Home" />
      <DashboardWidgets initial={summary} />
    </div>
  );
}
