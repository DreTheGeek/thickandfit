// Member-memory indexer trigger (phase 2). Reconciles every per-member data source into the unified
// member_memory store (embed + upsert, idempotent + capped). Secret-gated, service role.
//
// POST/GET { scope?: 'active'|'all', sinceDays?: number, maxMembers?: number }
//   scope 'active' (default) = app subscribers, the recurring sweep.
//   scope 'all' + sinceDays large = the historical backfill (every profile + unclaimed migrated contacts).
// Auth: CRON_SECRET bearer (same trust as the other internal jobs). Never requires the key at import.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { runMemoryIndex } from '@/lib/coach-ai/memory-index';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { scope?: string; sinceDays?: number; maxMembers?: number } = {};
  try {
    body = ((await req.json()) as typeof body) ?? {};
  } catch {
    // empty body -> defaults (active sweep)
  }
  const scope: 'active' | 'all' = body.scope === 'all' ? 'all' : 'active';
  const result = await runMemoryIndex({
    scope,
    sinceDays: typeof body.sinceDays === 'number' ? body.sinceDays : undefined,
    maxMembers: typeof body.maxMembers === 'number' ? body.maxMembers : undefined,
  });

  after(() => logCronRun('index-memory-cron', result.ok ? 'success' : 'error', { scope, ...result }));
  return NextResponse.json({ scope, ...result }, { status: result.ok ? 200 : 500 });
}

export const GET = withApiLog((req: NextRequest) => run(req));
export const POST = withApiLog((req: NextRequest) => run(req));
