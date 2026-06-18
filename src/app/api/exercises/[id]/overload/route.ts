// Progressive-overload recommendation for an exercise, computed from the client's real history.
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { recommendForExercise } from '@/lib/workout/logging';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const sp = new URL(req.url).searchParams;
  const min = Number(sp.get('min') ?? 8);
  const max = Number(sp.get('max') ?? 12);

  const result = await recommendForExercise(ctx.companyId, ctx.userId, (await params).id, { min, max });
  return apiSuccess(result);
}
