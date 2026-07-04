-- 0078 -- api_analytics(days): one JSON payload powering the admin command-center dashboards from
-- api_request_log. Operator-only (SECURITY DEFINER + role check). Percentiles done in SQL.
create or replace function public.api_analytics(days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => days);
  v_out jsonb;
begin
  if public.profile_role() <> 'operator' then
    raise exception 'operator only';
  end if;

  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'requests', count(*),
        'errors', count(*) filter (where status >= 400),
        'error_rate', case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where status >= 400) / count(*), 2) end,
        'p95', coalesce(round(percentile_cont(0.95) within group (order by duration_ms) filter (where duration_ms is not null))::int, 0),
        'p99', coalesce(round(percentile_cont(0.99) within group (order by duration_ms) filter (where duration_ms is not null))::int, 0),
        'anon', count(*) filter (where user_id is null),
        'auth_fail', count(*) filter (where status in (401, 403)),
        'public_hits', count(*) filter (where status < 400 and user_id is null)
      ) from api_request_log where ts >= v_since
    ),
    'volume', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'requests', c, 'errors', e) order by d), '[]'::jsonb)
      from (select date_trunc('day', ts)::date d, count(*) c, count(*) filter (where status >= 400) e
            from api_request_log where ts >= v_since group by 1) t
    ),
    'endpoints', (
      select coalesce(jsonb_agg(x order by x->'requests' desc), '[]'::jsonb) from (
        select jsonb_build_object('path', path, 'method', method, 'requests', count(*),
          'error_rate', case when count(*)=0 then 0 else round(100.0*count(*) filter (where status>=400)/count(*),1) end,
          'avg_ms', coalesce(round(avg(duration_ms))::int,0)) x, count(*) c
        from api_request_log where ts >= v_since group by path, method order by c desc limit 40
      ) e
    ),
    'latency', (
      select coalesce(jsonb_agg(x order by x->'requests' desc), '[]'::jsonb) from (
        select jsonb_build_object('path', path, 'requests', count(*),
          'p50', coalesce(round(percentile_cont(0.5) within group (order by duration_ms))::int,0),
          'p95', coalesce(round(percentile_cont(0.95) within group (order by duration_ms))::int,0),
          'p99', coalesce(round(percentile_cont(0.99) within group (order by duration_ms))::int,0)) x, count(*) c
        from api_request_log where ts >= v_since and duration_ms is not null group by path order by c desc limit 40
      ) l
    ),
    'consumers', (
      select coalesce(jsonb_agg(x order by x->'requests' desc), '[]'::jsonb) from (
        select jsonb_build_object('email', coalesce(user_email, 'anon'), 'requests', count(*),
          'errors', count(*) filter (where status>=400), 'last', max(ts)) x, count(*) c
        from api_request_log where ts >= v_since and user_id is not null group by user_email order by c desc limit 20
      ) c
    ),
    'recent_errors', (
      select coalesce(jsonb_agg(jsonb_build_object('ts', ts, 'status', status, 'method', method, 'path', raw_path, 'duration_ms', duration_ms, 'email', coalesce(user_email,'anon'), 'error', error) order by ts desc), '[]'::jsonb)
      from (select * from api_request_log where status >= 400 order by ts desc limit 30) r
    ),
    'rate_limits', (
      select coalesce(jsonb_agg(jsonb_build_object('ts', ts, 'path', raw_path, 'email', coalesce(user_email,'anon')) order by ts desc), '[]'::jsonb)
      from (select * from api_request_log where status = 429 order by ts desc limit 20) rl
    )
  ) into v_out;

  return v_out;
end;
$$;
grant execute on function public.api_analytics(int) to authenticated;
