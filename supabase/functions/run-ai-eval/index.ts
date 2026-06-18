// run-ai-eval (Deno edge function). Loads an eval + its cases, runs them, logs ai_eval_runs.
// Foundation harness: the per-feature evaluator is registered by each AI feature's PRD.
import { serviceClient, apiSuccess, apiError } from '../_shared/api.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return apiError('Method not allowed', 405);

  let body: { eval_id?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body');
  }
  const evalId = body?.eval_id;
  if (!evalId) return apiError('eval_id is required');

  const supabase = serviceClient();

  const { data: evalRow } = await supabase
    .from('ai_evals')
    .select('id, company_id, feature')
    .eq('id', evalId)
    .maybeSingle();
  if (!evalRow) return apiError('Eval not found', 404);

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
