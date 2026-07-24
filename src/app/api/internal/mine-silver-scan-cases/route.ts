// K6: silver eval-case miner. Triggered weekly by pg_cron (tf-mine-silver-cases-weekly, Sun 09:00
// UTC) with the CRON_SECRET bearer; also callable manually. Ports the from-corrections mode of
// scripts/eval/seed-smart-scan-eval.mjs so the offline eval set grows with real production photos
// automatically instead of only when a developer runs the seed script. Runs FIRST in the weekly
// eval flow (mine at 09:00, run eval at 09:15) so freshly-mined silver cases score in the same run.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { mineSilverScanCases } from '@/lib/ai/eval/mine-silver-cases';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await mineSilverScanCases();
  after(() => logCronRun('mine-silver-scan-cases', result.ok ? 'success' : 'error', result));
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
