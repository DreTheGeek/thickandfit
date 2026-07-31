// The 9pm ET daily recap. Triggered by pg_cron via net.http_post with the CRON_SECRET bearer; also
// callable as GET for manual verification.
//
// FIRES TWICE, SENDS ONCE. pg_cron schedules in UTC, and 9pm ET is 01:00 UTC in summer and 02:00 UTC
// in winter. Rather than hardcode one and be an hour wrong for half the year, both are scheduled and
// this route sends only when the ET wall clock actually reads 21. Hardcoding 01:00 would be invisible
// in July and silently wrong every night from November, which is the worst kind of bug: correct when
// you build it, broken when you are not looking.
//
// `?force=1` bypasses the hour gate for manual testing.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { safeEqual } from '@/lib/api/auth';
import { logCronRun } from '@/lib/monitoring/cron-log';
import { resolveTenantId } from '@/lib/tenant';
import { sendDailyRecap, etDayBounds } from '@/lib/support/daily-recap';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SEND_AT_ET_HOUR = 21;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const { etHour, etDate } = etDayBounds(now);
  const force = new URL(req.url).searchParams.get('force') === '1';

  if (!force && etHour !== SEND_AT_ET_HOUR) {
    // The expected outcome for the twin that is not in season. Logged as success: a skip is the job
    // working, and marking it an error would make /health cry wolf once a day forever.
    const skipped = { ok: true, skipped: true, etHour, etDate };
    after(() => logCronRun('daily-recap-cron', 'success', skipped));
    return NextResponse.json(skipped);
  }

  const companyId = await resolveTenantId();
  const result = await sendDailyRecap(companyId, now);
  after(() => logCronRun('daily-recap-cron', result.ok ? 'success' : 'error', result));
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
