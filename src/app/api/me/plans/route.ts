// The authenticated client's assigned plans.
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { getAssignedPlans } from '@/lib/programs/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const plans = await getAssignedPlans(ctx.companyId, ctx.userId);
  return apiSuccess({ plans });
}
