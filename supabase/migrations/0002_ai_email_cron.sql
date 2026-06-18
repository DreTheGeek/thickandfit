-- PRD-01 Foundation (cont.): AI evals + usage, email deliverability, cron log.
-- Schema checklist F (AI and Usage) and H (Cron/Queue). Money is BIGINT cents.

-- ---------------------------------------------------------------------------
-- F: AI and Usage
-- ---------------------------------------------------------------------------
create table public.ai_evals (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  feature     text not null,
  name        text not null,
  created_at  timestamptz not null default now()
);
alter table public.ai_evals enable row level security;
create index idx_ai_evals_company on public.ai_evals(company_id);
create policy ai_evals_tenant on public.ai_evals using (company_id = public.current_company_id());

create table public.ai_eval_cases (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  ai_eval_id  uuid not null references public.ai_evals(id) on delete cascade,
  input       jsonb not null,
  expected    jsonb not null,
  created_at  timestamptz not null default now()
);
alter table public.ai_eval_cases enable row level security;
create index idx_ai_eval_cases_eval on public.ai_eval_cases(ai_eval_id);
create policy ai_eval_cases_tenant on public.ai_eval_cases using (company_id = public.current_company_id());

create table public.ai_eval_runs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  ai_eval_id    uuid not null references public.ai_evals(id) on delete cascade,
  ai_eval_case_id uuid references public.ai_eval_cases(id) on delete set null,
  passed        boolean not null,
  actual        jsonb,
  score         int,
  latency_ms    int,
  created_at    timestamptz not null default now()
);
alter table public.ai_eval_runs enable row level security;
create index idx_ai_eval_runs_eval on public.ai_eval_runs(ai_eval_id, created_at desc);
create policy ai_eval_runs_tenant on public.ai_eval_runs using (company_id = public.current_company_id());

create table public.ai_usage_log (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  user_id            uuid,
  feature            text not null,
  model              text not null,
  prompt_tokens      int not null default 0,
  completion_tokens  int not null default 0,
  cost_cents         bigint not null default 0,
  created_at         timestamptz not null default now()
);
alter table public.ai_usage_log enable row level security;
create index idx_ai_usage_company on public.ai_usage_log(company_id, created_at desc);
create policy ai_usage_view_own on public.ai_usage_log for select using (company_id = public.current_company_id());
create policy ai_usage_system_insert on public.ai_usage_log for insert with check (true);

-- ---------------------------------------------------------------------------
-- H: Cron / Queue / Email
-- ---------------------------------------------------------------------------
create table public.cron_job_log ( -- KALDR:GLOBAL
  id          uuid primary key default gen_random_uuid(),
  job_name    text not null,
  status      text not null check (status in ('success','error','skipped')),
  detail      jsonb,
  ran_at      timestamptz not null default now()
);
alter table public.cron_job_log enable row level security;
create index idx_cron_job_log_name on public.cron_job_log(job_name, ran_at desc);
create policy cron_job_log_system on public.cron_job_log for all using (true) with check (true);

create table public.email_send_log (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  to_email             text not null,
  template             text not null,
  status               text not null default 'sent'
                       check (status in ('sent','delivered','bounced','complained','failed')),
  provider_message_id  text,
  created_at           timestamptz not null default now()
);
alter table public.email_send_log enable row level security;
create index idx_email_send_company on public.email_send_log(company_id, created_at desc);
create policy email_send_tenant on public.email_send_log using (company_id = public.current_company_id());
create policy email_send_system_insert on public.email_send_log for insert with check (true);

create table public.email_suppression_list ( -- KALDR:GLOBAL
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  reason      text not null check (reason in ('bounced','complained','unsubscribed','manual')),
  created_at  timestamptz not null default now()
);
alter table public.email_suppression_list enable row level security;
create policy email_suppression_system on public.email_suppression_list for all using (true) with check (true);
