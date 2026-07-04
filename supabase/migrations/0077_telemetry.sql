-- 0077 -- Telemetry: log every API request (method, path, status, latency, user) so the admin portal
-- can show the command-center dashboards (API usage analytics, error monitoring, endpoint breakdown,
-- latency percentiles, top consumers). Fire-and-forget writes from a route wrapper. Company-scoped +
-- operator-read RLS; the app writes via the service client.
create table if not exists public.api_request_log (
  id           bigint generated always as identity primary key,
  company_id   uuid,
  ts           timestamptz not null default now(),
  method       text not null,
  path         text not null,           -- normalized (ids collapsed) for grouping
  raw_path     text,
  status       int not null,
  duration_ms  int,
  user_id      uuid,
  user_email   text,
  error        text,
  ip           text
);
create index if not exists idx_api_log_ts on public.api_request_log (ts desc);
create index if not exists idx_api_log_path on public.api_request_log (path, ts desc);
create index if not exists idx_api_log_status on public.api_request_log (status, ts desc);
create index if not exists idx_api_log_user on public.api_request_log (user_id, ts desc);

alter table public.api_request_log enable row level security;
drop policy if exists api_request_log_operator on public.api_request_log;
create policy api_request_log_operator on public.api_request_log for select
  using (public.profile_role() = 'operator');

-- Keep it bounded: a helper the nightly cron calls to trim logs older than 60 days.
create or replace function public.trim_api_request_log()
returns void language sql security definer set search_path = public as $$
  delete from public.api_request_log where ts < now() - interval '60 days';
$$;
