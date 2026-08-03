-- Curate the exercise library: archive, never delete.
--
-- WHAT THIS LIBRARY IS. An unmodified bulk import of the open-source yuhonas/free-exercise-db, all
-- 873 rows written inside a 0.6 second window on 2026-06-18. It is a general bodybuilding catalog:
-- Zercher squats, Conan's Wheel, atlas stones, 66 bicep curl variants. Meanwhile a glute filter
-- returns 13 real answers, for a business where "glute" appears in four of the five most-programmed
-- session types across 4,182 completed sessions.
--
-- THE HARD CONSTRAINT. All four foreign keys into public.exercises are ON DELETE CASCADE:
-- set_logs, session_exercises, and both sides of exercise_substitutions. set_logs already holds real
-- member workout history. A DELETE here does not remove a catalog entry, it silently destroys the
-- record of someone's training. Nothing in this migration deletes a row, and the trigger below makes
-- that structural rather than a convention.
--
-- Full reasoning, per-rule counts and the read-path split: .planning/EXERCISE-LIBRARY-CURATION-PLAN.md

-- ---------------------------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------------------------
-- archived_at, not is_active: it matches the soft-delete convention already used by 0050 and 0051,
-- and it records WHEN for the audit trail. archive_reason is what makes one curation pass reversible
-- without undoing the next one. Named archived_at rather than deleted_at because nothing is deleted,
-- and the name is the strongest signal available to the next engineer.
alter table public.exercises
  add column if not exists archived_at       timestamptz,
  add column if not exists archived_by       uuid references public.profiles(id),
  add column if not exists archive_reason    text,
  add column if not exists is_core           boolean not null default false,
  add column if not exists secondary_muscles text[] not null default '{}';

comment on column public.exercises.archived_at is
  'Hidden from every coach-facing picker when set. NEVER delete an exercise: set_logs cascades and holds member history.';
comment on column public.exercises.is_core is
  'On the filming shot list. Separate question from archived_at: "should a coach see this" vs "does Stephanie film it".';
comment on column public.exercises.secondary_muscles is
  'Muscles a movement also trains. Exists because muscle_group is a single column and files every RDL under hamstrings and every lunge under quadriceps, which hides the glute work in a glute-focused app.';

create index if not exists idx_exercises_active
  on public.exercises (company_id, name_en) where archived_at is null;
create index if not exists idx_exercises_secondary
  on public.exercises using gin (secondary_muscles);

-- ---------------------------------------------------------------------------------------------
-- 2. The deletion tripwire
-- ---------------------------------------------------------------------------------------------
-- RLS cannot do this job: every write path here is the service client, which bypasses it. This is a
-- trigger so that a future bulk cleanup, a migration, or a careless psql session cannot quietly take
-- member history with it.
--
-- DELIBERATE SIDE EFFECT, written down so it is not a surprise: exercises.company_id cascades from
-- companies, so this also makes DELETE on a company row fail. On a single-tenant production whose
-- 0029 migration exists specifically to prevent that wipe, that is a feature.
create or replace function public.exercises_block_delete()
returns trigger
language plpgsql
as $function$
declare
  v_logs int;
begin
  select count(*) into v_logs from public.set_logs where exercise_id = old.id;
  raise exception
    'exercises are never deleted (% has % set_logs rows). Set archived_at instead.',
    old.name_en, v_logs;
end;
$function$;

drop trigger if exists trg_exercises_block_delete on public.exercises;
create trigger trg_exercises_block_delete
  before delete on public.exercises
  for each row execute function public.exercises_block_delete();

-- ---------------------------------------------------------------------------------------------
-- 3. Re-tag BEFORE cutting
-- ---------------------------------------------------------------------------------------------
-- muscle_group is a single text column and it is lying by omission: Romanian deadlifts and good
-- mornings are filed under hamstrings, every lunge and split squat under quadriceps, every
-- hyperextension under lower back. In a glute-focused app that makes the money lifts invisible to a
-- glute filter.
--
-- muscle_group is NOT overwritten. She programs "Hamstrings & Glutes" (347 sessions) and "Quads &
-- Glutes" (274), so the hinges must stay findable as hamstrings. secondary_muscles is additive.
update public.exercises set secondary_muscles = array['glutes']
where muscle_group <> 'glutes'
  and category not in ('stretching', 'olympic weightlifting', 'strongman')
  and name_en ~* '(hip thrust|glute|bridge|romanian|stiff-leg|stiff leg|good morning|hyperext|abduct|step.?up|lunge|split squat|sumo|pull through|kickback|trap bar deadlift|deficit deadlift|barbell deadlift)'
  -- "kickback" also matches Tricep Dumbbell Kickback; the loaded-carry and olympic names are noise.
  and name_en !~* '(with chains|with bands|reverse band|snatch|clean|jerk|tricep)';

-- Four rows where the name, the cues and the tag genuinely disagree.
update public.exercises set muscle_group = 'glutes'
where name_en in ('Crossover Reverse Lunge', 'Reverse Hyperextension');

-- ---------------------------------------------------------------------------------------------
-- 4. Pass 1: out of scope for this audience
-- ---------------------------------------------------------------------------------------------
-- Every rule is name- or category-scoped and countable. The in-use guard exempts anything already
-- sitting in a member's log or a built session, so curation can never orphan live work.
with in_use as (
  select id from public.exercises e
  where exists (select 1 from public.set_logs s where s.exercise_id = e.id)
     or exists (select 1 from public.session_exercises se where se.exercise_id = e.id)
)
update public.exercises e set
  archived_at = now(),
  archive_reason = '2026-08 pass1 out-of-scope'
where e.archived_at is null
  and e.id not in (select id from in_use)
  -- THE GLUTE GUARD, and it is not theoretical. A dry run of the rules below caught 9 hinge and
  -- glute movements, including "Romanian Deadlift from Deficit" filed under olympic weightlifting:
  -- the same miscategorisation that puts the library's only Barbell Hip Thrust under powerlifting.
  -- This is a glute-focused business, so no rule may take a hip-hinge or glute movement out on a
  -- category or difficulty technicality.
  --
  -- The geared exception is deliberate: chains, bands, pins and specialty bars are equipment her
  -- clients do not have, so "Sumo Deadlift with Chains" still goes while "Sumo Deadlift" stays.
  and not (
    e.name_en ~* '(hip thrust|glute|bridge|romanian|stiff-leg|stiff leg|sumo|good morning|hyperext|abduct|lunge|split squat|step.?up|kickback|deadlift)'
    and e.name_en !~* '(with chains|with bands|reverse band|off pins|pin press|hanging bar|board press|speed box|chain)'
  )
  and (
    -- R1: competition lifting. Zero of 4,182 sessions.
    e.category in ('olympic weightlifting', 'strongman')
    -- R2: geared powerlifting ONLY, by name. NOT by category: `powerlifting` is where the library's
    -- only Barbell Hip Thrust, Barbell Glute Bridge, Glute Ham Raise, Sumo Deadlift and Good Morning
    -- live. Cutting that category wholesale would delete the single most important glute movement.
    or (e.category = 'powerlifting' and e.name_en ~* '(with chains|with bands|reverse band|board press|pin press|off pins|chain handle|chain press|speed box|hanging bar)')
    -- R3: sport-named lifts that escaped the category tag.
    or e.name_en ~* '(snatch|clean|jerk|atlas|tire flip|sled|yoke|keg|prowler|log lift|sandbag|farmer|rickshaw|conan|circus bell|axle|power stairs|crucifix|car deadlift|muscle up|planche|iron cross)'
    -- R4: muscle groups no session name has ever mentioned.
    or e.muscle_group in ('neck', 'forearms')
    -- R5: orphan equipment nobody was asked to own.
    or e.equipment in ('e-z curl bar', 'exercise ball', 'medicine ball')
    -- R6: expert bodybuilding technique. The stretching exclusion is load-bearing: without it this
    -- cuts Lying Glute and Seated Glute, and post-workout stretch is 231 sessions.
    or (e.difficulty = 'expert' and e.category <> 'stretching')
    -- R7: traps, minus the two shrugs the shoulder block uses.
    or (e.muscle_group = 'traps' and e.name_en !~* 'shrug')
  );
