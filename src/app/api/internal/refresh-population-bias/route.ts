// K4: recompute the population portion bias. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service role.
//
// Scheduled rather than computed per scan because the aggregate reads every corrected photo-scan in
// the tenant. That is cheap nightly and absurd on the hot path of a scan that already carries a
// vision call plus food resolution.
//
// Daily is deliberate for a second reason: a prior that changes between two scans of the same plate
// would make the engine look unstable to the member who just corrected it. A stable snapshot that
// moves once a day is the honest shape for a signal built from a slow-moving population.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { resolveTenantId } from '@/lib/tenant';
import { refreshPopulationBias } from '@/lib/nutrition/population-bias-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const companyId = await resolveTenantId();
  const result = await refreshPopulationBias(companyId);

  after(() => logCronRun('refresh-population-bias-cron', result.ok ? 'success' : 'error', result));

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
