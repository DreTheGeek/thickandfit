-- Favourite exercises, per coach.
--
-- Stephanie's old platform put a star on every row of the exercise list, and she used it as her
-- working set: the twenty or so movements she reaches for when writing a program, pulled out of a
-- library of hundreds. The list screen is rebuilt here with her three filters, and a Favourite
-- filter that filters nothing would be a lie on the highest-traffic screen in the portal, so the
-- store exists before the toggle does.
--
-- PER PROFILE, NOT PER COMPANY. A favourite is a personal shortcut, not a company setting: when
-- Daniela stars an exercise it must not rearrange Stephanie's list. This is the opposite call from
-- coach_settings (0115), which is company-keyed precisely because those decide what MEMBERS see.
-- Same shape as recipe_favorites (0024), deliberately, so there is one favourite pattern to learn.
--
-- company_id is carried even though profile_id already implies it, because RLS checks both: it is
-- what stops a row written under one tenant from being read under another if a profile is ever
-- moved. exercises.company_id is nullable (the library is a shared corpus, company_id IS NULL for
-- the seed AND for Stephanie's own imports), so the favourite's company_id comes from the coach,
-- not from the exercise.

create table if not exists public.exercise_favorites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id)  on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, exercise_id)
);

alter table public.exercise_favorites enable row level security;

-- Read path is "every favourite this coach has", so profile_id leads the index. The exercise_id
-- index serves the reverse question (who starred this) and the cascade delete.
create index if not exists idx_exercise_favorites_profile  on public.exercise_favorites(profile_id);
create index if not exists idx_exercise_favorites_exercise on public.exercise_favorites(exercise_id);

drop policy if exists exercise_favorites_owner on public.exercise_favorites;
create policy exercise_favorites_owner on public.exercise_favorites
  using (profile_id = auth.uid() and company_id = public.current_company_id())
  with check (profile_id = auth.uid() and company_id = public.current_company_id());
