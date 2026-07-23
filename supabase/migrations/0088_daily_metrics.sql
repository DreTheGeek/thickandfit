-- daily_metrics: per-member, per-day Move (steps) and Recover (sleep) so the daily mission can carry
-- the full TRAIN / FUEL / MOVE / RECOVER set the marketing promises. There is no wearable sync yet
-- (Apple Health is deferred, Gap Log #2), so these are self-reported for now; the `source` column
-- and nullable value columns are ready for a sync source later without a schema change.
--
-- One row per (company, member, day). Owner reads/writes their own; a coach in the same company can
-- read for context. Same RLS shape as weight_entries (0028).
create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null,
  on_date date not null default (now() at time zone 'utc')::date,
  steps integer check (steps is null or (steps >= 0 and steps <= 200000)),
  sleep_minutes integer check (sleep_minutes is null or (sleep_minutes >= 0 and sleep_minutes <= 1440)),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_id, on_date)
);

create index if not exists idx_daily_metrics_profile_date
  on public.daily_metrics (profile_id, on_date);

alter table public.daily_metrics enable row level security;
drop policy if exists daily_metrics_rw on public.daily_metrics;
create policy daily_metrics_rw on public.daily_metrics for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
