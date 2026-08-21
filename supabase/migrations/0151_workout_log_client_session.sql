-- A stable key for a workout in progress, so every set can be saved as she does it.
--
-- THE BUG THIS EXISTS TO FIX, reproduced against production: log four sets, leave with the phone's
-- back gesture, and NOTHING reaches the server. workout_logs, set_logs and
-- workout_completion_history were all empty after a real member completed a real workout, and
-- api_request_log showed no POST to /api/workouts/log at all. The request was never made.
--
-- The player buffered the whole session in memory and localStorage and posted once, from the Finish
-- button on the rating sheet at the end. Every other way out of that screen - the back gesture, the
-- app being evicted, a dropped phone - lost the lot. On a phone the back gesture IS how you leave,
-- so the common path was the losing one.
--
-- The buffering was right for a gym basement with no signal, and the localStorage draft stays for
-- exactly that. What was wrong was making one request at the END the only chance. Now each logged
-- set posts the session so far, keyed by an id the CLIENT generates once and keeps in its draft, so
-- posting twice updates one row instead of creating two.
--
-- TEXT, not uuid, and no foreign key: this value is generated in a browser and its only job is to
-- be stable across the retries of one session. Validating it as a uuid would buy nothing and would
-- turn a malformed client into a 500 rather than a new row.
alter table public.workout_logs
  add column if not exists client_session_id text;

comment on column public.workout_logs.client_session_id is
  'Client-generated id for one in-progress session, so repeated saves upsert instead of duplicating. NULL for historic rows and for any caller that does not send one.';

-- Scoped to the profile, and PARTIAL so the 0 existing rows (and any future caller that sends no
-- id) are unaffected. Without this the upsert has nothing to conflict on and every set she logs
-- would insert another workout_log.
create unique index if not exists workout_logs_client_session_uidx
  on public.workout_logs (profile_id, client_session_id)
  where client_session_id is not null;

-- One completion row per workout_log.
--
-- This table is what gamification reads to decide whether she trained today, and what the weekly
-- training target counts. With the player now saving after every set, an unguarded insert would
-- turn one 20-movement session into 47 "completions" and a single workout would read as a whole
-- month of training.
--
-- Safe to make unique: logging.ts is the only writer in the codebase (everything else reads), and
-- the table is empty.
create unique index if not exists workout_completion_history_log_uidx
  on public.workout_completion_history (workout_log_id);
