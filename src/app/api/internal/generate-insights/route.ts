// Nightly insight engine endpoint. Triggered by pg_cron via net.http_post (POST) with the
// CRON_SECRET bearer; also callable as GET for manual verification. Secret-gated, runs as the
// service role. For each active subscriber it extracts a 30-day coaching snapshot and upserts
// user_insights. Idempotent per (profile_id, generated_at). Logs each run to cron_job_log.
// NOTE: this route was GET-only while the registered pg_cron job POSTs - the nightly run would have
// 405'd forever. Both methods now run; auth uses the timing-safe compare like every sibling route.
import { NextResponse, type NextRequest } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { generateAllInsights } from '@/lib/coach-ai/insights';
import { recomputeAllGamification } from '@/lib/gamification/batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await generateAllInsights();

  // Folded into this nightly run (no separate cron): recompute streaks + award badges for the
  // active-subscriber set. Idempotent; failures here do not fail the insight run.
  let gamification: Awaited<ReturnType<typeof recomputeAllGamification>> | { ok: false; error: string };
  try {
    gamification = await recomputeAllGamification();
  } catch (e) {
    gamification = { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }

  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'generate-insights-cron',
    status: result.ok ? 'success' : 'error',
    detail: { insights: result, gamification },
  });

  return NextResponse.json({ insights: result, gamification }, { status: result.ok ? 200 : 500 });
}

async function GET_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function POST_h(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export const GET = withApiLog(GET_h);
export const POST = withApiLog(POST_h);
