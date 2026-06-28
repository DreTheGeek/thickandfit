// Daily renewal + comp-expiry reminder generator. Triggered by pg_cron via net.http_post (POST)
// with the CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, service
// role. Nudges active subscriptions renewing soon and comped members whose access is about to lapse
// (notify only: demotion is computed by isEntitled). Logs each run to cron_job_log.
// Never requires CRON_SECRET at import time (build-safe).
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import {
  generateRenewalReminders,
  generateCompExpiryReminders,
} from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const renewals = await generateRenewalReminders();
  const comp = await generateCompExpiryReminders();
  const ok = renewals.ok && comp.ok;
  const result = { ok, renewals, comp };

  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'notify-renewals-cron',
    status: ok ? 'success' : 'error',
    detail: result,
  });

  const body = ok
    ? result
    : {
        ok: false as const,
        renewals: { job: renewals.job, selected: renewals.selected, notified: renewals.notified },
        comp: { job: comp.job, selected: comp.selected, notified: comp.notified },
      };
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return run(req);
}
