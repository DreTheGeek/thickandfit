-- PRD-12: workout logging + history. Per-set rows (not JSONB) so progressive overload (PRD-11)
-- can query clean per-set history.
create table public.workout_logs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  session_id     uuid references public.sessions(id) on delete set null,
  completion_pct int check (completion_pct between 0 and 100),
  enjoyment      int check (enjoyment between 1 and 5),
  effort         int check (effort between 1 and 5),
  performed_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table public.workout_logs enable row level security;
create index idx_workout_logs_profile on public.workout_logs(profile_id, performed_at desc);
create policy workout_logs_tenant on public.workout_logs using (company_id = public.current_company_id());

create table public.set_logs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  workout_log_id  uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id) on delete cascade,
  set_number      int not null,
  reps            int,
  weight          numeric(6, 2),
  completed       boolean not null default true,
  difficulty      text check (difficulty is null or difficulty in ('easy','moderate','hard','failed')),
  created_at      timestamptz not null default now()
);
alter table public.set_logs enable row level security;
create index idx_set_logs_log on public.set_logs(workout_log_id);
create index idx_set_logs_overload on public.set_logs(company_id, exercise_id, created_at desc);
create policy set_logs_tenant on public.set_logs using (company_id = public.current_company_id());

create table public.workout_completion_history (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  workout_log_id  uuid references public.workout_logs(id) on delete cascade,
  status          text not null,
  changed_at      timestamptz not null default now()
);
alter table public.workout_completion_history enable row level security;
create index idx_wch_profile on public.workout_completion_history(profile_id, changed_at desc);
create policy wch_tenant on public.workout_completion_history using (company_id = public.current_company_id());
