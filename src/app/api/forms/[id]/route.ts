// Get a form + its ordered fields (coach).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { getForm } from '@/lib/forms/engine';

export const dynamic = 'force-dynamic';

async function GET_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const { id } = await params;
  const form = await getForm(ctx.companyId, id);
  if (!form) return apiError('Not found', 404);
  return apiSuccess(form);
}

export const GET = withApiLog(GET_h);
