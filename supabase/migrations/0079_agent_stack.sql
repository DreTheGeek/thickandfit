-- 0079 -- 2026 agent-stack foundations: (1) agent OBSERVABILITY (ai_trace: one row per model call),
-- (2) a KNOWLEDGE GRAPH (kg_node + kg_edge over the coaching entities), (3) EVALS (eval_run history).
-- All operator-read; the app writes via the service client. Complements ai_inferences (provenance/gold)
-- and ai_usage_log (billing) - this is the trace/graph/eval layer on top.

-- ---- (1) Agent observability: a full trace per AI call ---------------------------------------
create table if not exists public.ai_trace (
  id             bigint generated always as identity primary key,
  company_id     uuid,
  profile_id     uuid,
  feature        text not null,          -- scan | text-macro | chat | plan-gen | insights | physique | embed | overload
  operation      text not null,          -- json | stream | embed
  model          text,
  status         text not null,          -- ok | error | notConfigured
  latency_ms     int,
  prompt_tokens  int,
  completion_tokens int,
  cost_cents     numeric,
  retrieval_count int,                    -- RAG docs pulled into context
  input_preview  text,                    -- first chars of the user input (truncated, safe)
  output_preview text,                    -- first chars of the model output
  error          text,
  correlation_id text,                    -- links calls within one agent turn
  ts             timestamptz not null default now()
);
create index if not exists idx_ai_trace_ts on public.ai_trace (ts desc);
create index if not exists idx_ai_trace_feature on public.ai_trace (feature, ts desc);
create index if not exists idx_ai_trace_status on public.ai_trace (status, ts desc);
alter table public.ai_trace enable row level security;
drop policy if exists ai_trace_operator on public.ai_trace;
create policy ai_trace_operator on public.ai_trace for select using (public.profile_role() = 'operator');

-- ---- (2) Knowledge graph: entities + typed relationships -------------------------------------
create table if not exists public.kg_node (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  type        text not null,             -- client | food | injury | condition | goal | plan | topic | coach
  key         text not null,             -- stable natural key within (company, type) for dedupe
  label       text not null,
  ref_id      uuid,                      -- optional link to the source row (contact_id, food_id, ...)
  props       jsonb not null default '{}'::jsonb,
  weight      int not null default 1,    -- how many times seen (importance)
  updated_at  timestamptz not null default now(),
  unique (company_id, type, key)
);
create index if not exists idx_kg_node_company_type on public.kg_node (company_id, type);

create table if not exists public.kg_edge (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  src_id      uuid not null references public.kg_node(id) on delete cascade,
  dst_id      uuid not null references public.kg_node(id) on delete cascade,
  rel         text not null,             -- HAS_INJURY | EATS | HAS_GOAL | HAS_CONDITION | EXCLUDES | ASSIGNED_PLAN | ABOUT_TOPIC
  weight      int not null default 1,
  props       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (company_id, src_id, dst_id, rel)
);
create index if not exists idx_kg_edge_src on public.kg_edge (src_id);
create index if not exists idx_kg_edge_dst on public.kg_edge (dst_id);
alter table public.kg_node enable row level security;
alter table public.kg_edge enable row level security;
drop policy if exists kg_node_coach on public.kg_node;
create policy kg_node_coach on public.kg_node for select using (company_id = public.current_company_id() and public.is_coach());
drop policy if exists kg_edge_coach on public.kg_edge;
create policy kg_edge_coach on public.kg_edge for select using (company_id = public.current_company_id() and public.is_coach());

-- Graph retrieval for RAG: pull the 1-hop neighborhood of a client's node as grounded facts.
create or replace function public.kg_client_facts(p_contact uuid)
returns table(rel text, node_type text, label text)
language sql stable security definer set search_path = public as $$
  select e.rel, n2.type, n2.label
  from kg_node n1
  join kg_edge e on e.src_id = n1.id
  join kg_node n2 on n2.id = e.dst_id
  where n1.type = 'client' and n1.ref_id = p_contact
  order by e.weight desc, n2.label limit 60;
$$;

-- ---- (3) Evals: a run per eval suite per commit ---------------------------------------------
create table if not exists public.eval_run (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid,
  suite       text not null,             -- smart-scan | chat-grounded | plan-safety | insights
  commit_sha  text,
  cases       int not null default 0,
  passed      int not null default 0,
  score       numeric,                   -- 0..1 pass rate or F1
  metrics     jsonb not null default '{}'::jsonb,
  status      text not null default 'done',
  created_at  timestamptz not null default now()
);
create index if not exists idx_eval_run_suite on public.eval_run (suite, created_at desc);
alter table public.eval_run enable row level security;
drop policy if exists eval_run_operator on public.eval_run;
create policy eval_run_operator on public.eval_run for select using (public.profile_role() = 'operator');
