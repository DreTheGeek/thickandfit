-- 0027 RLS lockdown round 2. The 0018 lockdown missed several tables that still carried tenant-only
-- (company_id = current_company_id()) policies with no role gate + no WITH CHECK. Single-tenant means
-- every subscriber shares the company_id, so those policies authorized ALL users to read/write each
-- other's data. Found in the main bug hunt. All subscriber + coach reads of these tables go through
-- the service client (BYPASSRLS), so tightening RLS does not affect the app's own reads.

-- A. Owner-or-coach: per-subscriber rows (check-in answers + assignments hold PII: photos, measurements).
drop policy if exists form_responses_tenant on public.form_responses;
create policy form_responses_own on public.form_responses for all to authenticated
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop policy if exists form_assignments_tenant on public.form_assignments;
create policy form_assignments_own on public.form_assignments for all to authenticated
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop policy if exists plan_assignments_tenant on public.plan_assignments;
create policy plan_assignments_own on public.plan_assignments for all to authenticated
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

-- B. Coach-only catalog: program + form builder tables (subscribers reach assigned content via the
--    service client in the player/form pages, verified).
drop policy if exists plans_tenant on public.plans;
create policy plans_coach on public.plans for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists sessions_tenant on public.sessions;
create policy sessions_coach on public.sessions for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists session_exercises_tenant on public.session_exercises;
create policy session_exercises_coach on public.session_exercises for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists forms_tenant on public.forms;
create policy forms_coach on public.forms for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists form_fields_tenant on public.form_fields;
create policy form_fields_coach on public.form_fields for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- C. Operator/coach-only logs (were readable by any authenticated user; hold PII snapshots + costs).
drop policy if exists audit_view_own on public.audit_log;
create policy audit_view_operator on public.audit_log for select to authenticated
  using ((auth.jwt() ->> 'user_role') = 'operator');

drop policy if exists email_send_tenant on public.email_send_log;
create policy email_send_coach on public.email_send_log for select to authenticated
  using (public.is_coach());

drop policy if exists ai_usage_view_own on public.ai_usage_log;
create policy ai_usage_coach on public.ai_usage_log for select to authenticated
  using (public.is_coach());
