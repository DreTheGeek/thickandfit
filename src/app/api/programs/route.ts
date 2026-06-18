// Save a program (coach). POST nested { name_en, weeks, sessions:[{ day_label, exercises:[...] }] }.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { saveProgramSchema, saveProgram } from '@/lib/programs/engine';
import { createServiceClient } from '@/lib/supabase/service';

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
  const parsed = saveProgramSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const result = await saveProgram(ctx.companyId, ctx.userId, parsed.data);
  return apiSuccess(result, 201);
}

export async function GET(req: Request) {
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
