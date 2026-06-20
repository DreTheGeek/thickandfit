-- 0018 RLS LOCKDOWN (security, deploy-blocking). This is single-tenant: every user shares
-- Stephanie's company_id, so the original "company_id = current_company_id()" policies let ANY
-- subscriber/free user read all 256 clients' PII + financials via PostgREST, and let any user
-- self-promote their own profile.role to operator. Lock it down:
--   A) profiles: revoke writes to privilege columns (kills role self-promotion)
--   B) CRM PII tables: gate to coach roles (mirror 0016 saved_segments / 0017 pipelines)
--   C) per-user subscriber data: owner-or-coach scope (a user sees only their own; coaches see all)
-- The coach app reads via the service client (BYPASSRLS), so role-gating does not affect it.

-- shared role helper
create or replace function public.is_coach()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'user_role'), '') in ('coach', 'assistant_coach', 'operator');
$$;

-- ---------------------------------------------------------------------------
-- A) profiles: block privilege escalation. Users may edit their own non-privileged
--    columns (name/locale); only the service role can change role/company/legacy flags.
-- ---------------------------------------------------------------------------
revoke update (role, company_id, is_legacy_client, legacy_source, lenus_profile_id)
  on public.profiles from authenticated, anon;

-- ---------------------------------------------------------------------------
-- B) CRM PII -> coach roles only
-- ---------------------------------------------------------------------------
drop policy if exists contacts_tenant on public.contacts;
create policy contacts_tenant on public.contacts
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists subs_tenant on public.client_subscriptions;
create policy subs_tenant on public.client_subscriptions
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists txn_tenant on public.contact_transactions;
create policy txn_tenant on public.contact_transactions
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists contact_tags_tenant on public.contact_tags;
create policy contact_tags_tenant on public.contact_tags
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists tags_tenant on public.tags;
create policy tags_tenant on public.tags
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists snapshot_tenant on public.legacy_client_snapshot;
create policy snapshot_tenant on public.legacy_client_snapshot
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists migration_log_tenant on public.migration_log;
create policy migration_log_tenant on public.migration_log
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------
-- C) per-user subscriber data -> owner or coach
-- ---------------------------------------------------------------------------
drop policy if exists workout_logs_tenant on public.workout_logs;
create policy workout_logs_own on public.workout_logs
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop policy if exists wch_tenant on public.workout_completion_history;
create policy wch_own on public.workout_completion_history
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop policy if exists onboarding_tenant on public.onboarding_responses;
create policy onboarding_own on public.onboarding_responses
  using (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());

drop policy if exists consent_tenant on public.consent_captures;
create policy consent_own on public.consent_captures
  using (public.is_coach() or user_id = auth.uid())
  with check (public.is_coach() or user_id = auth.uid());

drop policy if exists notif_pref_tenant on public.notification_preferences;
create policy notif_pref_own on public.notification_preferences
  using (public.is_coach() or user_id = auth.uid())
  with check (public.is_coach() or user_id = auth.uid());

-- set_logs owns through its parent workout_log
drop policy if exists set_logs_tenant on public.set_logs;
create policy set_logs_own on public.set_logs
  using (
    public.is_coach()
    or exists (select 1 from public.workout_logs w where w.id = set_logs.workout_log_id and w.profile_id = auth.uid())
  )
  with check (
    public.is_coach()
    or exists (select 1 from public.workout_logs w where w.id = set_logs.workout_log_id and w.profile_id = auth.uid())
  );
