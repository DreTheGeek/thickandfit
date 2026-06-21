// run-ai-eval (Deno edge function). Loads an eval + its cases, runs them, logs ai_eval_runs.
// Foundation harness: the per-feature evaluator is registered by each AI feature's PRD.
import { serviceClient, apiSuccess, apiError, validateApiKey } from '../_shared/api.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

const cronSecret = Deno.env.get('CRON_SECRET') ?? '';

const bodySchema = z.object({ eval_id: z.string().uuid() });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return apiError('Method not allowed', 405);

  // Auth gate: accept a CRON_SECRET bearer (scheduled invocation) OR a valid API key.
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  const cronOk = cronSecret.length > 0 && token !== null && timingSafeEqual(token, cronSecret);
  const apiKeyCtx = cronOk ? null : await validateApiKey(token);
  if (!cronOk && !apiKeyCtx) return apiError('Unauthorized', 401);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return apiError('Invalid JSON body');
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return apiError('eval_id must be a valid uuid', 422);
  const evalId = parsed.data.eval_id;

  const supabase = serviceClient();

  const { data: evalRow } = await supabase
    .from('ai_evals')
    .select('id, company_id, feature')
    .eq('id', evalId)
    .maybeSingle();
  if (!evalRow) return apiError('Eval not found', 404);

  // When authenticated via an API key, the eval must belong to that key's company.
  if (apiKeyCtx && evalRow.company_id !== apiKeyCtx.companyId) {
    return apiError('Eval not found', 404);
  }

  const { data: cases } = await supabase
    .from('ai_eval_cases')
    .select('id, input, expected')
    .eq('ai_eval_id', evalId);

  // Evaluator registry: maps a feature key to its scoring fn. Populated per AI-feature PRD.
  const evaluators: Record<
    string,
    (input: unknown, expected: unknown) => Promise<{ passed: boolean; actual: unknown; score: number }>
  > = {};
  const evaluate = evaluators[evalRow.feature];

  let passed = 0;
  for (const c of cases ?? []) {
    const result = evaluate
      ? await evaluate(c.input, c.expected)
      : { passed: false, actual: null, score: 0 }; // no evaluator registered yet
    await supabase.from('ai_eval_runs').insert({
      company_id: evalRow.company_id,
      ai_eval_id: evalId,
      ai_eval_case_id: c.id,
      passed: result.passed,
      actual: result.actual,
      score: result.score,
    });
    if (result.passed) passed++;
  }

  return apiSuccess({
    eval_id: evalId,
    feature: evalRow.feature,
    total: cases?.length ?? 0,
    passed,
    evaluator_registered: Boolean(evaluate),
  });
});
