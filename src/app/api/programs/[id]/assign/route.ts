// Assign a program to a client (coach). POST { profile_id }.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { resolveAuth, hasRole, APPROVER_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { assignProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({ profile_id: z.string().uuid() });

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  // Assigning a program to a MEMBER is delivery, so it needs approver authority (coach + operator),
  // NOT COACH_ROLES which admits assistant_coach. Matches APPROVER_ROLES + the roster-assign path.
  if (!hasRole(ctx.role, APPROVER_ROLES)) return apiError('Forbidden', 403);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const planId = (await params).id;
  const result = await assignProgram(ctx.companyId, planId, parsed.data.profile_id);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'plan',
    entityId: planId,
    action: 'assign',
    newState: { profile_id: parsed.data.profile_id },
  });
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
