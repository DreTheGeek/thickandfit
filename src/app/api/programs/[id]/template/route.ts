// Mark a program as a reusable template (coach).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { markTemplate } from '@/lib/programs/engine';

export const dynamic = 'force-dynamic';

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const result = await markTemplate(ctx.companyId, (await params).id);
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
