-- 0028 PHASE 2 — AI Coach foundation (subscriber-facing, in Stephanie's bilingual voice).
-- Three tables, all tenant-scoped with owner-or-coach RLS (mirrors food_log):
--   coach_messages   chat turns (user/assistant) + name embedding for retrieval.
--   user_insights    nightly Sonnet-extracted structured insights (jsonb), one snapshot per gen.
--   weight_entries   the subscriber's live body-weight log (feeds the coach context + the You goal).
-- HNSW on the embedding (semantic recall over past turns) + (profile_id, created_at) for the recent
-- window the context builder pulls. 0027 is taken on main, so this is 0028.

create extension if not exists vector;

-- ---------------------------------------------------------------------------------------------
-- coach_messages: one row per chat turn. embedding nullable (set only when the AI key is present).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null,                       -- the subscriber the conversation belongs to
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  embedding vector(1536),                          -- text-embedding-3-small; null when AI not configured
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_messages_profile_created
  on public.coach_messages (profile_id, created_at);
create index if not exists idx_coach_messages_embedding
  on public.coach_messages using hnsw (embedding vector_cosine_ops);

alter table public.coach_messages enable row level security;
drop policy if exists coach_messages_rw on public.coach_messages;
create policy coach_messages_rw on public.coach_messages for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));

-- ---------------------------------------------------------------------------------------------
-- user_insights: nightly structured snapshot the coach reads instead of re-deriving every turn.
-- payload jsonb is open-shaped (adherence, trends, suggested focus, etc.) so the extractor can grow.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null,
  generated_at date not null default (now() at time zone 'utc')::date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_insights_profile_created
  on public.user_insights (profile_id, created_at);

alter table public.user_insights enable row level security;
drop policy if exists user_insights_rw on public.user_insights;
create policy user_insights_rw on public.user_insights for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));

-- ---------------------------------------------------------------------------------------------
-- weight_entries: the subscriber's live body-weight log. weight stored in kg (canonical), the UI
-- converts to/from lb. source = manual | scale | import. Feeds the coach context + the You goal.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null,
  recorded_on date not null default (now() at time zone 'utc')::date,
  weight_kg numeric not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists idx_weight_entries_profile_recorded
  on public.weight_entries (profile_id, recorded_on);

alter table public.weight_entries enable row level security;
drop policy if exists weight_entries_rw on public.weight_entries;
create policy weight_entries_rw on public.weight_entries for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
