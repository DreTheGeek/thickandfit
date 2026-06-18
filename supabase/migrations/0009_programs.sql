-- PRD-10: coach-side program builder. plans -> sessions -> session_exercises, plus assignments.
create type session_exercise_format as enum ('straight', 'circuit', 'superset');

create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name_en     text not null,
  name_es     text,
  weeks       int not null default 4,
  is_template boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.plans enable row level security;
create index idx_plans_company on public.plans(company_id, is_template);
create policy plans_tenant on public.plans using (company_id = public.current_company_id());

create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  plan_id     uuid not null references public.plans(id) on delete cascade,
  day_label   text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.sessions enable row level security;
create index idx_sessions_plan on public.sessions(plan_id, sort_order);
create policy sessions_tenant on public.sessions using (company_id = public.current_company_id());

create table public.session_exercises (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  session_id   uuid not null references public.sessions(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  format       session_exercise_format not null default 'straight',
  sets         int,
  reps         int,
  time_sec     int,
  weight       numeric(6, 2),
  rest_sec     int,
  rounds       int,
  notes        text,
  config       jsonb not null default '{}'::jsonb,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.session_exercises enable row level security;
create index idx_session_exercises_session on public.session_exercises(session_id, sort_order);
create policy session_exercises_tenant on public.session_exercises using (company_id = public.current_company_id());

create table public.plan_assignments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  plan_id      uuid not null references public.plans(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  unique(plan_id, profile_id)
);
alter table public.plan_assignments enable row level security;
create index idx_plan_assignments_profile on public.plan_assignments(profile_id);
create policy plan_assignments_tenant on public.plan_assignments using (company_id = public.current_company_id());

create trigger set_plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();
