-- =====================================================================================
-- DEPLOY-TIME ONLY. Do NOT run this against a non-prod database.
-- =====================================================================================
--
-- WP11 pg_cron job registration. This is SEPARATE from migration 0039 on purpose: 0039 enables
-- pg_cron + pg_net and adds the per-user timezone columns (safe to apply anywhere). Registering the
-- jobs below points net.http_post at the DEPLOYED production URL, so running it before the app is
-- live at that URL just creates jobs that fail every run. Apply this exactly once, at deploy time,
-- AFTER:
--   1. migration 0039 has been applied (pg_cron + pg_net installed),
--   2. CRON_SECRET is set as a Vercel env var on the production deployment,
--   3. the app is reachable at the URL below over public HTTPS (Supabase egress can reach it).
--
-- SUBSTITUTION (never commit the real secret):
--   * Replace __CRON_SECRET__ with the exact value of the Vercel CRON_SECRET env var.
--   * Replace __APP_URL__ with the production origin, e.g. https://app.teamthickandfit.com
--   Then apply via the Supabase SQL editor or Management API. The placeholders must be substituted
--   at apply time; the substituted file is never written back to git.
--
-- WHY a static bearer and not the app.service_role_key GUC: on hosted Supabase, `alter database set`
-- is permission-denied via the Management API (documented in craneop-ref
-- 20260601_v3_29_reminder_cron.sql:9-10). The static __CRON_SECRET__ that each /api/internal route
-- validates against process.env.CRON_SECRET is the reliable path. If this project DOES allow the GUC,
-- it is an optional upgrade; the endpoint code is identical either way.
--
-- SCHEDULES (pg_cron runs in UTC; it has no per-job timezone):
--   * notify-reminders : HOURLY. The route's generator filters to members whose CURRENT LOCAL HOUR
--                        equals their reminder_hour, so "7pm in each user's zone" works DST-correctly
--                        off one hourly UTC job. The OPTIONAL all-SQL prefilter is shown commented
--                        below for reference; the TS generator already does this filtering, so the
--                        hourly job needs no SQL-side hour math.
--   * notify-renewals  : DAILY at 14:00 UTC (renewal + comp-expiry nudges).
--   * notify-checkins  : DAILY at 15:00 UTC (check-in-due nudges).
--
-- Idempotent: each block unschedules the named job before re-scheduling. Guarded so a DB without
-- pg_cron/pg_net does not hard-fail. Zero em dash.

-- ------------------------------------------------------------------------------------
-- tf-notify-reminders-hourly
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-notify-reminders-hourly' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-notify-reminders-hourly',
    '0 * * * *',  -- top of every hour, UTC
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/notify-reminders',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
  raise notice 'scheduled tf-notify-reminders-hourly at 0 * * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-notify-reminders-hourly.';
end $$;

-- OPTIONAL all-SQL prefilter (reference only; not used because the TS generator already filters).
-- If you ever want pg to pre-narrow before the HTTP hop, the selection predicate is:
--   extract(hour from (now() at time zone profiles.timezone))::int = coalesce(profiles.reminder_hour, 19)
-- DST-correct because `now() at time zone <iana>` is DST-aware.

-- ------------------------------------------------------------------------------------
-- tf-notify-renewals-daily
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-notify-renewals-daily' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-notify-renewals-daily',
    '0 14 * * *',  -- 14:00 UTC daily
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/notify-renewals',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
  raise notice 'scheduled tf-notify-renewals-daily at 0 14 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-notify-renewals-daily.';
end $$;

-- ------------------------------------------------------------------------------------
-- tf-notify-checkins-daily
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-notify-checkins-daily' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-notify-checkins-daily',
    '0 15 * * *',  -- 15:00 UTC daily
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/notify-checkins',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
  raise notice 'scheduled tf-notify-checkins-daily at 0 15 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-notify-checkins-daily.';
end $$;

-- ------------------------------------------------------------------------------------
-- tf-generate-insights-nightly (AI nightly insights + streak recompute + badge awards are ALL folded
-- into the generate-insights endpoint, so this single job populates user_insights, user_streaks, and
-- user_badges). Without it those tables never fill.
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-generate-insights-nightly' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-generate-insights-nightly',
    '0 8 * * *',  -- 08:00 UTC nightly
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/generate-insights',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
  raise notice 'scheduled tf-generate-insights-nightly at 0 8 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-generate-insights-nightly.';
end $$;

-- ------------------------------------------------------------------------------------
-- tf-index-memory-6h (unified member-memory reconciler: sweeps every per-member data source
-- (food days incl. photo scans, meal plans, check-ins, weights, intake, coach notes, physique,
-- measurements) into member_memory so the coach can semantically recall everything. Idempotent +
-- capped, so re-runs only embed genuinely new rows. Default body = active subscribers; a backfill
-- is a manual POST with {"scope":"all","sinceDays":4000}.)
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-index-memory-6h' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-index-memory-6h',
    '30 */6 * * *',  -- every 6 hours, offset :30 so it never collides with the nightly insights job
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/index-memory',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 280000
      );
    $cron$
  );
  raise notice 'scheduled tf-index-memory-6h at 30 */6 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-index-memory-6h.';
end $$;

-- ------------------------------------------------------------------------------------
-- tf-close-challenges-daily (finalize challenges past their ends_on: award the leader the Challenge
-- Champion badge + notify every participant, exactly once via challenges.finalized_at). Without it an
-- ended challenge silently stops being active with no winner, no badge, no notification.
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-close-challenges-daily' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-close-challenges-daily',
    '0 9 * * *',  -- 09:00 UTC daily
    $cron$
      select net.http_post(
        url := '__APP_URL__/api/internal/close-challenges',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
  raise notice 'scheduled tf-close-challenges-daily at 0 9 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-close-challenges-daily.';
end $$;

-- ------------------------------------------------------------------------------------
-- tf-ghl-sync (GoHighLevel -> Supabase opportunity/pipeline sync). The route is GET-only, so this
-- uses net.http_get (not http_post like the others). NOTE: vercel.json also schedules this route
-- daily at 06:00 UTC (the single Vercel Hobby cron slot). When applying this block, REMOVE the
-- crons entry from vercel.json in the same deploy: one scheduler per job, and moving it here frees
-- the constrained Vercel slot. The sync is idempotent, so an overlap is harmless but wasteful.
-- ------------------------------------------------------------------------------------
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-ghl-sync-6h' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-ghl-sync-6h',
    '0 */6 * * *',  -- 00:00 / 06:00 / 12:00 / 18:00 UTC
    $cron$
      select net.http_get(
        url := '__APP_URL__/api/internal/ghl-sync',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        timeout_milliseconds := 60000
      );
    $cron$
  );
  raise notice 'scheduled tf-ghl-sync-6h at 0 */6 * * *';
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed. Skipping tf-ghl-sync-6h.';
end $$;

-- ------------------------------------------------------------------------------------
-- Verify after apply:
--   select jobname, schedule, active from cron.job where jobname like 'tf-%' order by jobname;
-- Then confirm a run lands a cron_job_log row (the endpoint writes it):
--   select job_name, status, ran_at from public.cron_job_log
--    where job_name in ('notify-reminders-cron','notify-renewals-cron','notify-checkins-cron')
--    order by ran_at desc limit 5;
-- For HTTP-level debugging (pg_net is async): select * from net._http_response order by created desc limit 5;
-- ------------------------------------------------------------------------------------
