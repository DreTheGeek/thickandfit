-- A timed movement has a duration, and there was nowhere to put it.
--
-- 270 of her 2,501 prescribed movements are timed (a 25-minute incline walk, 5 minutes on the
-- Stairmaster) and 160 more are untracked (dynamic warm-up, post-workout stretch). set_logs could
-- record reps and weight and nothing else, so the player invented `reps ?? 10` and `weight ?? 0`
-- and wrote THAT to the history that drives progressive overload.
--
-- Nullable, with no default. A null here means "not a timed movement", which is the truth for the
-- 2,070 rep-based prescriptions; a default of 0 would claim every squat took no time.
alter table public.set_logs
  add column if not exists duration_sec integer;

comment on column public.set_logs.duration_sec is
  'Seconds actually performed, for timed movements (cardio, holds). Null for rep-based sets. Never 0 as a stand-in for unknown.';

-- reps and weight must be nullable for the same reason: a timed movement has neither, and a zero
-- in either column is indistinguishable from "she failed the set".
alter table public.set_logs alter column reps drop not null;
alter table public.set_logs alter column weight drop not null;
