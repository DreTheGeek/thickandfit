// Substitution chains. POST (coach) saves a chain for a context; GET (authed) resolves for ?context.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { saveChainSchema, saveChain, resolveSubstitutions, CONTEXTS } from '@/lib/substitutions/engine';

export const dynamic = 'force-dynamic';

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
  const parsed = saveChainSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const result = await saveChain(ctx.companyId, (await params).id, parsed.data);
  return apiSuccess(result, 201);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const context = new URL(req.url).searchParams.get('context');
  if (!context || !(CONTEXTS as readonly string[]).includes(context)) {
    return apiError('Valid ?context required', 422);
  }
  const result = await resolveSubstitutions(ctx.companyId, (await params).id, context);
  return apiSuccess(result);
}
