-- ---------------------------------------------------------------------------------------------
-- 0146: per-coach progress through the console.
--
-- WHY PER COACH AND NOT PER COMPANY. The obvious build is a company-level "finish setting up your
-- business" checklist, and for this tenant every box would already be ticked: 279 clients, 41
-- programs, 451 knowledge entries, 248 meal plans, all migrated from Lenus before anybody logged in.
-- A new coach would open a completed checklist and learn nothing, which is the exact opposite of
-- what it is for. Progress belongs to the PERSON learning the software.
--
-- WHAT COUNTS AS DONE. Two kinds of step, and the distinction is deliberate:
--   visit  - she opened the screen. Enough for "here is where the exercise library lives".
--   action - she did the thing. Assigning a program is not learned by looking at the page.
-- Both land in this table; the catalog in src/lib/coach/tour.ts decides which is which, so the rule
-- lives in code next to the copy rather than in a column nobody reads.
--
-- ONE ROW PER (profile, step). Re-visiting a screen must not create rows forever, and the first
-- completion is the one worth keeping, so the primary key does the deduping and the insert is an
-- upsert that ignores conflicts.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.coach_checklist (
  company_id   uuid not null references public.companies(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  -- Matches a key in the tour catalog. Text rather than an enum: adding a step to the tour should
  -- be a code change, not a migration, and an orphaned key is harmless (the catalog ignores it).
  step_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (profile_id, step_key)
);

alter table public.coach_checklist enable row level security;

create index if not exists idx_coach_checklist_company
  on public.coach_checklist (company_id, profile_id);

-- Her own progress, nobody else's. A coach has no business reading how far another coach has got,
-- and the tenant predicate follows the shape 0142 established.
create policy coach_checklist_own on public.coach_checklist for all to authenticated
  using      (profile_id = auth.uid() and company_id = public.auth_company_id())
  with check (profile_id = auth.uid() and company_id = public.auth_company_id());

comment on table public.coach_checklist is
  'Per-coach progress through the console tour. One row per (profile, step); first completion wins. '
  'Company-level would be useless here: this tenant arrived with every box already true.';
