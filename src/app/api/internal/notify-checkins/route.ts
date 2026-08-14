// Daily member-nudge job. Triggered by pg_cron via net.http_post (POST) with the CRON_SECRET
// bearer; also callable as GET for manual verification. Secret-gated, service role.
//
// Runs the one-time "finish onboarding" nudge for abandoned signups and the re-engagement ladder
// for members who have gone quiet. Logs each run to cron_job_log. Never requires CRON_SECRET at
// import time (build-safe).
//
// The name is now a misnomer and stays anyway: check-ins moved to the hourly notify-reminders job
// on 2026-08-14, and renaming a route that pg_cron already points at is how a cron silently stops.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import {
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

  // Two daily member nudges: a one-time "finish onboarding" for abandoned signups, and the
  // re-engagement ladder for members who have gone quiet.
  //
  // Check-in reminders LEFT this route on 2026-08-14 for the hourly notify-reminders job. Their
  // cadence and send time now come from coach_settings, and "Monday at 6pm where she lives" cannot
  // be delivered by a job that fires once a day at a UTC hour. The route keeps its name: renaming a
  // registered pg_cron target is how a cron silently stops running.
  //
  // The ladder rides this existing job rather than getting a pg_cron entry of its own, deliberately.
  // A new schedule is a manual Supabase registration, and a feature whose whole purpose is to work
  // while nobody is watching must not ship depending on somebody remembering to switch it on. This
  // job already runs daily, which is exactly the cadence the ladder wants.
  //
  // Sequential, not Promise.all: each generator writes notifications and the last one sweeps the
  // whole roster, so running them together only makes the slow one contend with the others.
  const result = await generateOnboardingNudges();
  const reengagement = await generateReengagementNudges();
  const combined = { ...result, reengagement };
  const ok = result.ok && reengagement.ok;

  after(() => logCronRun('notify-checkins-cron', ok ? 'success' : 'error', combined)); // survives the frozen lambda; insert failures now hit the function logs

  const failed = [result, reengagement].find((r) => !r.ok);
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
