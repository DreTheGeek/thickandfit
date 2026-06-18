-- PRD-04b: multi-form builder engine. 4 tables, all company-scoped + RLS.
-- Field config stored as JSONB for block-type flexibility; form structure is versioned.

create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title_en    text not null,
  title_es    text,
  type        text not null default 'custom' check (type in ('onboarding','check_in','custom')),
  status      text not null default 'draft' check (status in ('draft','published','archived')),
  version     int not null default 1,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.forms enable row level security;
create index idx_forms_company on public.forms(company_id, status);
create policy forms_tenant on public.forms using (company_id = public.current_company_id());

create table public.form_fields (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  form_id     uuid not null references public.forms(id) on delete cascade,
  type        text not null check (type in ('text','multiline','select','rating','sleep_duration','photo','measurement')),
  label_en    text not null,
  label_es    text,
  config      jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  required    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.form_fields enable row level security;
create index idx_form_fields_form on public.form_fields(form_id, sort_order);
create policy form_fields_tenant on public.form_fields using (company_id = public.current_company_id());

create table public.form_assignments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  form_id      uuid not null references public.forms(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  unique(form_id, profile_id)
);
alter table public.form_assignments enable row level security;
create index idx_form_assignments_profile on public.form_assignments(profile_id);
create policy form_assignments_tenant on public.form_assignments using (company_id = public.current_company_id());

create table public.form_responses (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  form_id       uuid not null references public.forms(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  form_version  int not null default 1,
  submitted_at  timestamptz not null default now()
);
alter table public.form_responses enable row level security;
create index idx_form_responses_form on public.form_responses(form_id, submitted_at desc);
create policy form_responses_tenant on public.form_responses using (company_id = public.current_company_id());

create trigger set_forms_updated_at before update on public.forms
  for each row execute function public.set_updated_at();
