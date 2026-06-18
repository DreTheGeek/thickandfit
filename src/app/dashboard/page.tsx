// Subscriber home. Requires auth; SSRs the summary, widgets handle the four states client-side.
import { requireAuth } from '@/lib/auth/guards';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard/summary';
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireAuth();
  let summary: DashboardSummary | null = null;
  if (ctx.companyId) summary = await getDashboardSummary(ctx.companyId, ctx.userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-black">
      <h1 className="mb-6 text-3xl font-bold uppercase tracking-tight">Home</h1>
      <DashboardWidgets initial={summary} />
    </main>
  );
}
