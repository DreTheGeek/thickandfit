-- Her filmed demos, and the grouping she actually thinks in.
--
-- TWO PROBLEMS, ONE MIGRATION, because they are the same complaint: her library does not look like
-- her library. "i dont see her recorded video in this software anywhere ... also, the organization
-- sucks."
--
-- 1. THE VIDEOS ARE NOWHERE. 366 of her 367 movements carry a `lenus_video_key`, which is the
--    filename of a video on a platform whose contract ends 31 Aug. Nothing in this app can play
--    one: `is_own_demo` is false on all 367 and `video_mux_id` is null on all 367. The footage she
--    spent years making has been invisible here since the day it was imported.
--
--    `demo_storage_path` is set ONLY for a file that has actually been uploaded and verified. It is
--    deliberately NOT derived from lenus_video_key at read time: 79 of her keys 403 on Lenus and
--    were never downloaded, so deriving the path would hand the player a URL that 404s and look
--    like a broken app rather than a missing file. A null path means "no footage yet", which is
--    true and renderable.
--
-- 2. THE ORGANIZATION. `muscle_group` is null on 360 of her 367, because her export carried no
--    taxonomy and 0116 refused to invent one. So the library's muscle chips are built from the 7
--    rows that happen to have a value, and everything else is a flat A-Z grid 10 pages deep. For a
--    coach who programs by body part that is unusable.
--
--    `block` holds HER vocabulary, not a taxonomy from a textbook. It comes from the session names
--    in her own 4,182 completed sessions, ranked: Back & biceps (548), Hamstrings & Glutes (347),
--    Full upperbody (319), Shoulders chest & triceps (308), Quads & Glutes (274), Full body HIIT
--    (269), Post workout stretch (231), Cardio & core (133). Those collapse to the seven values
--    below, which is what she already calls them.
--
--    Backfilled by scripts/backfill-exercise-blocks.mjs, which imports the SAME classifier the
--    filming shot list uses (src/lib/exercises/blocks.ts). One classifier, so the list she films
--    from and the library she programmes from can never disagree about where a movement belongs.

alter table public.exercises
  add column if not exists demo_storage_path text,
  add column if not exists block text;

comment on column public.exercises.demo_storage_path is
  'Path in the lenus-coach-media bucket for her filmed demo. Set only after the file is uploaded and verified; null means no footage. Never derive this from lenus_video_key.';

comment on column public.exercises.block is
  'Her own session vocabulary (back_biceps, hams_glutes, quads_legs, shoulders_chest_triceps, core, hiit_cardio, stretch_mobility). Derived from the movement name by src/lib/exercises/blocks.ts, not from muscle_group, which is null on 360 of her 367 rows.';

-- Constrained rather than free text: an unrecognised block silently disappears from a grouped list,
-- which is the failure mode where a coach concludes a movement was deleted.
alter table public.exercises
  drop constraint if exists exercises_block_check;
alter table public.exercises
  add constraint exercises_block_check check (
    block is null or block in (
      'back_biceps',
      'hams_glutes',
      'quads_legs',
      'shoulders_chest_triceps',
      'core',
      'hiit_cardio',
      'stretch_mobility'
    )
  );

-- The library groups by block and the shoot list filters unfilmed, so both read this together.
create index if not exists idx_exercises_block on public.exercises (block) where archived_at is null;

-- "Show me the ones I have footage for" is a real filter on the browse surface.
create index if not exists idx_exercises_has_demo on public.exercises (id)
  where demo_storage_path is not null and archived_at is null;
