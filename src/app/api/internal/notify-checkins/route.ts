// Daily check-in-due reminder generator. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service role.
// Nudges members with a published check-in form assigned and no response in the quiet window.
// Logs each run to cron_job_log. Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { generateCheckinReminders } from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await generateCheckinReminders();

  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'notify-checkins-cron',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });

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
