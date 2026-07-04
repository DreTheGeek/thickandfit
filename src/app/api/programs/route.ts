// Save a program (coach). POST nested { name_en, weeks, sessions:[{ day_label, exercises:[...] }] }.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { saveProgramSchema, saveProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export const dynamic = 'force-dynamic';

async function POST_h(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = saveProgramSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const result = await saveProgram(ctx.companyId, ctx.userId, parsed.data);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'plan',
    entityId: result.planId,
    action: parsed.data.id ? 'update' : 'create',
    newState: { name_en: parsed.data.name_en, weeks: parsed.data.weeks, sessions: parsed.data.sessions.length },
  });
  return apiSuccess(result, 201);
}

async function GET_h(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('plans')
    .select('id, name_en, weeks, is_template, updated_at')
    .eq('company_id', ctx.companyId)
    .order('updated_at', { ascending: false });
  return apiSuccess({ plans: data ?? [] });
}

export const POST = withApiLog(POST_h);
export const GET = withApiLog(GET_h);
