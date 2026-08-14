// Hourly local-time reminder generator. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service role.
//
// Three generators ride this one schedule, because all three deliver at a time that only makes
// sense in the MEMBER's timezone, and firing every hour is what lets a single UTC cron do that:
// the daily nudge at her reminder_hour, the cycle nudge, and (since 2026-08-14) check-in reminders
// at the weekday and local time the coach set in coach_settings.
//
// Logs each run to cron_job_log. Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import {
  generateLocalTimeReminders,
  generateCycleReminders,
  generateCheckinReminders,
} from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // All three run off this one hourly job: it already fires every hour so per-timezone local-hour
  // delivery works from a single schedule, which is exactly what the cycle nudge needs too.
  // Settled independently so a failure in one still lets the others send.
  //
  // Check-ins MOVED HERE from the daily notify-checkins route on 2026-08-14. Their cadence, weekday
  // and local send time now come from coach_settings, and a job that fires once a day at a UTC hour
  // cannot honour "Monday at 6pm where she lives". No new pg_cron entry was needed, which is the
  // whole reason it landed on this route rather than its own.
  const [result, cycle, checkins] = await Promise.all([
    generateLocalTimeReminders(),
    generateCycleReminders(),
    generateCheckinReminders(),
  ]);

  // after(): the audit insert must survive the frozen lambda, else a real run silently never logs
  // and ops cannot tell the cron ran (the exact gap the coverage audit flagged).
  after(() =>
    logCronRun('notify-reminders-cron', result.ok && cycle.ok && checkins.ok ? 'success' : 'error', {
      result,
      cycle,
      checkins,
    }),
  );

  // The raw error (if any) is persisted to cron_job_log.detail; don't echo internals on failure.
  const ok = result.ok && cycle.ok && checkins.ok;
  const failed = [result, cycle, checkins].find((r) => !r.ok);
  const body = ok ? { ...result, cycle, checkins } : { ok: false as const, job: failed?.job ?? result.job };
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
