-- 0054 PHASE 2 -- Body measurements. The subscriber's tape-measure log (waist, hips, chest, arms,
-- thighs) + body-fat %. Circumferences stored in cm (canonical); the UI toggles cm/in. Nullable per
-- site so a member can log only what they measure. Owner-scoped; coaches in the company can read.
-- Mirrors weight_entries (0028) so the two body-progress logs behave identically.

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recorded_on date not null default (now() at time zone 'utc')::date,
  waist_cm numeric,
  hips_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  thighs_cm numeric,
  body_fat_pct numeric,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists idx_body_measurements_profile_recorded
  on public.body_measurements (profile_id, recorded_on);

alter table public.body_measurements enable row level security;

drop policy if exists body_measurements_rw on public.body_measurements;
create policy body_measurements_rw on public.body_measurements for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
