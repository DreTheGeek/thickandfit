// Daily check-in-due reminder generator. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service role.
// Nudges members with a published check-in form assigned and no response in the quiet window.
// Logs each run to cron_job_log. Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import {
  generateCheckinReminders,
  generateOnboardingNudges,
} from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Two daily member nudges: due check-ins, and a one-time "finish onboarding" for abandoned signups.
  const result = await generateCheckinReminders();
  const onboarding = await generateOnboardingNudges();
  const combined = { ...result, onboarding };
  const ok = result.ok && onboarding.ok;

  after(() => logCronRun('notify-checkins-cron', ok ? 'success' : 'error', combined)); // survives the frozen lambda; insert failures now hit the function logs

  const body = ok ? combined : { ok: false as const, job: result.ok ? onboarding.job : result.job };
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}

async function GET_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function POST_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export const GET = withApiLog(GET_h);
export const POST = withApiLog(POST_h);
