// Coach-only route. Demonstrates the role guard: 401 if unauthenticated, 403 if not a coach role.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!hasRole(ctx.role, COACH_ROLES)) return apiError('Forbidden', 403);
  return apiSuccess({ role: ctx.role, scope: 'coach' });
}
