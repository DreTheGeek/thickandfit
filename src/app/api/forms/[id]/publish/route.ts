// Publish a form (coach).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { publishForm } from '@/lib/forms/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export const dynamic = 'force-dynamic';

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const { id } = await params;
  const result = await publishForm(ctx.companyId, id);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'form',
    entityId: id,
    action: 'publish',
  });
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
