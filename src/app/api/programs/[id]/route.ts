// Get a program with its ordered sessions + exercises (coach).
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { getProgram } from '@/lib/programs/engine';

export const dynamic = 'force-dynamic';

async function GET_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const program = await getProgram(ctx.companyId, (await params).id);
  if (!program) return apiError('Not found', 404);
  return apiSuccess(program);
}

export const GET = withApiLog(GET_h);
