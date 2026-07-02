-- 0065 -- Batch provenance on ai_eval_runs (tables shipped in 0002, first consumed now).
-- One eval invocation = one run_id across its per-case rows, and each row records the model +
-- prompt_version actually under test (a mid-run 429 fallback answers with a different model, and
-- without per-row attribution that silently contaminates the comparison). "This run vs the previous
-- run, grouped by model" is the harness's core query; it needs these columns, not jsonb spelunking.
alter table public.ai_eval_runs
  add column if not exists run_id uuid,
  add column if not exists model text,
  add column if not exists prompt_version text;

create index if not exists idx_ai_eval_runs_batch
  on public.ai_eval_runs (ai_eval_id, run_id, created_at desc);
