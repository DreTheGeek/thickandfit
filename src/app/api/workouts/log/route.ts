// Client logs a completed workout: sets + completion/enjoyment/effort ratings.
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { logSchema, saveWorkoutLog } from '@/lib/workout/logging';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  const result = await saveWorkoutLog(ctx.companyId, ctx.userId, parsed.data);
  return apiSuccess(result, 201);
}
