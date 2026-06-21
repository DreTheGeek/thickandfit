-- 0030 PHASE 2: Layer 3 vector memory / RAG for the subscriber AI coach.
-- The nightly insight engine writes a natural-language summary of each recent day's food_log and
-- embeds it; the chat route embeds the member's question and retrieves the most semantically similar
-- past records (their own coach_messages + day summaries) to inject as context before calling Haiku.
--
-- coach_messages already carries embedding vector(1536) + an HNSW index (0028). This migration:
--   1. adds food_log.log_summary (text) + food_log.embedding vector(1536), one summary per day-row
--      we choose to embed (the nightly job picks one representative row per day).
--   2. adds an HNSW cosine index on food_log.embedding for fast recall.
--   3. adds match_coach_memory(): a single RPC that returns the top-N most similar past records for a
--      subscriber, drawn from BOTH coach_messages and the food_log day summaries, ordered by cosine
--      distance. SECURITY DEFINER + an explicit profile_id filter (the caller authorizes the profile).
-- 0029 is taken (user_insights_idempotent), so this is 0030. pgvector is already enabled (0023/0028).

create extension if not exists vector;

-- ---------------------------------------------------------------------------------------------
-- food_log embedding columns. Both nullable: only set when the AI key is present (key-gated). When
-- absent, the nightly job skips embedding and chat retrieval simply finds nothing here (chat still
-- works). log_summary is the natural-language day recap the embedding was built from (also useful
-- as the human-readable snippet injected into the coach context).
-- ---------------------------------------------------------------------------------------------
alter table public.food_log
  add column if not exists log_summary text,
  add column if not exists embedding vector(1536);

create index if not exists idx_food_log_embedding
  on public.food_log using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------------------------
-- match_coach_memory: cosine-similarity recall over one subscriber's own AI memory.
-- Returns the top `match_count` records (across coach_messages + embedded food_log day summaries)
-- nearest to `query_embedding`, newest-tie-broken, with a stable shape the chat route can render.
-- source = 'message' | 'food_log'. similarity = 1 - cosine_distance (higher is closer).
-- Hard-scoped to p_profile_id so it can never leak another member's memory even though it runs as
-- definer; the calling route authorizes the profile_id before invoking this.
-- ---------------------------------------------------------------------------------------------
create or replace function public.match_coach_memory(
  p_profile_id uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  source text,
  content text,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with hits as (
    select
      'message'::text as source,
      m.content,
      1 - (m.embedding <=> query_embedding) as similarity,
      m.created_at
    from public.coach_messages m
    where m.profile_id = p_profile_id
      and m.embedding is not null

    union all

    select
      'food_log'::text as source,
      f.log_summary as content,
      1 - (f.embedding <=> query_embedding) as similarity,
      f.logged_at as created_at
    from public.food_log f
    where f.profile_id = p_profile_id
      and f.embedding is not null
      and f.log_summary is not null
  )
  select source, content, similarity, created_at
  from hits
  order by similarity desc, created_at desc
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_coach_memory(uuid, vector, int) from public;
grant execute on function public.match_coach_memory(uuid, vector, int) to authenticated, service_role;
