-- PRD-01 hardening: tighten RLS on system/infrastructure tables.
-- launchproof found 13 permissive policies. Split into two categories:
--
-- (A) System INSERT tables: change WITH CHECK(true) to WITH CHECK(false).
--     Authenticated users must not be able to forge audit/session/API log entries.
--     service_role and postgres bypass RLS entirely so triggers + edge fns still write.
--
-- (B) ALL-policy global tables: drop open ALL policy, add operator-only SELECT.
--     Any authenticated user could previously read+write cron logs, rate-limit data,
--     and the full email suppression list. Only operators should see this data.
--     service_role handles all writes (Resend webhook, pg_cron, edge fns) via RLS bypass.
--
-- KALDR:GLOBAL reference tables (muscle_groups, exercise_equipment_types,
-- substitution_reason_tags, roles) keep USING(true) on SELECT — they are
-- intentionally world-readable reference data with no PII or cross-tenant concern.

-- ---- (A) System INSERT tables -----------------------------------------------

-- audit_log: only postgres trigger (SECURITY DEFINER) should insert
drop policy if exists audit_system_insert on public.audit_log;
create policy audit_system_insert on public.audit_log
  for insert with check (false);

-- session_logs: only edge functions via service_role should insert
drop policy if exists session_system_insert on public.session_logs;
create policy session_system_insert on public.session_logs
  for insert with check (false);

-- security_events: only edge functions via service_role should insert
drop policy if exists security_events_system_insert on public.security_events;
create policy security_events_system_insert on public.security_events
  for insert with check (false);

-- api_usage_log: only _shared/api.ts via service_role should insert
drop policy if exists api_usage_system_insert on public.api_usage_log;
create policy api_usage_system_insert on public.api_usage_log
  for insert with check (false);

-- ai_usage_log: only OpenRouter cost tracking via service_role should insert
drop policy if exists ai_usage_system_insert on public.ai_usage_log;
create policy ai_usage_system_insert on public.ai_usage_log
  for insert with check (false);

-- email_send_log: only Resend wrapper via service_role should insert
drop policy if exists email_send_system_insert on public.email_send_log;
create policy email_send_system_insert on public.email_send_log
  for insert with check (false);

-- ---- (B) ALL-policy global system tables ------------------------------------

-- cron_job_log: pg_cron writes via postgres (RLS bypass); only operator can read
drop policy if exists cron_job_log_system on public.cron_job_log;
create policy cron_job_log_operator_read on public.cron_job_log
  for select using ((auth.jwt() ->> 'user_role') = 'operator');

-- rate_limit_log: edge fns write via service_role (RLS bypass); only operator can read
drop policy if exists rate_limit_system on public.rate_limit_log;
create policy rate_limit_log_operator_read on public.rate_limit_log
  for select using ((auth.jwt() ->> 'user_role') = 'operator');

-- email_suppression_list: Resend webhook writes via service_role (RLS bypass); operator only
drop policy if exists email_suppression_system on public.email_suppression_list;
create policy email_suppression_operator_read on public.email_suppression_list
  for select using ((auth.jwt() ->> 'user_role') = 'operator');
