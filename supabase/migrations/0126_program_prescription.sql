-- What a coach can actually prescribe: supersets, rep ranges, percentages, AMRAP, tempo.
--
-- MEASURED AGAINST THE CATEGORY, not invented. TrueCoach ships supersets, circuits and progression
-- schemes; Hevy Coach ships set types, rep ranges, RPE and rest timers; Trainerize adds circuits,
-- AMRAPs and percentage-based prescriptions. session_exercises already carries sets, reps,
-- time_sec, weight, rest_sec, rounds, notes and a config jsonb, and the player already does per-set
-- RPE, progressive-overload targets with their reasoning, substitutions and PR detection, which is
-- competitive. These five columns are what is missing to express a real program.
--
-- WHY COLUMNS AND NOT config JSONB. config exists and would have taken all of this without a
-- migration. It is the wrong home: a rep range decides what the player renders and what the
-- overload engine compares against, and a superset decides the ORDER exercises are performed in.
-- Anything the app must branch on belongs in a column where it can be constrained, indexed and
-- found. config stays for genuinely free-form per-format detail.

alter table public.session_exercises
  -- SUPERSETS AND CIRCUITS. Two exercises are supersetted when they share a group_key inside one
  -- session; sort_order still decides the order within the group. A key rather than a self-FK
  -- because a circuit is three or more exercises and a parent pointer turns that into a linked list
  -- that any reorder can break.
  add column if not exists group_key text,
  add column if not exists group_kind text,

  -- REP RANGES. `reps` stays the single prescribed target, so nothing that reads it today changes.
  -- The range is what she actually coaches to, and the app already speaks it: the overload line in
  -- the player reads "add a rep toward the top of your 12-14 range" while the schema could only
  -- store one integer, so that sentence was describing a range the database did not have.
  add column if not exists reps_min smallint,
  add column if not exists reps_max smallint,

  -- PERCENTAGE-BASED PRESCRIPTION. Stored as a percent (72.5 = 72.5% of 1RM), not a fraction, since
  -- that is how it is written on a program and misreading 0.725 as 72.5% is a 100x loading error.
  add column if not exists pct_1rm numeric(4, 1),

  -- AMRAP. Distinct from a null rep target: "as many as you can" is a prescription, not a missing
  -- value, and the player has to render it differently and must not offer a +1 rep overload on it.
  add column if not exists is_amrap boolean not null default false,

  -- TEMPO, in the standard four-number notation (eccentric-pause-concentric-pause), e.g. "3-1-1-0".
  -- Text because "3-1-X-0" is valid and common, where X means explosive.
  add column if not exists tempo text;

alter table public.session_exercises
  drop constraint if exists session_exercises_group_kind_check;
alter table public.session_exercises
  add constraint session_exercises_group_kind_check
  check (group_kind is null or group_kind in ('superset', 'circuit', 'giant_set'));

-- A range must be a range. Catching this in the database matters because the builder is not the
-- only writer: the Lenus importer will write straight to this table.
alter table public.session_exercises
  drop constraint if exists session_exercises_rep_range_check;
alter table public.session_exercises
  add constraint session_exercises_rep_range_check
  check (
    reps_min is null
    or reps_max is null
    or reps_min <= reps_max
  );

alter table public.session_exercises
  drop constraint if exists session_exercises_pct_1rm_check;
alter table public.session_exercises
  add constraint session_exercises_pct_1rm_check
  check (pct_1rm is null or (pct_1rm > 0 and pct_1rm <= 200));

-- Grouped exercises are always read together, per session.
create index if not exists idx_session_exercises_group
  on public.session_exercises (session_id, group_key)
  where group_key is not null;

comment on column public.session_exercises.group_key is
  'Exercises sharing this key within one session are performed together. group_kind says how. Null means a straight set.';
comment on column public.session_exercises.reps_min is
  'Lower bound of the prescribed range. `reps` remains the single target so existing readers are unaffected.';
comment on column public.session_exercises.is_amrap is
  'As many reps as possible. A prescription, not a missing rep target: the player must not offer a +1 rep overload against it.';
comment on column public.session_exercises.tempo is
  'Four-phase tempo, eccentric-pause-concentric-pause, e.g. 3-1-1-0. Text because X (explosive) is valid.';
