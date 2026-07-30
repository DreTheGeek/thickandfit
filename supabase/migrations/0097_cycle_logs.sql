-- 0097: menstrual-cycle tracking.
--
-- Stephanie asked for this directly. It matters more here than in a generic fitness app because the
-- intake already captures PCOS, endometriosis, thyroid and perimenopause, and those are exactly the
-- populations whose cycles are irregular and whose training and appetite swing hardest with them.
--
-- Design:
--   * One row per PERIOD, not per day. `started_on` is the first day of bleeding; `ended_on` is
--     optional because plenty of people log the start and never come back to close it, and a feature
--     that only works for meticulous loggers is a feature most members abandon.
--   * `date`, not `timestamptz`. A period start is a calendar day in the member's own life, not an
--     instant; storing it as a timestamp reintroduces the timezone bug class the project already hit.
--   * Everything derived (cycle length, average, next predicted start, current phase) is computed at
--     read time in src/lib/cycle/phase.ts from the log history. Nothing derived is stored, so a
--     corrected start date immediately fixes every downstream number instead of leaving stale rows.
--
-- PRIVACY: this is health data under App Store guideline 5.1.3, which bans using health data for
-- marketing, advertising, or data mining. It must NEVER reach GoHighLevel or any analytics payload.
-- RLS below is member-only: not even a coach can read it. That is deliberate. Cycle data is the most
-- intimate thing the app holds, and Stephanie's coaching value comes from the member CHOOSING to
-- share context, not from staff browsing it. If coach visibility is ever wanted it needs an explicit,
-- revocable, member-granted consent, not a policy widening.

create table if not exists public.cycle_logs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  started_on   date not null,
  ended_on     date,
  -- Optional, self-reported. Nullable because most members will not log it every time.
  flow         text check (flow in ('light', 'medium', 'heavy')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A period cannot end before it starts.
  constraint cycle_logs_range check (ended_on is null or ended_on >= started_on)
);

-- One period per start date per member: re-tapping "log today" must not create a duplicate.
create unique index if not exists idx_cycle_logs_unique_start
  on public.cycle_logs (company_id, profile_id, started_on);

-- The read: this member's history, newest first (phase math walks recent starts).
create index if not exists idx_cycle_logs_history
  on public.cycle_logs (profile_id, started_on desc);

alter table public.cycle_logs enable row level security;

-- MEMBER-ONLY. No coach/operator clause on purpose (see the privacy note above).
drop policy if exists cycle_logs_select_own on public.cycle_logs;
create policy cycle_logs_select_own on public.cycle_logs
  for select using (profile_id = auth.uid());

drop policy if exists cycle_logs_insert_own on public.cycle_logs;
create policy cycle_logs_insert_own on public.cycle_logs
  for insert with check (profile_id = auth.uid());

drop policy if exists cycle_logs_update_own on public.cycle_logs;
create policy cycle_logs_update_own on public.cycle_logs
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists cycle_logs_delete_own on public.cycle_logs;
create policy cycle_logs_delete_own on public.cycle_logs
  for delete using (profile_id = auth.uid());
