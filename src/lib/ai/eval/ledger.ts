// Unified eval ledger. Every eval suite (smart-scan, chat-safety, ...) writes one summary row here
// per run, so the admin Evals page has a single cross-suite history timeline - "is quality holding
// as we change models and prompts." The per-case detail still lives in ai_eval_runs; this is the
// roll-up the 2026 "evals on every change" practice reads from.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type EvalRunLog = {
  companyId: string | null;
  suite: string; // smart-scan | chat-safety | plan-safety | insights
  cases: number;
  passed: number;
  score: number | null; // 0..1
  metrics?: Record<string, unknown>;
  commitSha?: string | null;
};

export async function logEvalRun(r: EvalRunLog): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('eval_run').insert({
      company_id: r.companyId,
      suite: r.suite,
      cases: r.cases,
      passed: r.passed,
      score: r.score,
      metrics: r.metrics ?? {},
      commit_sha: r.commitSha ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      status: 'done',
    });
  } catch (e) {
    console.error('logEvalRun:', e instanceof Error ? e.message : String(e));
  }
}
