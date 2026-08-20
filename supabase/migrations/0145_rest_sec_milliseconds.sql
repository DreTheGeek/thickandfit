-- ---------------------------------------------------------------------------------------------
-- 0145: session_exercises.rest_sec holds MILLISECONDS. Convert it to the seconds it is named for.
--
-- WHAT THIS BROKE, LIVE. The workout player does setRest(ex.rest_sec) and ticks that value down
-- once a second. Her Lenus export carries `restTime` in milliseconds and
-- scripts/import-lenus-programs.mjs wrote it straight through, so finishing a set of banded squats
-- (rest_sec = 20000) started a countdown of 20,000 seconds. Five and a half hours, the audible
-- timer never firing, on the screen she is standing in front of between sets. It has been that way
-- since the programs import.
--
-- The distribution leaves no ambiguity about which rows are affected:
--
--     >= 1000   1,454 rows    20000, 90000, 120000, 60000, 30000, 300000 ...
--     <  1000       4 rows    every one of them exactly 60
--     601..999      0 rows
--
-- Every value at or above 1000 is a sane rest period read as milliseconds (20s, 90s, 2min, 5min).
-- The four 60s are genuine seconds. Nothing sits in between, so the threshold is not a judgement
-- call on this data, and the guard below re-checks that before touching anything.
--
-- CEILING. After conversion, anything still over 600 seconds is not a rest period, it is bad data;
-- 300000ms lands at exactly 300s so nothing real is clipped, but the clamp means a future bad
-- import cannot put a member back in an hour-long countdown.
--
-- This is NOT the only fix. The importer is corrected in the same change, because STATE.md
-- schedules it to run again before her Lenus account closes on 31 August and would otherwise
-- rewrite these rows. And src/lib/workout/rest.ts normalises at every READ, so a third mistake in
-- the same place still cannot reach a member. Data, producer, consumer.
-- ---------------------------------------------------------------------------------------------

do $$
declare
  ambiguous integer;
begin
  -- Refuse to run if the data no longer looks the way this migration was written for. A value
  -- between 601 and 999 is neither clearly seconds nor clearly milliseconds, and silently dividing
  -- one by 1000 would turn a real 15 minute rest into 0.
  select count(*) into ambiguous
  from public.session_exercises
  where rest_sec between 601 and 999;

  if ambiguous > 0 then
    raise exception
      'rest_sec has % row(s) between 601 and 999, which are ambiguous. Inspect before converting.',
      ambiguous;
  end if;
end $$;

update public.session_exercises
set rest_sec = least(600, greatest(1, round(rest_sec / 1000.0)::integer))
where rest_sec >= 1000;

comment on column public.session_exercises.rest_sec is
  'Rest between sets, in SECONDS. Her Lenus export carries this as milliseconds and the importer '
  'wrote it through unconverted until 0145; scripts/import-lenus-programs.mjs now divides, and '
  'src/lib/workout/rest.ts normalises on read so a future bad import cannot reach the player.';
