// Assign a form to a client (coach). POST { profile_id }.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { resolveAuth, hasRole, APPROVER_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { assignForm } from '@/lib/forms/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';
import { notifyMember } from '@/lib/notifications/triggers';
import { after } from 'next/server';

export const dynamic = 'force-dynamic';

const schema = z.object({ profile_id: z.string().uuid() });

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  // Assigning a form to a MEMBER is delivery: approver authority (coach + operator), not COACH_ROLES
  // which admits assistant_coach. Matches APPROVER_ROLES + the roster-assign path.
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

  const { id } = await params;
  const result = await assignForm(ctx.companyId, id, parsed.data.profile_id);
  logCoachAction(createServiceClient(), {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'form',
    entityId: id,
    action: 'assign',
    newState: { profile_id: parsed.data.profile_id },
  });
  // Tell the member their coach sent them a form. Links to the form itself (works for any form type,
  // including custom forms that don't surface on /checkin). after() survives the lambda.
  const companyId = ctx.companyId;
  const memberId = parsed.data.profile_id;
  after(() =>
    notifyMember({
      companyId,
      profileId: memberId,
      type: 'form_assigned',
      titleKey: 'formAssignedTitle',
      bodyKey: 'formAssignedBody',
      link: `/forms/${id}`,
    }),
  );
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
