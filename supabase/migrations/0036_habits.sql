-- 0036 PHASE 2 — Habits (coach-assigned daily habits + per-day completion).
-- A coach assigns a client habits (water, steps, sleep...); the client checks them off each day. The
-- dashboard "things to do" reads today's habits + completion. RLS: the owning client + company coaches.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  icon text not null default 'check',
  cadence text not null default 'daily' check (cadence in ('daily')),
  target_count int not null default 1,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_habits_profile on public.habits (profile_id) where is_active;
create index if not exists idx_habits_company on public.habits (company_id);

alter table public.habits enable row level security;
drop policy if exists habits_rw on public.habits;
create policy habits_rw on public.habits for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  habit_id uuid not null references public.habits(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  logged_date date not null,
  done boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_date)
);
create index if not exists idx_habit_logs_profile_date on public.habit_logs (profile_id, logged_date);

alter table public.habit_logs enable row level security;
drop policy if exists habit_logs_rw on public.habit_logs;
create policy habit_logs_rw on public.habit_logs for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
