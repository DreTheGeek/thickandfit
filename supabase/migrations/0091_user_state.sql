-- 0091: user_state — the materialized member snapshot every AI surface reads instead of recomputing.
--
-- The scan pipeline (K1), coach chat, dashboard, and the eventual prediction engine (K7) + meal
-- recommender (K8) all need the same facts about a member: their goal + where they are on it,
-- adherence over the last 30 days, favorite foods, scan-quality reliability. Computing that per
-- request costs the same six queries every time. This table freezes it into ONE row per member per
-- day, materialized by the nightly cron (tf-materialize-user-state-nightly, 08:30 UTC — 30 min
-- after insights, so K3 can read insights output if it wants).
--
-- Unique on (company_id, profile_id): one row per member, replaced in place each night. No history
-- kept here — historical trend is derivable from weight_entries / food_log / daily_metrics. This
-- table is the CURRENT state, always freshest, always cheap to read.

create table if not exists public.user_state (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  profile_id               uuid not null references public.profiles(id) on delete cascade,

  -- Goal + trajectory
  goal_type                text,             -- from onboarding_responses.goal_type
  primary_goal             text,             -- 'lose' | 'maintain' | 'gain' from onboarding_responses.answers.goal
  starting_weight_kg       numeric,
  current_weight_kg        numeric,
  goal_weight_kg           numeric,
  weight_change_kg_7d      numeric,          -- signed: negative = weight lost in last 7d
  weight_change_kg_30d     numeric,

  -- 30-day rolling adherence
  logging_days_30d         integer check (logging_days_30d is null or (logging_days_30d >= 0 and logging_days_30d <= 30)),
  avg_kcal_30d             numeric,
  avg_protein_g_30d        numeric,
  target_kcal              integer,
  target_protein_g         integer,
  kcal_adherence_pct       integer check (kcal_adherence_pct is null or (kcal_adherence_pct >= 0 and kcal_adherence_pct <= 300)),
  protein_adherence_pct    integer check (protein_adherence_pct is null or (protein_adherence_pct >= 0 and protein_adherence_pct <= 300)),
  workout_days_30d         integer check (workout_days_30d is null or (workout_days_30d >= 0 and workout_days_30d <= 30)),
  training_days_per_week   numeric,

  -- Behavior patterns (jsonb for flexibility as we learn what shape helps most)
  -- favorite_foods: [{ name: string, count: number, avg_grams: number }] top 5 by count
  favorite_foods           jsonb,
  -- scan_quality: mirror of fetchScanQuality output for THIS member (correction_rate, portion error, top corrected)
  scan_quality             jsonb,

  computed_at              timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (company_id, profile_id)
);

create index if not exists idx_user_state_profile on public.user_state (profile_id);
create index if not exists idx_user_state_company on public.user_state (company_id);

-- updated_at trigger (0001 defines set_updated_at() app-wide)
drop trigger if exists trg_user_state_updated_at on public.user_state;
create trigger trg_user_state_updated_at
  before update on public.user_state
  for each row execute function public.set_updated_at();

-- RLS: same shape as daily_metrics (0088) — owner reads/writes own, coach reads company for context.
-- Writes only happen from the materialize job which uses the service client (bypasses RLS anyway),
-- but the policy allows owner writes so a self-serve edit path stays possible later.
alter table public.user_state enable row level security;
drop policy if exists user_state_rw on public.user_state;
create policy user_state_rw on public.user_state for all
  using (
    profile_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_coach())
  )
  with check (
    profile_id = auth.uid()
    or (company_id = public.current_company_id() and public.is_coach())
  );

comment on table public.user_state
  is 'Materialized per-member snapshot updated nightly by tf-materialize-user-state-nightly (08:30 UTC). One row per member, replaced in place. Read by K1/K7/K8 and any AI surface that needs member context without recomputing.';
