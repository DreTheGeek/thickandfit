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
  generateReengagementNudges,
} from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Three daily member nudges: due check-ins, a one-time "finish onboarding" for abandoned signups,
  // and the re-engagement ladder for members who have gone quiet.
  //
  // The ladder rides this existing job rather than getting a pg_cron entry of its own, deliberately.
  // A new schedule is a manual Supabase registration, and a feature whose whole purpose is to work
  // while nobody is watching must not ship depending on somebody remembering to switch it on. This
  // job already runs daily, which is exactly the cadence the ladder wants.
  //
  // Sequential, not Promise.all: each generator writes notifications and the last one sweeps the
  // whole roster, so running them together only makes the slow one contend with the others.
  const result = await generateCheckinReminders();
  const onboarding = await generateOnboardingNudges();
  const reengagement = await generateReengagementNudges();
  const combined = { ...result, onboarding, reengagement };
  const ok = result.ok && onboarding.ok && reengagement.ok;

  after(() => logCronRun('notify-checkins-cron', ok ? 'success' : 'error', combined)); // survives the frozen lambda; insert failures now hit the function logs

  const failed = [result, onboarding, reengagement].find((r) => !r.ok);
  const body = ok ? combined : { ok: false as const, job: failed?.job ?? result.job };
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
