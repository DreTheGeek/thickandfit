-- 0060 PHASE 2 -- AI provenance / gold-dataset spine (FitnessOS Architecture v1, section 5).
-- ai_usage_log stays PURE metering (tokens/cost). This is the AUDIT + REPLAY layer: one row per model
-- inference with its raw output, confidence, latency, and - once the user corrects it - the learning
-- signal. This is the moat data: prediction vs user-truth, accumulated per company, that makes every
-- future model + eval better. Written by the service client (fire-and-forget); coach-only read.
create table if not exists public.ai_inferences (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  profile_id          uuid,                     -- the member the inference was for (null for batch/coach)
  feature             text not null,            -- photo-scan | text-macro | coach-chat | plan-gen | physique | insights
  model               text not null,            -- resolved OpenRouter slug actually used
  prompt_version      text,                     -- bump when the prompt changes (replay grouping)
  input_hash          text,                     -- sha256 of the input (image/text) for dedupe + eval grouping
  raw_output          jsonb,                    -- the model's raw structured output (replayable)
  confidence          numeric,                  -- overall 0..1 when the model/pipeline emits it
  latency_ms          integer,
  status              text,                     -- ok | product | clarify | noFood | error | notConfigured
  item_count          integer,                  -- foods detected (meal scans)
  correction          jsonb,                    -- {field, predicted, corrected, ...} set when the user edits
  user_marked_correct boolean,                  -- true if the user accepted the inference as-is
  corrected_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_ai_inferences_company_feature on public.ai_inferences (company_id, feature, created_at desc);
create index if not exists idx_ai_inferences_input_hash on public.ai_inferences (input_hash);
create index if not exists idx_ai_inferences_corrected on public.ai_inferences (company_id, corrected_at) where corrected_at is not null;

alter table public.ai_inferences enable row level security;

-- Internal telemetry: coaches (via is_coach) read their company's inferences for eval/curation; nobody
-- else. All writes go through the service client in server code, so a direct subscriber read is zero rows.
drop policy if exists ai_inferences_coach_read on public.ai_inferences;
create policy ai_inferences_coach_read on public.ai_inferences for select
  using (company_id = public.current_company_id() and public.is_coach());
