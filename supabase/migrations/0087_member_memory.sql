-- Unified per-member learning memory. Prev migration: 0086_challenge_start_notice.sql.
--
-- Before this, the coach had two RAG corpora: per-member memory (match_coach_memory, unioning only
-- coach_messages + food_log day summaries) and per-company knowledge (match_coach_knowledge over
-- coach_knowledge). This adds ONE per-member vector store that every data source writes a summary +
-- embedding into, so the coach can semantically recall EVERYTHING a member does: meals + food photos,
-- chat, check-ins, meal plans, weights, intake, coach notes, progress/physique, workouts. It does not
-- replace match_coach_memory (kept working); the app's retrieval now prefers this store.
--
-- Carries BOTH member identities so migrated history and app-native data unify: profile_id for
-- claimed app users, contact_id for Lenus-migrated clients (either may be null). vector(1536) + HNSW
-- cosine to match text-embedding-3-small (the app embed model). The DB never embeds: the app
-- (indexMemory) embeds via OpenRouter then upserts here. Idempotent per logical item via
-- (company_id, source, source_id), so re-indexing a changed row updates it in place instead of
-- duplicating. superseded_at lets a newer fact retire an older one (contradiction resolution).

create table if not exists public.member_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid,
  contact_id uuid,
  -- food_day | message | meal_plan | checkin | weight | intake | coach_note | physique | measurement | habit | community | workout
  source text not null,
  -- stable logical key of the origin row (e.g. a message uuid, or "<profile>:<date>" for a food day)
  source_id text not null,
  kind text not null default 'episodic', -- episodic (a dated event) | fact (a durable trait) | summary
  content text not null,                 -- the natural-language text that was embedded (also human-readable)
  embedding vector(1536),
  occurred_at timestamptz not null default now(), -- when the underlying event happened (recency/temporal)
  superseded_at timestamptz,             -- set when a newer fact replaces this one
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_memory enable row level security;

-- Owner reads own rows; coaches read their whole company. Writes are service-client only (BYPASSRLS),
-- same pattern as the other AI tables.
create policy member_memory_rw on public.member_memory
  for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));

create unique index if not exists idx_member_memory_logical
  on public.member_memory (company_id, source, source_id);
create index if not exists idx_member_memory_profile on public.member_memory (profile_id) where profile_id is not null;
create index if not exists idx_member_memory_contact on public.member_memory (contact_id) where contact_id is not null;
create index if not exists idx_member_memory_embedding
  on public.member_memory using hnsw (embedding vector_cosine_ops);

-- Recall the top-N memories for a member (by profile_id OR contact_id) nearest to a query embedding.
-- Skips un-embedded + superseded rows. SECURITY DEFINER + member-scoped; service_role only, matching
-- match_coach_memory (the coach context builder runs on the service client).
create or replace function public.match_member_memory(
  p_profile_id uuid,
  p_contact_id uuid,
  query_embedding vector(1536),
  match_count int
) returns table (source text, kind text, content text, similarity float, occurred_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.source, m.kind, m.content,
         1 - (m.embedding <=> query_embedding) as similarity,
         m.occurred_at
  from public.member_memory m
  where m.embedding is not null
    and m.superseded_at is null
    and (
      (p_profile_id is not null and m.profile_id = p_profile_id)
      or (p_contact_id is not null and m.contact_id = p_contact_id)
    )
  order by m.embedding <=> query_embedding, m.occurred_at desc
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_member_memory(uuid, uuid, vector, int) from public;
revoke all on function public.match_member_memory(uuid, uuid, vector, int) from anon;
revoke all on function public.match_member_memory(uuid, uuid, vector, int) from authenticated;
grant execute on function public.match_member_memory(uuid, uuid, vector, int) to service_role;
