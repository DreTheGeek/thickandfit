-- 0034 RLS hardening (round 3, systemic). The audit found sensitive tables still on tenant-only
-- ALL/SELECT policies (no owner/role gate) -> in single-tenant, any authenticated user could read
-- (and sometimes write) them. This makes the DATABASE enforce isolation instead of relying on the
-- app remembering to scope every service-client query. App reads of cross-user data go through the
-- service client (BYPASSRLS), so tightening these does not break the app (community author hydration
-- is moved to the service client in the same change set).

-- profiles: profile_tenant was FOR ALL with only company_id = current_company_id(), so any user could
-- read every profile's email and UPDATE/DELETE other people's rows. Split to owner-or-coach read +
-- owner-only update. (0018 already revoked the escalation columns; deletes are service-role only now.)
drop policy if exists profile_tenant on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coach());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- profiles_auth_admin_read (role supabase_auth_admin, the JWT hook) is intentionally left in place.

-- api_keys: secret material. Was tenant-only ALL (any user read/write). Operator read only; writes
-- are service-role only (no authenticated write policy).
drop policy if exists api_keys_tenant on public.api_keys;
create policy api_keys_operator_read on public.api_keys for select to authenticated
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') = 'operator');

-- AI eval harness (dev/admin tooling). Coach-gated.
drop policy if exists ai_evals_tenant on public.ai_evals;
create policy ai_evals_coach on public.ai_evals for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop policy if exists ai_eval_cases_tenant on public.ai_eval_cases;
create policy ai_eval_cases_coach on public.ai_eval_cases for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
drop policy if exists ai_eval_runs_tenant on public.ai_eval_runs;
create policy ai_eval_runs_coach on public.ai_eval_runs for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- usage / security / waitlist logs: coach-or-operator read only (were any-authenticated).
drop policy if exists api_usage_view_own on public.api_usage_log;
create policy api_usage_coach on public.api_usage_log for select to authenticated
  using (public.is_coach());

drop policy if exists security_events_view_own on public.security_events;
create policy security_events_operator on public.security_events for select to authenticated
  using ((auth.jwt() ->> 'user_role') = 'operator');

drop policy if exists waitlist_tenant on public.waitlist_leads;
create policy waitlist_coach_read on public.waitlist_leads for select to authenticated
  using (public.is_coach());
