// Subscriber dashboard summary (authed, company-scoped).
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { getDashboardSummary } from '@/lib/dashboard/summary';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);
  const summary = await getDashboardSummary(ctx.companyId, ctx.userId);
  return apiSuccess(summary);
}
