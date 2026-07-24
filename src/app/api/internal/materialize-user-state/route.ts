// K3 endpoint: triggered by pg_cron (tf-materialize-user-state-nightly, 08:30 UTC) with the
// CRON_SECRET bearer. Also callable as GET for manual verification. Secret-gated, runs as the
// service role. For each subscriber it recomputes user_state and upserts it; idempotent per
// (company_id, profile_id). Logs the run to cron_job_log. Mirrors generate-insights/route.ts.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { materializeAllUserStates } from '@/lib/user-state/materialize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await materializeAllUserStates();
  after(() => logCronRun('materialize-user-state-cron', result.ok ? 'success' : 'error', result));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

async function GET_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}
async function POST_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export const GET = withApiLog(GET_h);
export const POST = withApiLog(POST_h);
