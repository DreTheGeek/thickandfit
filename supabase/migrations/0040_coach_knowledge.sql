-- 0040 PHASE 2: Coach Knowledge Base. Stephanie's voice / method / FAQ text, pasted by a coach,
-- chunked + embedded, company-scoped (her "brain", shared across all her members), retrieved into
-- the coach system prompt at chat time to ground replies in her real method.
--
-- This mirrors coach_messages (0028) for the embedding column + HNSW index, and match_coach_memory
-- (0030) for cosine recall, but keyed on company_id instead of profile_id (knowledge is the company's,
-- not one member's). 0039_timezone_and_cron.sql is taken (WP11), so this is 0040.
--
-- Embedding stack is FIXED: openai/text-embedding-3-small at 1536 dims (see embeddings.ts). The
-- embedding column MUST be vector(1536) HNSW vector_cosine_ops or all retrieval breaks. embedding is
-- nullable: with no OPENROUTER_API_KEY the ingest stores chunks with embedding null (still readable;
-- RAG simply finds nothing until the key + a backfill land), exactly like coach_messages / food_log.

create extension if not exists vector;

-- ---------------------------------------------------------------------------------------------
-- coach_knowledge: one row per chunk. Chunks from one paste/document share a source_id + title so a
-- source can be listed + deleted as a unit. content is injected verbatim into the prompt on retrieval.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.coach_knowledge (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,                          -- tenant scope (Stephanie = tenant 1)
  source_id uuid not null default gen_random_uuid(), -- groups chunks from one paste/document
  title text,                                        -- human label for the source document
  chunk_index int not null default 0,                -- order within the source
  content text not null,                             -- the chunk text (also injected verbatim)
  embedding vector(1536),                            -- text-embedding-3-small; null when AI not configured
  created_by uuid,                                   -- coach profile id who ingested
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_knowledge_company on public.coach_knowledge (company_id, source_id);
create index if not exists idx_coach_knowledge_embedding
  on public.coach_knowledge using hnsw (embedding vector_cosine_ops);

alter table public.coach_knowledge enable row level security;

-- Coaches (coach / assistant_coach / operator, via is_coach) manage their company's knowledge; nobody
-- else touches it. The chat lib reads via the service client, and the match RPC below is SECURITY
-- DEFINER + company-keyed, so subscribers never need a direct read grant. Keeping this coach-only (no
-- subscriber select policy) means the RLS isolation test sees zero rows as a subscriber, matching the
-- "knowledge is the company's brain, not member data" intent and avoiding any cross-tenant read path.
drop policy if exists coach_knowledge_rw on public.coach_knowledge;
create policy coach_knowledge_rw on public.coach_knowledge for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- match_coach_knowledge: top-N knowledge chunks for ONE company nearest to query_embedding. Mirrors
-- match_coach_memory (0030) but keyed on company_id. SECURITY DEFINER with an explicit company filter
-- (the calling route/lib authorizes the company before invoking) so it can never leak another tenant's
-- knowledge. similarity = 1 - cosine_distance (higher is closer). Only embedded rows participate.
-- ---------------------------------------------------------------------------------------------
create or replace function public.match_coach_knowledge(
  p_company_id uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    k.title,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.coach_knowledge k
  where k.company_id = p_company_id
    and k.embedding is not null
  order by k.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_coach_knowledge(uuid, vector, int) from public;
grant execute on function public.match_coach_knowledge(uuid, vector, int) to authenticated, service_role;
