-- The unique index behind the workout autosave, made usable by ON CONFLICT.
--
-- 0151 created it PARTIAL (`where client_session_id is not null`), which is the tidier shape and
-- does not work: Postgres cannot INFER a partial index from an ON CONFLICT target unless the
-- statement repeats the index predicate, and PostgREST has no way to send one. Every autosave came
-- back 500 with "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". Caught in the browser against production, by the error message that the same
-- change had just started forwarding instead of swallowing.
--
-- A PLAIN unique index behaves identically here. Postgres treats NULLs as DISTINCT in a unique
-- index by default, so the historic rows and every future caller that sends no id can still have as
-- many NULLs per profile as they like; only two rows with the SAME non-null id collide, which is
-- exactly the constraint the autosave needs.
drop index if exists public.workout_logs_client_session_uidx;

create unique index if not exists workout_logs_client_session_uidx
  on public.workout_logs (profile_id, client_session_id);
