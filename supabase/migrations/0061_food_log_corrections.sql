-- 0061 PHASE 2 -- Correction-capture columns on food_log (FitnessOS Architecture v1, sections 4-5).
-- Every photo/text log can now carry: the confidence at capture, a link to the ai_inferences row that
-- produced it, and the ORIGINAL predicted grams. When the user logs a different portion than predicted,
-- corrected_at is stamped and the delta is written back to ai_inferences.correction - the supervised
-- signal that turns portion estimation (the hardest problem) into training data. All additive + nullable.
alter table public.food_log
  add column if not exists ai_inference_id  uuid references public.ai_inferences(id) on delete set null,
  add column if not exists predicted_grams  numeric,
  add column if not exists confidence_score numeric,
  add column if not exists corrected_at     timestamptz;

create index if not exists idx_food_log_inference on public.food_log (ai_inference_id) where ai_inference_id is not null;
