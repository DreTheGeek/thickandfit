// Progressive-overload recommendation for an exercise, computed from the client's real history.
import { resolveAuth } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { recommendForExercise } from '@/lib/workout/logging';

export const dynamic = 'force-dynamic';

async function GET_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  const sp = new URL(req.url).searchParams;
  // Number('') is 0 and Number('abc') is NaN, both bypass the ?? default. Guard with isFinite.
  const parseRep = (raw: string | null, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) && raw !== null && raw !== '' ? n : fallback;
  };
  const min = parseRep(sp.get('min'), 8);
  const max = parseRep(sp.get('max'), 12);

  const result = await recommendForExercise(ctx.companyId, ctx.userId, (await params).id, { min, max });
  return apiSuccess(result);
}

export const GET = withApiLog(GET_h);
