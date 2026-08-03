-- Population portion bias, computed in Postgres instead of over HTTP.
--
-- WHY. This job read `ai_inferences` from Supabase, sent it to a Vercel route, did arithmetic there,
-- and wrote the result back to Supabase. The data never needed to leave the database. On 2026-08-01
-- Vercel soft-blocked the project and this job (along with 13 others) got a 402 for every scheduled
-- run, so a computation that Postgres could do by itself stopped happening because a different
-- vendor was unavailable.
--
-- After this migration the whole job is `select public.refresh_population_bias();`. No HTTP, no
-- shared secret in the cron body, nothing outside the database to be down.
--
-- PARITY. The arithmetic is a literal translation of aggregateBias() in
-- src/lib/nutrition/population-bias.ts, and the thresholds below are its exported constants. The
-- translation is exact at the two places it could plausibly drift:
--   * MEDIAN: percentile_cont(0.5) interpolates between the two middle values on an even count,
--     which for two values is their mean, matching the JS median(). On an odd count both return the
--     middle element.
--   * ROUNDING: JS Math.round() rounds half toward +Infinity and numeric round() rounds half away
--     from zero. Ratios here are always positive, so the two agree.
-- .qa-visual/population-bias-sql-parity-test.mjs runs both over the same generated corpus.

create or replace function public.refresh_population_bias(p_company_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Mirrors the exported constants in population-bias.ts. Changing one without the other is how the
  -- prompt starts disagreeing with the table it reads from.
  c_lookback_days constant int     := 120;  -- LOOKBACK_DAYS (population-bias-store.ts)
  c_min_samples   constant int     := 6;    -- MIN_SAMPLES
  c_min_members   constant int     := 3;    -- MIN_MEMBERS
  c_min_ratio     constant numeric := 0.5;  -- MIN_RATIO
  c_max_ratio     constant numeric := 2.0;  -- MAX_RATIO
  c_min_deviation constant numeric := 0.12; -- MIN_DEVIATION
  c_scan_limit    constant int     := 5000; -- the source-row cap the TS version used

  v_company uuid := p_company_id;
  v_scanned int  := 0;
  v_rows    int  := 0;
begin
  if v_company is null then
    select id into v_company from public.companies where slug = 'thick-and-fit' limit 1;
  end if;
  if v_company is null then
    return jsonb_build_object('ok', false, 'rows', 0, 'scanned', 0, 'error', 'tenant not configured');
  end if;

  -- Replace wholesale, scoped to the tenant. DELETE-then-insert rather than upsert because a food
  -- whose bias has decayed below the floors must DISAPPEAR: upserting alone would leave a stale
  -- prior being injected into every scan long after the evidence for it stopped existing.
  --
  -- This is its OWN statement, deliberately. Folding it into the CTE chain below as a data-modifying
  -- `wiped as (delete ...)` looks tidier and is broken: sub-statements in a WITH cannot see each
  -- other's effects, so the INSERT would still see the rows the DELETE is removing and collide with
  -- scan_population_bias_food_uidx (company_id, food_key). It would succeed exactly once, against an
  -- empty table, and fail on every run after that. Same transaction either way, so nothing is lost.
  delete from public.scan_population_bias where company_id = v_company;

  with src as (
    -- The TS version took an arbitrary 5000 rows (no ORDER BY under the limit). Ordering by recency
    -- makes the aggregate deterministic and, when the cap ever binds, keeps the freshest evidence
    -- rather than whatever the planner happened to return.
    select i.profile_id, i.correction
    from public.ai_inferences i
    where i.company_id = v_company
      and i.feature = 'photo-scan'
      and i.correction is not null
      and i.created_at >= now() - make_interval(days => c_lookback_days)
      and i.profile_id is not null  -- no member => cannot count toward the distinct-member floor
    order by i.created_at desc
    limit c_scan_limit
  ),
  samples as (
    select
      -- normalizeFoodKey(): trim, lowercase, collapse runs of whitespace, cap at 120 chars.
      left(regexp_replace(lower(btrim(item ->> 'predicted_name')), '\s+', ' ', 'g'), 120) as food,
      s.profile_id,
      (item ->> 'predicted_grams')::numeric as predicted_grams,
      (item ->> 'corrected_grams')::numeric as corrected_grams
    from src s
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.correction -> 'items') = 'array'
           then s.correction -> 'items'
           else '[]'::jsonb end
    ) as item
    where item ->> 'predicted_name' is not null
      and (item ->> 'predicted_grams') ~ '^-?[0-9.]+$'
      and (item ->> 'corrected_grams') ~ '^-?[0-9.]+$'
  ),
  valid as (
    select food, profile_id, corrected_grams / predicted_grams as ratio
    from samples
    where food <> ''
      and predicted_grams > 0
      and corrected_grams > 0
      -- Drop absurd edits before they reach the median. A 20x ratio is a member fixing a
      -- misidentification (the model said "almonds", they logged a whole meal), not a portion signal.
      and corrected_grams / predicted_grams between 0.1 and 10
  ),
  counted as (
    select
      food,
      count(*)::int                  as samples,
      count(distinct profile_id)::int as members,
      percentile_cont(0.5) within group (order by ratio) as raw_ratio
    from valid
    group by food
  ),
  kept as (
    select
      food,
      samples,
      members,
      -- Clamp THEN round, matching the TS order. The deviation test below uses the RAW median, so a
      -- food is judged on its real signal and only the stored value is clamped.
      --
      -- The ::numeric is load-bearing: percentile_cont returns double precision even for numeric
      -- input, and round(double precision, int) does not exist in Postgres. Without the cast this
      -- function does not compile at all.
      round(least(c_max_ratio, greatest(c_min_ratio, raw_ratio::numeric)), 2) as ratio
    from counted
    where samples >= c_min_samples
      and members >= c_min_members
      and abs(raw_ratio - 1) >= c_min_deviation
  ),
  inserted as (
    insert into public.scan_population_bias (company_id, food_key, ratio, sample_count, member_count, computed_at)
    select v_company, food, ratio, samples, members, now() from kept
    returning 1
  )
  select
    (select count(*) from valid)::int,
    (select count(*) from inserted)::int
  into v_scanned, v_rows;

  return jsonb_build_object('ok', true, 'rows', v_rows, 'scanned', v_scanned);
exception when others then
  -- Never throws: this runs from a cron and from an admin button, and neither should fail over
  -- telemetry. The error is returned so the cron log records why rather than recording nothing.
  return jsonb_build_object('ok', false, 'rows', 0, 'scanned', 0, 'error', sqlerrm);
end;
$function$;

comment on function public.refresh_population_bias(uuid) is
  'Recomputes scan_population_bias for a tenant entirely inside Postgres. Port of aggregateBias() in src/lib/nutrition/population-bias.ts; see 0102 for the parity notes. Replaces an HTTP round trip to a Vercel route.';

-- The cron entry point: do the work, then write its own audit row. Previously that row was written
-- by the Vercel route, which is why the August 1 outage recorded nothing at all: the thing that logs
-- the failure was downstream of the failure.
create or replace function public.cron_refresh_population_bias()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  v_result := public.refresh_population_bias(null);
  insert into public.cron_job_log (job_name, status, detail)
  values (
    'refresh-population-bias-cron',
    case when coalesce((v_result ->> 'ok')::boolean, false) then 'success' else 'error' end,
    v_result
  );
end;
$function$;

comment on function public.cron_refresh_population_bias() is
  'pg_cron entry point for the population-bias refresh. Runs the aggregation and writes its own cron_job_log row, so the audit trail survives an outage of anything outside Postgres.';
