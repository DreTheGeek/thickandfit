-- Marks when a challenge's "it started" notification has been fanned out to members, so:
--   1) a future-dated challenge notifies members on its REAL start day (a daily job picks it up), and
--   2) it is never double-notified.
-- A challenge created to start today is notified immediately at creation and stamped here at once.
alter table public.challenges add column if not exists start_notified_at timestamptz;
