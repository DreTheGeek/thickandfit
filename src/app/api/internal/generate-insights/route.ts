// Nightly insight engine endpoint. Triggered by Vercel Cron (or any caller with CRON_SECRET).
// Secret-gated, runs as the service role. For each active subscriber it extracts a 30-day coaching
// snapshot (claude-sonnet-4-6 when keyed, deterministic rollups otherwise) and upserts user_insights.
// Idempotent per (profile_id, generated_at). Logs each run to cron_job_log. Mirrors ghl-sync/route.ts.
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateAllInsights } from '@/lib/coach-ai/insights';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await generateAllInsights();

  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'generate-insights-cron',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
