-- What a plan IS, as columns, so a program can be chosen for a member instead of guessed at.
--
-- THE PROBLEM. STARTER_PROGRAM_ID is a single hardcoded uuid handed to every new member at
-- onboarding, regardless of what she answered. A man who told us he was experienced and trains at
-- home was given the Beginner/Intermediate @HOME plan: right on location by luck, wrong on level.
-- Onboarding does not even ASK how many days a week she can train, which is the first thing any
-- coach would ask and the axis her own library is organised on.
--
-- Her seven 12-week programs are named on exactly three axes, by her:
--
--     12 week | 3 day | Training Plan 1- Beginner/Intermediate | @HOME
--                ^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^
--                days   level                                    location
--
-- COLUMNS, NOT A NAME REGEX. A matcher that parses "3 day" out of the title works until she renames
-- a plan, and then it silently stops matching and every new member falls back to the default. That
-- failure looks exactly like the bug this migration exists to fix. Columns also let her set these
-- in the builder for anything she writes from now on.
--
-- Every value below was read off the plan and corroborated against its session count (a 3-day plan
-- carries 47-52 sessions over 12 weeks, a 5-day plan 77-88). Written as explicit per-id updates
-- rather than a pattern over names so each one is auditable in the diff.

alter table public.plans
  add column if not exists days_per_week smallint,
  add column if not exists level text,
  add column if not exists location text,
  -- Opt-in, and default FALSE for a reason: "Eddies workout plan" and the three "Shelise 12 week
  -- plan" entries are real, complete programs written for one named client. Nothing may hand one of
  -- those to a stranger. Neither may it hand out "Post Workout stretch regimen" (one session) or
  -- "Glute Builder" (four), which are add-ons rather than programs.
  add column if not exists is_starter_candidate boolean not null default false;

alter table public.plans drop constraint if exists plans_level_check;
alter table public.plans add constraint plans_level_check
  check (level is null or level in ('beginner_intermediate', 'advanced'));

alter table public.plans drop constraint if exists plans_location_check;
alter table public.plans add constraint plans_location_check
  check (location is null or location in ('home', 'gym'));

alter table public.plans drop constraint if exists plans_days_check;
alter table public.plans add constraint plans_days_check
  check (days_per_week is null or days_per_week between 1 and 7);

comment on column public.plans.is_starter_candidate is
  'May this plan be auto-assigned to a member who has never trained here? False for one-client plans and for add-ons. Opt-in only.';
comment on column public.plans.level is
  'beginner_intermediate | advanced, matching how Stephanie names her own programs. The matcher never assigns UP from a member''s stated experience.';

-- ---------------------------------------------------------------- the seven starter programs
-- 3 day
update public.plans set days_per_week = 3, level = 'beginner_intermediate', location = 'home',
  is_starter_candidate = true where id = 'be17f103-6717-40da-b99a-7fe98d290637';
-- No level in this one's title. Marked beginner_intermediate deliberately: it is the gym sibling of
-- the @HOME Beginner/Intermediate plan above, and guessing DOWN on level is the safe direction. An
-- experienced member handed an easier plan is mildly bored; a beginner handed ADVANCED gets hurt.
update public.plans set days_per_week = 3, level = 'beginner_intermediate', location = 'gym',
  is_starter_candidate = true where id = '2126bed8-1387-4f9a-9c68-e420d0cc42f7';

-- 4 day
update public.plans set days_per_week = 4, level = 'beginner_intermediate', location = 'gym',
  is_starter_candidate = true where id = '1d23587b-6d09-4594-9ce0-7d31eade9271';
update public.plans set days_per_week = 4, level = 'advanced', location = 'gym',
  is_starter_candidate = true where id = 'd654061f-03e1-4ce6-9eb5-046e25fc88b1';

-- 5 day
update public.plans set days_per_week = 5, level = 'beginner_intermediate', location = 'gym',
  is_starter_candidate = true where id = '3a2b46dc-bda2-496b-b15d-9e0df32f227b';
update public.plans set days_per_week = 5, level = 'advanced', location = 'gym',
  is_starter_candidate = true where id = 'e9e88483-e902-4fb6-a7cb-09b017c8c424';
-- "Training Plan 2" is the second 5-day block rather than a different level. Same tier as Plan 1.
update public.plans set days_per_week = 5, level = 'beginner_intermediate', location = 'gym',
  is_starter_candidate = true where id = '22a06341-2fa5-435b-bbde-1516d804fa53';

-- Everything else keeps is_starter_candidate = false, including both challenges. A challenge has a
-- start date and a cohort; dropping a new member into week 3 of one is not an onboarding.
