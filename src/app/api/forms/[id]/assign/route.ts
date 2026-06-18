// Assign a form to a client (coach). POST { profile_id }.
import { z } from 'zod';
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { assignForm } from '@/lib/forms/engine';

export const dynamic = 'force-dynamic';

const schema = z.object({ profile_id: z.string().uuid() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const { id } = await params;
  const result = await assignForm(ctx.companyId, id, parsed.data.profile_id);
  return apiSuccess(result);
}
