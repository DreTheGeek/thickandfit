// Smart-scan eval engine. Runs the EXACT production pipeline (analyzeSmartPhoto: model chain,
// prompt, resolve step) against the labeled golden set in ai_evals/ai_eval_cases, scores each case
// (scan-scoring.ts), and writes one ai_eval_runs row per case under a single run_id. This is the
// instrument that answers "did that model/prompt change help" in minutes instead of vibes.
//
// EVAL PURITY: analyzeSmartPhoto is called WITHOUT ctx, so synthetic eval scans never write
// ai_inferences rows and never pollute the coach intelligence dashboard. Eval spend is real
// OpenRouter spend: keep the golden set small (10-20 cases) and concurrency low.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { analyzeSmartPhoto, PROMPT_VERSION } from '@/lib/nutrition/smart-scan';
import { AI_MODELS } from '@/lib/ai/models';
import { scoreCase, type ExpectedCase, type PredictedEvalItem } from '@/lib/ai/eval/scan-scoring';
import { logEvalRun } from '@/lib/ai/eval/ledger';

const DEFAULT_EVAL_NAME = 'smart-scan-golden-v1';
const BUCKET = 'food-photos';
const CONCURRENCY = 3;

const CaseInput = z.object({
  storage_path: z.string().min(1),
  locale: z.enum(['en', 'es']).default('en'),
});
const CaseExpected = z.object({
  kind: z.enum(['meal', 'product']),
  // fat_g is OPTIONAL per item: legacy cases carry none and must keep scoring exactly as before.
  items: z.array(z.object({ name: z.string().min(1), grams: z.number().positive(), fat_g: z.number().nonnegative().optional() })).min(1),
  // Whole-plate fat label. Zod STRIPS unknown keys, so these three had to be declared here or the
  // manifest's fat labels would be silently dropped before scoring ever saw them.
  total_fat_g: z.number().nonnegative().optional(),
  oil_used: z.boolean().optional(),
  source: z.string().optional(), // 'manifest' (gold) | 'correction-join' (silver)
});

export type EvalRunSummary = {
  runId: string;
  model: string;
  promptVersion: string;
  cases: number;
  passed: number;
  avgScore: number;
  avgF1: number;
  avgMape: number | null;
  avgLatencyMs: number;
  /** Mean SIGNED fat error (g) across fat-labeled cases. Negative = underestimating, the NIH bias. */
  meanFatBiasG: number | null;
  /** Same, restricted to plates labeled oil_used: where the bias is expected to concentrate. */
  meanFatBiasOilG: number | null;
};

export type EvalCaseResult = {
  caseId: string;
  passed: boolean;
  score: number;
  f1: number;
  mape: number | null;
  fatBiasG: number | null;
  latencyMs: number;
  note: string;
};

export type EvalRunResult =
  | { status: 'ok'; evalId: string; current: EvalRunSummary; previous: EvalRunSummary | null; perCase: EvalCaseResult[] }
  | { status: 'noCases' }
  | { status: 'notConfigured' }
  | { status: 'error'; message: string };

type CaseRow = { id: string; input: unknown; expected: unknown };
type RunRow = {
  run_id: string | null;
  model: string | null;
  prompt_version: string | null;
  passed: boolean;
  score: number | null;
  latency_ms: number | null;
  actual: { f1?: number; mape?: number | null; fat_bias_g?: number | null; oil_used?: boolean | null } | null;
};

function summarize(runId: string, rows: RunRow[]): EvalRunSummary {
  const mapes = rows.map((r) => r.actual?.mape).filter((m): m is number => typeof m === 'number');
  // Only fat-LABELED cases contribute. An unlabeled case is absent from the metric, not a zero:
  // averaging in zeros would drag any real bias toward 'no problem here'.
  const fatAll = rows.map((r) => r.actual?.fat_bias_g).filter((x): x is number => typeof x === 'number');
  const fatOil = rows.filter((r) => r.actual?.oil_used === true).map((r) => r.actual?.fat_bias_g).filter((x): x is number => typeof x === 'number');
  const models = new Map<string, number>();
  for (const r of rows) if (r.model) models.set(r.model, (models.get(r.model) ?? 0) + 1);
  const majorityModel = [...models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
  const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    runId,
    model: majorityModel,
    promptVersion: rows[0]?.prompt_version ?? PROMPT_VERSION,
    cases: rows.length,
    passed: rows.filter((r) => r.passed).length,
    avgScore: Math.round(avg(rows.map((r) => r.score ?? 0))),
    avgF1: Math.round(avg(rows.map((r) => r.actual?.f1 ?? 0)) * 1000) / 1000,
    avgMape: mapes.length ? Math.round(avg(mapes) * 1000) / 1000 : null,
    avgLatencyMs: Math.round(avg(rows.map((r) => r.latency_ms ?? 0))),
    meanFatBiasG: fatAll.length ? Math.round(avg(fatAll) * 10) / 10 : null,
    meanFatBiasOilG: fatOil.length ? Math.round(avg(fatOil) * 10) / 10 : null,
  };
}

async function runOneCase(
  svc: ReturnType<typeof createServiceClient>,
  evalRow: { id: string; company_id: string },
  runId: string,
  c: CaseRow,
): Promise<EvalCaseResult> {
  const input = CaseInput.safeParse(c.input);
  const expected = CaseExpected.safeParse(c.expected);
  if (!input.success || !expected.success) {
    return { caseId: c.id, passed: false, score: 0, f1: 0, mape: null, fatBiasG: null, latencyMs: 0, note: 'invalid case shape (skipped)' };
  }

  const dl = await svc.storage.from(BUCKET).download(input.data.storage_path);
  if (dl.error || !dl.data) {
    return { caseId: c.id, passed: false, score: 0, f1: 0, mape: null, fatBiasG: null, latencyMs: 0, note: `image download failed: ${dl.error?.message ?? 'no data'}` };
  }
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const mime = input.data.storage_path.endsWith('.png')
    ? 'image/png'
    : input.data.storage_path.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const t0 = Date.now();
  // NO ctx: eval scans must not write ai_inferences (purity, see module header).
  const result = await analyzeSmartPhoto(dataUrl, input.data.locale);
  const latencyMs = Date.now() - t0;

  let actualKind: 'meal' | 'product' | 'other' = 'other';
  let predicted: PredictedEvalItem[] = [];
  let model = 'unknown';
  if (result.status === 'ok') {
    actualKind = 'meal';
    model = result.model ?? 'unknown';
    predicted = result.candidates.map((cand) => ({
      name: cand.predictedName,
      grams: cand.grams,
      confidence: cand.confidence,
      // Resolved fat, already scaled to the predicted portion by the resolve step. Carried here so
      // scan-scoring can compute the signed fat bias while staying IO-free: resolution is this
      // module's job, scoring is that one's.
      fatG: cand.macros?.fatG ?? null,
    }));
  } else if (result.status === 'product') {
    actualKind = 'product';
    model = result.model ?? 'unknown';
    // Per-100g row read at a 100g assumption, so its fat is the row's fat as-is.
    predicted = [{ name: result.food.name, grams: 100, confidence: 1, fatG: result.food.fatG ?? null }];
  }

  const s = scoreCase(expected.data as ExpectedCase, actualKind, predicted);
  const { error } = await svc.from('ai_eval_runs').insert({
    company_id: evalRow.company_id,
    ai_eval_id: evalRow.id,
    ai_eval_case_id: c.id,
    passed: s.passed,
    score: s.score,
    latency_ms: latencyMs,
    run_id: runId,
    model,
    prompt_version: PROMPT_VERSION,
    // Self-contained row: everything needed to re-read this case's grading without joins.
    actual: {
      kind: actualKind,
      scan_status: result.status,
      items: predicted,
      f1: s.f1,
      mape: s.mape,
      // Signed grams (predicted minus label). Reported, never part of pass/fail: a bar cannot be
      // set before a baseline exists. oil_used lets the report split oil plates from dry ones,
      // which is where the NIH bias concentrates.
      fat_bias_g: s.fatBiasG,
      oil_used: (expected.data as ExpectedCase).oil_used ?? null,
      matched_pairs: s.matchedPairs,
      expected_source: expected.data.source ?? 'manifest',
    },
  });
  if (error) console.error('eval run insert:', error.message);

  return {
    caseId: c.id,
    passed: s.passed,
    score: s.score,
    f1: s.f1,
    mape: s.mape,
    fatBiasG: s.fatBiasG,
    latencyMs,
    note: s.passed ? 'pass' : `kind=${actualKind} f1=${s.f1} mape=${s.mape ?? 'n/a'}`,
  };
}

export async function runSmartScanEval(evalName?: string): Promise<EvalRunResult> {
  if (!process.env.OPENROUTER_API_KEY) return { status: 'notConfigured' };
  try {
    const svc = createServiceClient();
    const { data: evalRow } = await svc
      .from('ai_evals')
      .select('id, company_id, name')
      .eq('feature', 'photo-scan')
      .eq('name', evalName ?? DEFAULT_EVAL_NAME)
      .maybeSingle();
    if (!evalRow) return { status: 'noCases' };

    const { data: cases } = await svc
      .from('ai_eval_cases')
      .select('id, input, expected')
      .eq('ai_eval_id', evalRow.id)
      .order('created_at', { ascending: true });
    if (!cases?.length) return { status: 'noCases' };

    const runId = randomUUID();
    const queue = [...(cases as CaseRow[])];
    const perCase: EvalCaseResult[] = [];
    // Simple promise pool: CONCURRENCY workers drain the queue (rate-limit friendly; a 429 storm
    // would trigger the gemini fallback and quietly change what is being measured).
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          perCase.push(await runOneCase(svc, evalRow, runId, c));
        }
      }),
    );

    // Summaries: this run + the most recent prior run of the same eval.
    const { data: currentRows } = await svc
      .from('ai_eval_runs')
      .select('run_id, model, prompt_version, passed, score, latency_ms, actual')
      .eq('ai_eval_id', evalRow.id)
      .eq('run_id', runId);
    const current = summarize(runId, (currentRows ?? []) as RunRow[]);

    let previous: EvalRunSummary | null = null;
    const { data: prior } = await svc
      .from('ai_eval_runs')
      .select('run_id, created_at')
      .eq('ai_eval_id', evalRow.id)
      .not('run_id', 'is', null)
      .neq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const priorRunId = (prior as { run_id: string | null } | null)?.run_id;
    if (priorRunId) {
      const { data: prevRows } = await svc
        .from('ai_eval_runs')
        .select('run_id, model, prompt_version, passed, score, latency_ms, actual')
        .eq('ai_eval_id', evalRow.id)
        .eq('run_id', priorRunId);
      if (prevRows?.length) previous = summarize(priorRunId, prevRows as RunRow[]);
    }

    // Roll up into the unified eval ledger so this run shows on the admin Evals timeline.
    await logEvalRun({
      companyId: evalRow.company_id,
      suite: 'smart-scan',
      cases: current.cases,
      passed: current.passed,
      score: current.cases ? current.passed / current.cases : 0,
      metrics: { model: current.model, avgF1: current.avgF1, avgMape: current.avgMape, avgScore: current.avgScore, avgLatencyMs: current.avgLatencyMs, meanFatBiasG: current.meanFatBiasG, meanFatBiasOilG: current.meanFatBiasOilG },
    });

    return { status: 'ok', evalId: evalRow.id, current, previous, perCase };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('runSmartScanEval:', message);
    return { status: 'error', message };
  }
}
