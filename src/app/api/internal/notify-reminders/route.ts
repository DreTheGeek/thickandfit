// Hourly local-time reminder generator. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service role.
// Fires the daily nudge to active members whose CURRENT LOCAL HOUR equals their reminder_hour, so
// "7pm in each user's zone" works off a single UTC-hourly cron. Logs each run to cron_job_log.
// Mirrors generate-insights/route.ts. Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { generateLocalTimeReminders } from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await generateLocalTimeReminders();

  // after(): the audit insert must survive the frozen lambda, else a real run silently never logs
  // and ops cannot tell the cron ran (the exact gap the coverage audit flagged).
  after(async () => {
    await createServiceClient().from('cron_job_log').insert({
      job_name: 'notify-reminders-cron',
      status: result.ok ? 'success' : 'error',
      detail: result,
    });
  });

  // The raw error (if any) is persisted to cron_job_log.detail; don't echo internals on failure.
  const body = result.ok ? result : { ok: false as const, job: result.job };
  return NextResponse.json(body, { status: result.ok ? 200 : 500 });
}

async function GET_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function POST_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export const GET = withApiLog(GET_h);
export const POST = withApiLog(POST_h);
