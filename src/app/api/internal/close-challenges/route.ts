// Daily challenge-close generator. Triggered by pg_cron via net.http_post (POST) with the CRON_SECRET
// bearer; also callable as GET for manual verification. Secret-gated, service role. Finalizes every
// challenge past its ends_on (award the Challenge Champion badge to the leader + notify all
// participants), exactly once via challenges.finalized_at. Logs each run to cron_job_log.
// Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { finalizeEndedChallenges, generateChallengeOpenNotices } from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Two daily challenge-lifecycle jobs: notify members when a challenge OPENS (future-dated ones on
  // their start day) and finalize/award those that ENDED.
  const opened = await generateChallengeOpenNotices();
  const result = await finalizeEndedChallenges();
  const combined = { ...result, opened };

  after(() => logCronRun('close-challenges-cron', result.ok && opened.ok ? 'success' : 'error', combined)); // survives the frozen lambda; insert failures now hit the function logs

  return NextResponse.json(combined, { status: result.ok && opened.ok ? 200 : 500 });
}

async function GET_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function POST_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export const GET = withApiLog(GET_h);
export const POST = withApiLog(POST_h);
