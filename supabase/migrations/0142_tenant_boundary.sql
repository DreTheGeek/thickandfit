-- ---------------------------------------------------------------------------------------------
-- 0142: put the tenant boundary on the 21 policies that grant on is_coach() alone.
--
-- THE PROBLEM (found 2026-08-12, written up in .planning/RLS-TENANT-BOUNDARY.md).
-- public.is_coach() (0018) resolves to a role claim and nothing else:
--
--     select coalesce((auth.jwt() ->> 'user_role'), '') in ('coach','assistant_coach','operator');
--
-- There is no company in it. 21 policies granted on that alone, with no company_id predicate
-- anywhere, so a coach in company A could read every profile in company B — and for form_responses,
-- which is FOR ALL with the same WITH CHECK, could read AND WRITE company B's rows. Since the
-- August sweep that table holds members' weight, circumferences, sleep, mood and their "why".
--
-- Every policy in this schema is PERMISSIVE and there is no `force row level security` anywhere, so
-- permissive policies are OR'd: adding a correctly-scoped policy beside a broad one does not narrow
-- it. The broad ones have to be replaced, which is what this does.
--
-- NOT EXPLOITABLE TODAY, because there is one company. It becomes exploitable the day there is a
-- second, which is a direction CLAUDE.md says the architecture supports.
--
-- WHY auth_company_id() AND NOT current_company_id().
-- current_company_id() (0001) reads `auth.jwt() ->> 'company_id'`, a CUSTOM CLAIM that exists only
-- if the Supabase auth hook is configured — it is listed under "Manual / Post-Deploy Steps" in
-- CLAUDE.md, i.e. it is a thing a human has to have done. If that claim is absent the function
-- returns null, `company_id = null` is NULL rather than true, and this migration would have denied
-- every coach read in the product. Locking Stephanie out of her own console to close a hole that
-- needs a second tenant to exist is not a trade worth making.
--
-- auth_company_id() prefers the claim (free, no table read) and falls back to the caller's own
-- profiles row, so it is correct whether or not the hook was ever set up. It can only be null for a
-- caller with no profile, which is not a signed-in coach.
--
-- SECURITY DEFINER is required, not decorative: profiles_select below is a policy ON profiles that
-- calls a function which READS profiles. Running as the owner (which owns the table, and no table
-- here sets FORCE ROW LEVEL SECURITY) is what stops that recursing. search_path is pinned for the
-- usual reason a definer function must pin it.
--
-- WHAT THIS SHOULD CHANGE TODAY: nothing. One company means company_id = auth_company_id() is true
-- for every row a coach can already see. Only the is_coach() branch is narrowed; every
-- `= auth.uid()` branch is copied through untouched, so no member's access to her own data is
-- touched by this migration at all. Verify anyway — see the block at the bottom.
-- ---------------------------------------------------------------------------------------------

create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'company_id', '')::uuid,
    (select p.company_id from public.profiles p where p.id = auth.uid())
  );
$$;

comment on function public.auth_company_id() is
  'The caller''s company. Prefers the JWT custom claim, falls back to their profiles row so it is '
  'correct even when the auth hook that injects the claim was never configured. SECURITY DEFINER '
  'so that policies ON profiles may call it without recursing.';

-- Operator-only, for a table with no tenant column to scope by. See webhook_events below.
create or replace function public.is_operator()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'user_role'), '') = 'operator';
$$;

-- ---------------------------------------------------------------------------------------------
-- The 20 tables that carry company_id. Each policy keeps its exact previous shape — same command,
-- same roles, same self-access branch — with the coach branch scoped to the caller's company.
-- ---------------------------------------------------------------------------------------------

drop policy if exists activity_logs_own on public.activity_logs;
create policy activity_logs_own on public.activity_logs
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists ai_usage_coach on public.ai_usage_log;
create policy ai_usage_coach on public.ai_usage_log for select to authenticated
  using (public.is_coach() and company_id = public.auth_company_id());

drop policy if exists api_usage_coach on public.api_usage_log;
create policy api_usage_coach on public.api_usage_log for select to authenticated
  using (public.is_coach() and company_id = public.auth_company_id());

drop policy if exists challenge_participants_delete on public.challenge_participants;
create policy challenge_participants_delete on public.challenge_participants for delete
  using (profile_id = auth.uid() or (public.is_coach() and company_id = public.auth_company_id()));

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete on public.community_posts for delete
  using (author_profile_id = auth.uid() or (public.is_coach() and company_id = public.auth_company_id()));

drop policy if exists consent_own on public.consent_captures;
create policy consent_own on public.consent_captures
  using      ((public.is_coach() and company_id = public.auth_company_id()) or user_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or user_id = auth.uid());

drop policy if exists email_send_coach on public.email_send_log;
create policy email_send_coach on public.email_send_log for select to authenticated
  using (public.is_coach() and company_id = public.auth_company_id());

drop policy if exists subs_modify on public.exercise_substitutions;
create policy subs_modify on public.exercise_substitutions for all to authenticated
  using      (public.is_coach() and company_id = public.auth_company_id())
  with check (public.is_coach() and company_id = public.auth_company_id());

drop policy if exists form_assignments_own on public.form_assignments;
create policy form_assignments_own on public.form_assignments for all to authenticated
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

-- The worst of the 21: FOR ALL, same predicate on WITH CHECK, and since the August sweep it holds
-- every member's weight, circumferences, sleep, mood and their reason for starting.
drop policy if exists form_responses_own on public.form_responses;
create policy form_responses_own on public.form_responses for all to authenticated
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists notif_pref_own on public.notification_preferences;
create policy notif_pref_own on public.notification_preferences
  using      ((public.is_coach() and company_id = public.auth_company_id()) or user_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or user_id = auth.uid());

drop policy if exists onboarding_own on public.onboarding_responses;
create policy onboarding_own on public.onboarding_responses
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists plan_assignments_own on public.plan_assignments;
create policy plan_assignments_own on public.plan_assignments for all to authenticated
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments for delete
  using (profile_id = auth.uid() or (public.is_coach() and company_id = public.auth_company_id()));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_coach() and company_id = public.auth_company_id()));

-- set_logs carries company_id even though its self-access branch reaches through workout_logs; the
-- coach branch scopes on the column directly rather than joining, which is both cheaper and the
-- same answer.
drop policy if exists set_logs_own on public.set_logs;
create policy set_logs_own on public.set_logs
  using (
    (public.is_coach() and company_id = public.auth_company_id())
    or exists (select 1 from public.workout_logs w where w.id = set_logs.workout_log_id and w.profile_id = auth.uid())
  )
  with check (
    (public.is_coach() and company_id = public.auth_company_id())
    or exists (select 1 from public.workout_logs w where w.id = set_logs.workout_log_id and w.profile_id = auth.uid())
  );

drop policy if exists tracking_goals_own on public.tracking_goals;
create policy tracking_goals_own on public.tracking_goals
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists waitlist_coach_read on public.waitlist_leads;
create policy waitlist_coach_read on public.waitlist_leads for select to authenticated
  using (public.is_coach() and company_id = public.auth_company_id());

drop policy if exists wch_own on public.workout_completion_history;
create policy wch_own on public.workout_completion_history
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

drop policy if exists workout_logs_own on public.workout_logs;
create policy workout_logs_own on public.workout_logs
  using      ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid())
  with check ((public.is_coach() and company_id = public.auth_company_id()) or profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- The 21st. webhook_events is the Stripe idempotency ledger (0025) and has NO company_id to scope
-- by: it is keyed on stripe_event_id and was built for a single Stripe account. Rather than invent
-- a tenant column on an ops ledger, narrow who may read it. A coach has no reason to read raw
-- Stripe event payloads; an operator debugging billing does. This is a tightening, and the only
-- thing in this migration that changes who can see something TODAY.
-- ---------------------------------------------------------------------------------------------
drop policy if exists webhook_events_coach_read on public.webhook_events;
create policy webhook_events_operator_read on public.webhook_events for select
  using (public.is_operator());

-- ---------------------------------------------------------------------------------------------
-- VERIFY AFTER APPLYING. Not optional: this touches the access path for every coach surface that
-- uses a user-scoped client, and "the migration applied cleanly" is not evidence that anyone can
-- still read anything.
--
--   1. As Stephanie (coach role), in the app: open /coach, /coach/clients, /coach/subscribers/[id],
--      /coach/intake. All four must load with data, not empty states.
--   2. As a member: /dashboard, /workouts, /progress, /you. Her own rows must still be hers.
--   3. In SQL, confirm the helper resolves for a real coach rather than returning null:
--        select id, email, company_id from auth.users u
--          join public.profiles p on p.id = u.id where p.role = 'coach';
--      then, signed in as that user via the API, `select public.auth_company_id();` must equal it.
--   4. Re-run the audit that found this:
--        the 21 policies below should now all contain both is_coach() and company_id.
--
-- TO REVERT: the previous definitions are in 0018, 0025, 0026, 0027, 0028, 0034, 0136 and 0139.
-- Reverting restores the hole; prefer fixing forward.
-- ---------------------------------------------------------------------------------------------
