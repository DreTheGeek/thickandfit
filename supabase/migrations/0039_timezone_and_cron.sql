-- 0039 PHASE 2 (WP11) — Per-user timezone + scheduler foundation.
--
-- WHY: every "today" in the app is UTC today (todayIso() x3 + the UTC column defaults on
-- food_log.log_date / weight_entries.recorded_on). For a US + LATAM audience that means a
-- 9pm-local meal logs to TOMORROW, silently breaking the diary day and streaks. The fix is a
-- per-user IANA timezone the app threads into a single localDay() helper, plus a DB safety-net
-- trigger that backfills the local day from profiles.timezone whenever the app omits the date.
--
-- SCOPE OF THIS MIGRATION (applied now, fully verifiable locally):
--   1. profiles.timezone (IANA text, NOT NULL default America/New_York), validated against
--      pg_timezone_names so an offset like '-5' or a typo can never be stored.
--   2. profiles.reminder_hour (smallint 0..23, NOT NULL default 19) for the local-time reminder cron.
--   3. tz-aware safety-net triggers on food_log.log_date and weight_entries.recorded_on: when the
--      app omits the date, fill it with the owner's LOCAL calendar day (not UTC).
--   4. enable pg_cron + pg_net (idempotent, guarded) so the deploy-time job registration can run.
--
-- DEFERRED (NOT in this file): the actual cron.schedule / net.http_post job registration lives in
-- supabase/deploy/cron-register.sql and is a DEPLOY-TIME step. Registering jobs now would point
-- net.http_post at a non-prod URL and just create failing jobs. See that file.
--
-- Voice / em-dash discipline: zero em dash.

-- ---------------------------------------------------------------------------
-- 1 + 2. Per-user timezone + reminder hour
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists timezone text not null default 'America/New_York';

alter table public.profiles
  add column if not exists reminder_hour smallint not null default 19;

comment on column public.profiles.timezone is
  'IANA timezone name (e.g. America/New_York, America/Mexico_City). Mandatory IANA, never a UTC '
  'offset: Mexico dropped DST in 2022 so offsets break across DST. Drives the local diary day, '
  'streak boundaries, and the local-time reminder cron. Validated against pg_timezone_names.';

comment on column public.profiles.reminder_hour is
  'Hour of day (0..23) in the user local timezone to deliver the daily reminder. Default 19 (7pm).';

-- reminder_hour range is a simple CHECK (no subquery needed).
alter table public.profiles
  drop constraint if exists profiles_reminder_hour_chk;
alter table public.profiles
  add constraint profiles_reminder_hour_chk
  check (reminder_hour between 0 and 23);

-- IANA validation: Postgres forbids a subquery inside a CHECK constraint, so a CHECK against
-- pg_timezone_names is not allowed. A trigger function body CAN run the subquery. Note that
-- `now() at time zone '-5'` does NOT raise (Postgres accepts POSIX-style offsets), so the only
-- reliable IANA test is membership in pg_timezone_names. This rejects offsets like '-5' and typos.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.timezone is null then
    raise exception 'profiles.timezone may not be null';
  end if;
  if not exists (select 1 from pg_timezone_names z where z.name = new.timezone) then
    raise exception 'profiles.timezone % is not a valid IANA timezone name', new.timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_validate_timezone on public.profiles;
create trigger trg_profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- ---------------------------------------------------------------------------
-- 3. Safety-net: backfill log_date / recorded_on from the owner LOCAL day
--
-- The authoritative fix is the app writing the local day explicitly (see local-day.ts + the
-- diary/habits/weight actions). This trigger is defense in depth: if any insert path omits the
-- date and would otherwise fall to the UTC column default, fill it from the owner timezone instead.
-- A trigger CAN read another table (profiles), which a column default cannot.
-- ---------------------------------------------------------------------------
create or replace function public.set_local_log_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  -- Only act when the app did not set the date itself (NEW value still equals the UTC default,
  -- i.e. the current UTC date). If the app wrote an explicit local day, leave it untouched.
  if tg_table_name = 'food_log' then
    if new.log_date is null or new.log_date = (now() at time zone 'utc')::date then
      select timezone into v_tz from public.profiles where id = new.profile_id;
      if v_tz is not null then
        new.log_date := (now() at time zone v_tz)::date;
      end if;
    end if;
  elsif tg_table_name = 'weight_entries' then
    if new.recorded_on is null or new.recorded_on = (now() at time zone 'utc')::date then
      select timezone into v_tz from public.profiles where id = new.profile_id;
      if v_tz is not null then
        new.recorded_on := (now() at time zone v_tz)::date;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_food_log_local_date on public.food_log;
create trigger trg_food_log_local_date
  before insert on public.food_log
  for each row execute function public.set_local_log_date();

drop trigger if exists trg_weight_entries_local_date on public.weight_entries;
create trigger trg_weight_entries_local_date
  before insert on public.weight_entries
  for each row execute function public.set_local_log_date();

-- ---------------------------------------------------------------------------
-- 4. Scheduler extensions (available on this project, not yet installed).
-- Idempotent. Guarded so a local/dev DB without these extensions does not hard-fail the migration.
-- The actual cron.schedule calls are a deploy-time step (supabase/deploy/cron-register.sql).
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  raise notice 'pg_cron + pg_net ensured. Register jobs via supabase/deploy/cron-register.sql.';
exception
  when insufficient_privilege or undefined_file or feature_not_supported then
    raise notice 'Could not install pg_cron/pg_net here (likely local dev). Skipping; install on prod.';
end $$;
