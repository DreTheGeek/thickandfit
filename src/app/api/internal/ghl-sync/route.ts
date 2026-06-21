// Scheduled GHL -> Supabase opportunity sync. Triggered by Vercel Cron (or any caller with the
// CRON_SECRET). Secret-gated; runs as the service role. Logs each run to cron_job_log.
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { syncGhlPipelines } from '@/lib/coach/ghl-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = createServiceClient();
  const { data: co, error } = await sb.from('companies').select('id').eq('slug', 'thick-and-fit').maybeSingle();
  if (error || !co) return NextResponse.json({ error: 'company_not_found' }, { status: 404 });

  const result = await syncGhlPipelines(co.id);
  void sb.from('cron_job_log').insert({
    job_name: 'ghl-sync-cron',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
