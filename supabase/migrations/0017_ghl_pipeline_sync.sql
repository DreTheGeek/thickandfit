-- 0017 GHL pipeline sync targets. One-way mirror of GoHighLevel opportunities into our CRM:
-- pipelines + pipeline_stages + opportunities (+ opportunity_audit for stage/status history).
-- Opportunities link to public.contacts (nullable; GHL-native leads with no match keep contact_id
-- null). Money is BIGINT _cents. company_id NOT NULL + role-gated RLS (coach roles) like 0016.

create table public.pipelines (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  ghl_pipeline_id text not null,
  name            text not null,
  source          text not null default 'ghl',
  is_active       boolean not null default true,
  raw             jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, ghl_pipeline_id)
);
alter table public.pipelines enable row level security;
create index idx_pipelines_company on public.pipelines(company_id);
create policy pipelines_tenant on public.pipelines
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'))
  with check (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'));
create trigger set_pipelines_updated_at before update on public.pipelines
  for each row execute function public.set_updated_at();

create table public.pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  pipeline_id  uuid not null references public.pipelines(id) on delete cascade,
  ghl_stage_id text not null,
  name         text not null,
  position     int not null default 0,
  source       text not null default 'ghl',
  created_at   timestamptz not null default now(),
  unique (company_id, ghl_stage_id)
);
alter table public.pipeline_stages enable row level security;
create index idx_pipestage_pipeline on public.pipeline_stages(pipeline_id, position);
create policy pipeline_stages_tenant on public.pipeline_stages
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'))
  with check (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'));

create table public.opportunities (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  contact_id            uuid references public.contacts(id) on delete set null,
  ghl_opportunity_id    text not null,
  ghl_contact_id        text,
  name                  text,
  pipeline_id           uuid references public.pipelines(id) on delete set null,
  stage_id              uuid references public.pipeline_stages(id) on delete set null,
  status                text not null default 'open' check (status in ('open', 'won', 'lost', 'abandoned')),
  monetary_value_cents  bigint,
  forecast_probability  numeric,
  source                text,
  ghl_source            text,
  lost_reason_id        text,
  lost_reason           text,
  assigned_to           text,
  ghl_created_at        timestamptz,
  ghl_updated_at        timestamptz,
  last_stage_change_at  timestamptz,
  last_status_change_at timestamptz,
  raw                   jsonb,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, ghl_opportunity_id)
);
alter table public.opportunities enable row level security;
create index idx_opp_company_status on public.opportunities(company_id, status);
create index idx_opp_pipeline on public.opportunities(pipeline_id);
create index idx_opp_stage on public.opportunities(stage_id);
create index idx_opp_contact on public.opportunities(contact_id);
create index idx_opp_ghl_contact on public.opportunities(ghl_contact_id);
create policy opportunities_tenant on public.opportunities
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'))
  with check (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'));
create trigger set_opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();

create table public.opportunity_audit (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  field_name     text not null,
  old_value      text,
  new_value      text,
  source         text not null default 'app' check (source in ('ghl_sync', 'app')),
  changed_by     uuid references public.profiles(id) on delete set null,
  changed_at     timestamptz not null default now()
);
alter table public.opportunity_audit enable row level security;
create index idx_opp_audit_opp on public.opportunity_audit(opportunity_id, changed_at desc);
create policy opportunity_audit_tenant on public.opportunity_audit
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'))
  with check (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator'));

alter table public.contacts add column if not exists ghl_contact_id text;
create index if not exists idx_contacts_ghl on public.contacts(ghl_contact_id);
