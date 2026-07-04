// Chat safety + groundedness eval endpoint. MANUAL / CI trigger (run after a chat model or prompt or
// safety-clause change). Secret-gated with the timing-safe compare, runs as the service role, logs to
// cron_job_log + eval_run. Mirrors run-scan-eval.
import { NextResponse, type NextRequest, after } from 'next/server';
import { withApiLog } from '@/lib/telemetry/request-log';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { runChatEval } from '@/lib/ai/eval/run-chat-eval';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ evalName: z.string().min(1).max(120).optional() }).strict();

async function POST_h(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 422 });

  const result = await runChatEval(parsed.data.evalName);

  // after(): the audit insert must survive the frozen lambda, so it is not dropped on Vercel.
  after(async () => {
    const sb = createServiceClient();
    await sb.from('cron_job_log').insert({
      job_name: 'run-chat-eval',
      status: result.status === 'ok' ? 'success' : 'error',
      detail: result.status === 'ok' ? { cases: result.cases, passed: result.passed, score: result.score } : result,
    });
  });

  return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 500 });
}

export const POST = withApiLog(POST_h);
