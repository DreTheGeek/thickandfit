// Mark a program as a reusable template (coach).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { markTemplate } from '@/lib/programs/engine';
import { logCoachAction } from '@/lib/coach/audit';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const { id } = await params;
  const result = await markTemplate(ctx.companyId, id);
  // Audit-trail consistency with the sibling coach mutations (publish/assign).
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'program',
    entityId: id,
    action: 'mark_template',
  });
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
