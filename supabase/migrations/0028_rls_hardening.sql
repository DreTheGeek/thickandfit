-- 0028 RLS hardening (Phase 1). The main-branch review found sensitive tables still on tenant-only
-- ALL/SELECT policies (no owner/role gate). In this single-tenant app every user shares one
-- company_id, so company_id = current_company_id() isolates nobody: any authenticated user could
-- read (and sometimes write) these via PostgREST with their own anon-key session. The app reads
-- cross-user data through the service client (BYPASSRLS), so tightening these does not break the app.
--
-- This mirrors the round-3 hardening that already lives on phase-2/phase-3 (0034) and is applied to
-- the shared prod DB, brought onto main so the repo is the source of truth and a fresh provision is
-- safe. It is idempotent (drop policy if exists) and adds the exercise_substitutions gate that the
-- review flagged and 0034 did not cover.

-- profiles: profile_tenant was FOR ALL with only company_id = current_company_id(), so any user could
-- read every profile's email/name/role and UPDATE/DELETE other people's rows. Split to owner-or-coach
-- read + owner-only update. (0018 already revoked the escalation columns; deletes are service-role only.)
drop policy if exists profile_tenant on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coach());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- profiles_auth_admin_read (role supabase_auth_admin, the JWT hook from 0012) is intentionally kept.

-- api_keys: secret material. Was tenant-only ALL (any user read/write). Operator read only; writes
-- are service-role only (no authenticated write policy).
drop policy if exists api_keys_tenant on public.api_keys;
create policy api_keys_operator_read on public.api_keys for select to authenticated
  using (company_id = public.current_company_id() and (auth.jwt() ->> 'user_role') = 'operator');

-- AI eval harness (dev/admin tooling). Coach-gated read+write.
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

-- exercise_substitutions: was tenant-only FOR ALL with no role gate and no WITH CHECK, so any
-- authenticated user could tamper with the substitution catalog via PostgREST. The catalog itself is
-- not sensitive, so reads stay open to authenticated; writes are coach-only. (0034 did not cover this.)
drop policy if exists subs_tenant on public.exercise_substitutions;
create policy subs_select on public.exercise_substitutions for select to authenticated
  using (true);
create policy subs_modify on public.exercise_substitutions for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());
