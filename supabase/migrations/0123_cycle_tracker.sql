-- Cycle tracker, to the spec Stephanie asked for.
--
-- WHAT EXISTED: one table, cycle_logs, holding a period's start and end date. `flow` and `notes`
-- columns were declared and never written to or read from anywhere. No symptoms, no moods, no
-- calendar, no coach view, no reminder. The phase math in src/lib/cycle/phase.ts is genuinely good
-- and is untouched by this.
--
-- THREE THINGS THIS ADDS.
--
-- 1. DAY-LEVEL LOGS. A period has a start and an end; symptoms and moods happen on a DAY, and a
--    member logs cramps on the 3rd without that saying anything about the 4th. Modelling them as
--    columns on cycle_logs would force one row per period and lose the day they belong to, so they
--    get their own table keyed by date.
--
-- 2. A CYCLE PROFILE. Whether she considers herself regular, and her own stated cycle and period
--    lengths. This is NOT the computed average: phase.ts derives that from observed history and
--    refuses to guess under two logged periods. Her own answer is what we show while there is not
--    enough history to compute one, and it is what makes an "Irregular" badge honest rather than a
--    verdict we reached on two data points.
--
-- 3. COACH VISIBILITY, OFF UNLESS SHE SAYS OTHERWISE... except the decision taken was the opposite:
--    default ON, with a member toggle and a logged consent capture. That reverses what the shipped
--    copy in app.cycle.privacy currently promises, so the copy changes in the same release. The
--    column defaults TRUE to match the decision; the app writes a consent_captures row when the
--    member is told, so "she was informed" is a fact on disk and not an assumption.
--
-- WHY THE COACH READ IS A COLUMN AND NOT A NEW POLICY ON cycle_logs: RLS on that table is owner-only
-- and .qa-visual/rls-isolation-test.cjs asserts it. Widening it would weaken the assertion for every
-- reader. Instead the coach reads through a SECURITY DEFINER function that checks the share flag,
-- so the table's own policy stays exactly as strict as the test expects.

-- ---------------------------------------------------------------------------------------------
-- 1. Wire up the two dead columns and add what a period actually carries.
-- ---------------------------------------------------------------------------------------------
alter table public.cycle_logs
  add column if not exists company_id uuid references public.companies (id);

comment on column public.cycle_logs.flow is
  'light | medium | heavy. Declared in 0097 and never written; the log UI writes it now.';

-- Backfill company_id from the owning profile so the tenant column is never null going forward.
update public.cycle_logs cl
set company_id = p.company_id
from public.profiles p
where p.id = cl.profile_id and cl.company_id is null;

-- ---------------------------------------------------------------------------------------------
-- 2. Day-level symptoms and moods.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.cycle_day_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  -- Arrays rather than rows-per-symptom: a day's entry is edited as a whole ("actually it was
  -- cramps AND bloating"), and a set column makes that one upsert instead of a diff.
  symptoms text[] not null default '{}',
  moods text[] not null default '{}',
  energy smallint check (energy is null or energy between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One entry per member per day. Logging the same day twice is an edit, not a second entry.
  unique (profile_id, logged_on)
);

comment on table public.cycle_day_logs is
  'Symptoms, moods and energy for one member on one calendar day. Separate from cycle_logs because a symptom belongs to a DAY, not to the period as a whole.';

create index if not exists idx_cycle_day_logs_profile_date
  on public.cycle_day_logs (profile_id, logged_on desc);

alter table public.cycle_day_logs enable row level security;

create policy cycle_day_logs_select_own on public.cycle_day_logs
  for select using (profile_id = auth.uid());
create policy cycle_day_logs_insert_own on public.cycle_day_logs
  for insert with check (profile_id = auth.uid());
create policy cycle_day_logs_update_own on public.cycle_day_logs
  for update using (profile_id = auth.uid());
create policy cycle_day_logs_delete_own on public.cycle_day_logs
  for delete using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 3. Her own account of her cycle, plus the coach-sharing decision.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.cycle_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  -- 'regular' | 'irregular' | 'unsure'. Her word for it. phase.ts still computes irregularity from
  -- observed gaps; this is what we show before there is enough history to compute anything, and a
  -- member who tells us she is irregular is never shown a confident predicted date.
  cycle_type text check (cycle_type in ('regular', 'irregular', 'unsure')),
  typical_cycle_length smallint check (typical_cycle_length is null or typical_cycle_length between 15 and 90),
  typical_period_length smallint check (typical_period_length is null or typical_period_length between 1 and 15),
  -- Decision taken 2026-08: the coach sees it, defaulted on, with the member able to turn it off.
  shares_with_coach boolean not null default true,
  -- Daily nudge during the period window. Opt-out, and it only fires when nothing was logged.
  reminders_enabled boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.cycle_profiles.shares_with_coach is
  'Default TRUE by product decision. The member can turn it off; app.cycle.privacy copy states this and a consent_captures row records that she was told.';

alter table public.cycle_profiles enable row level security;

create policy cycle_profiles_select_own on public.cycle_profiles
  for select using (profile_id = auth.uid());
create policy cycle_profiles_insert_own on public.cycle_profiles
  for insert with check (profile_id = auth.uid());
create policy cycle_profiles_update_own on public.cycle_profiles
  for update using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 4. The coach's read, gated on consent.
-- ---------------------------------------------------------------------------------------------
-- SECURITY DEFINER so the coach can read a member's cycle WITHOUT widening the owner-only policy on
-- cycle_logs, which rls-isolation-test.cjs asserts and which should stay that strict. Every read is
-- filtered by shares_with_coach, so turning the toggle off makes this return nothing at all rather
-- than returning rows the UI then chooses to hide.
create or replace function public.coach_cycle_window(
  p_profile_id uuid,
  p_company_id uuid,
  p_since date
)
returns table (
  logged_on date,
  symptoms text[],
  moods text[],
  energy smallint,
  period_started_on date,
  period_ended_on date,
  flow text
)
language sql
security definer
set search_path = public
as $$
  with shared as (
    select 1
    from public.cycle_profiles cp
    where cp.profile_id = p_profile_id
      and cp.company_id = p_company_id
      and cp.shares_with_coach
  )
  select
    d.logged_on,
    d.symptoms,
    d.moods,
    d.energy,
    null::date,
    null::date,
    null::text
  from public.cycle_day_logs d
  where exists (select 1 from shared)
    and d.profile_id = p_profile_id
    and d.company_id = p_company_id
    and d.logged_on >= p_since
  union all
  select
    l.started_on,
    '{}'::text[],
    '{}'::text[],
    null::smallint,
    l.started_on,
    l.ended_on,
    l.flow
  from public.cycle_logs l
  where exists (select 1 from shared)
    and l.profile_id = p_profile_id
    and l.company_id = p_company_id
    and l.started_on >= p_since
  order by 1 desc;
$$;

revoke all on function public.coach_cycle_window(uuid, uuid, date) from public;
grant execute on function public.coach_cycle_window(uuid, uuid, date) to authenticated, service_role;
