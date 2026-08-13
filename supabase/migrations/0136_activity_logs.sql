-- Device-tracked activity: the walks, runs and classes that happen outside her programme.
--
-- 2,659 of these came off Lenus, from March 2024 to today: 1,424 fitnessWorkout, 518 walking, 266
-- strengthTraining, 99 HIIT, 72 running, 68 stretching, 48 stairs, 34 pilates, 34 dancing, 28
-- mixedCardio, 12 rowing. They are phone and watch syncs, and they show up in the client's chat
-- thread on Lenus rather than in her training history.
--
-- WHY A THIRD TABLE. There are already two and this is neither:
--   workout_logs             a session finished IN THIS APP, against a plan she wrote.
--   client_workout_history   a Lenus programme session, with completion percent and effort scores.
--   activity_logs            something her watch recorded. No plan, no session, no coach.
-- Forcing a 47-minute walk into either would put a row with no plan and no completion percent in a
-- table every reader treats as "programme work done", and the training-history count she reads
-- would stop meaning what it means.
--
-- WHAT WE COULD NOT GET. Lenus collapses runs of these into a TrackingActivityLogBundle carrying
-- only {id, createdAt, count}: no type, no duration, no calories. 3,865 bundles covering an unknown
-- number of activities are therefore NOT importable, and no amount of re-querying changes that.
-- The honest number is 2,659, not the 6,524 events the chat query returns.
--
-- Integers, not numerics: metres, seconds and kilocalories are whole units at this resolution, and
-- a column named like distance or duration in numeric form trips the money-type guard for good
-- reasons of its own.

create table if not exists public.activity_logs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  -- Both keys, always. profile_id exists only once a member claims an app account; every migrated
  -- row here carries contact_id and nothing else.
  contact_id        uuid references public.contacts (id) on delete cascade,
  profile_id        uuid references public.profiles (id) on delete cascade,
  external_id       text,
  activity_type     text not null,
  -- She can name a custom activity, in which case the type is a generic bucket and this is the
  -- thing she actually did.
  custom_name       text,
  -- When it HAPPENED, not when the phone synced it. Those differ by hours; the sync time would put
  -- an early-morning walk on the wrong day for anyone west of UTC.
  tracked_at        timestamptz not null,
  distance_meters   integer,
  duration_seconds  integer,
  energy_kcal       integer,
  rating            smallint,
  comment           text,
  source            text not null default 'lenus',
  created_at        timestamptz not null default now(),
  constraint activity_logs_has_owner check (profile_id is not null or contact_id is not null),
  constraint activity_logs_rating_range check (rating is null or rating between 1 and 5)
);

alter table public.activity_logs enable row level security;

create index if not exists idx_activity_logs_contact on public.activity_logs (company_id, contact_id, tracked_at desc);
create index if not exists idx_activity_logs_profile on public.activity_logs (profile_id, tracked_at desc) where profile_id is not null;
create unique index if not exists idx_activity_logs_external
  on public.activity_logs (company_id, external_id) where external_id is not null;

-- Member reads her own, coach reads the company's. Same gate as workout_logs (0018), because this
-- is the same kind of data: her own training, visible to her coach.
drop policy if exists activity_logs_own on public.activity_logs;
create policy activity_logs_own on public.activity_logs
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

comment on table public.activity_logs is
  'Activity recorded by a phone or watch, outside her written programme. Distinct from workout_logs (a session finished in this app) and client_workout_history (a Lenus programme session).';
comment on column public.activity_logs.tracked_at is
  'When the activity happened, not when the device synced it. The two differ by hours.';
