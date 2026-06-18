// Save a form (coach). POST { title_en, title_es?, type?, fields:[...] } — field order = array index.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { saveFormSchema, saveForm } from '@/lib/forms/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
  const parsed = saveFormSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const result = await saveForm(ctx.companyId, ctx.userId, parsed.data);
  return apiSuccess(result, 201);
}
