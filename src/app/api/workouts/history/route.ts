// Workout history. A client sees their own; a coach can pass ?profile_id to view a client's.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { fetchHistory } from '@/lib/workout/logging';

export const dynamic = 'force-dynamic';

async function GET_h(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const requested = new URL(req.url).searchParams.get('profile_id');
  let target = ctx.userId;
  if (requested && requested !== ctx.userId) {
    if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
    target = requested; // coach viewing a client (company-scoped by RLS in the query)
  }

  const history = await fetchHistory(ctx.companyId, target);
  return apiSuccess({ history });
}

export const GET = withApiLog(GET_h);
