-- Her per-client targets: steps, water, walking, running, active time, calories burned.
--
-- FOUND BY AUDITING THE SOURCE, not the plan. Walking every operation the Lenus capture recorded
-- against a destination in this database turned up exactly one with nowhere to go:
-- TrackingGoalCoachQuery, 551 goals across 227 of her 257 clients. Nothing else was unaccounted for.
--
-- WHY IT MATTERS MORE THAN THE ROW COUNT SUGGESTS. Her weekly check-in asks "Did you hit your step
-- goal?" and "Did you hit your water goal?" and stores yes or no. Without the goal, the answer is
-- unreadable: yes against what? 10,000 steps and 6,000 steps are different weeks and the same
-- "yes". These 551 rows are what those two questions have been measured against all along, and we
-- imported the answers without them.
--
-- createdByClient is kept because it changes who owns the number. A goal the client set for herself
-- is a different coaching conversation from one Stephanie prescribed, and Lenus distinguishes them.
--
-- Target is stored as the source gives it, with its own display unit (steps as a count, water in
-- ml shown as l, active time in minutes). Normalising to one unit here would mean guessing a
-- conversion per type and losing what she actually typed.

create table if not exists public.tracking_goals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- Both keys. Every migrated goal belongs to someone with no app account yet.
  contact_id    uuid references public.contacts (id) on delete cascade,
  profile_id    uuid references public.profiles (id) on delete cascade,
  external_id   text,
  goal_type     text not null,
  target        numeric not null,
  display_unit  text,
  frequency     text,
  starts_on     date,
  created_by_client boolean not null default false,
  source        text not null default 'lenus',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tracking_goals_has_owner check (profile_id is not null or contact_id is not null),
  constraint tracking_goals_frequency_valid check (frequency is null or frequency in ('daily', 'weekly'))
);

alter table public.tracking_goals enable row level security;

create index if not exists idx_tracking_goals_contact on public.tracking_goals (company_id, contact_id);
create index if not exists idx_tracking_goals_profile on public.tracking_goals (profile_id) where profile_id is not null;
create unique index if not exists idx_tracking_goals_external
  on public.tracking_goals (company_id, external_id) where external_id is not null;

-- Owner-scoped, same gate as workout_logs and activity_logs: her own target, visible to her coach.
drop policy if exists tracking_goals_own on public.tracking_goals;
create policy tracking_goals_own on public.tracking_goals
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop trigger if exists set_tracking_goals_updated_at on public.tracking_goals;
create trigger set_tracking_goals_updated_at before update on public.tracking_goals
  for each row execute function public.set_updated_at();

comment on table public.tracking_goals is
  'Per-client targets migrated from Lenus: steps, water, walking, running, active time, calories burned. The thing her check-in questions "did you hit your step goal?" are measured against.';
comment on column public.tracking_goals.target is
  'In the source unit, paired with display_unit. Water arrives in ml and is shown in l; normalising here would mean guessing a conversion per type.';
comment on column public.tracking_goals.created_by_client is
  'True when the client set it herself. A self-set goal is a different conversation from one the coach prescribed, and Lenus tracks the difference.';
