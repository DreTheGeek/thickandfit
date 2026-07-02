// Smart-scan eval endpoint. MANUAL trigger only (run after a model or prompt change): not in
// vercel.json crons, not in cron-register.sql. Secret-gated with the timing-safe compare, runs as
// the service role, logs to cron_job_log. Driven by scripts/eval/run-smart-scan-eval.mjs.
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { runSmartScanEval } from '@/lib/ai/eval/run-scan-eval';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ evalName: z.string().min(1).max(120).optional() }).strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 422 });
  }

  const result = await runSmartScanEval(parsed.data.evalName);

  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'run-scan-eval',
    status: result.status === 'ok' ? 'success' : 'error',
    detail:
      result.status === 'ok'
        ? { current: result.current, previous: result.previous, cases: result.perCase.length }
        : result,
  });

  return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 500 });
}
