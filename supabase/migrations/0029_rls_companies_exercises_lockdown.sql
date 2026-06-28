-- 0029 RLS hardening (round 4). The 0028 pass hunted the single-tenant trap on sensitive tables but
-- missed the two most dangerous ALL/{public} policies still in place: companies and exercises.
-- In this single-tenant app every user's JWT company_id equals the one company row, so an ALL policy
-- gated only on `id/company_id = current_company_id()` is TRUE for every authenticated user.
--
-- Verified live on prod: subscriber sample.sam (anon-key session) successfully UPDATEd the companies
-- row via PostgREST. Because the policy is FOR ALL and `authenticated` holds the DELETE grant, the
-- same session could DELETE the companies row -- and 40+ child tables reference companies ON DELETE
-- CASCADE, so a single request would wipe the entire tenant (contacts, opportunities, profiles,
-- exercises, recipes, everything). This is the launch-blocking fix.
--
-- The app only ever READS companies/exercises through these roles (all writes go through the service
-- client, which is BYPASSRLS), so tightening writes does not break the app. Idempotent.

-- companies: split the ALL policy into authenticated SELECT-only + operator-only UPDATE. No INSERT or
-- DELETE policy for authenticated -> tenant creation/teardown is service-role only. Closes the wipe.
drop policy if exists company_isolation on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (id = public.current_company_id());
create policy companies_operator_update on public.companies for update to authenticated
  using (id = public.current_company_id() and (auth.jwt() ->> 'user_role') = 'operator')
  with check (id = public.current_company_id() and (auth.jwt() ->> 'user_role') = 'operator');

-- exercises: exercises_company_write was FOR ALL to {public} with `company_id = current_company_id()`
-- and NO is_coach() gate, so any authenticated user could INSERT company-scoped exercises (which then
-- surface to the whole tenant via exercises_read) and modify/delete them. Match foods_company_write:
-- coach-only writes. Reads (exercises_read: global seed OR own company) are unchanged.
drop policy if exists exercises_company_write on public.exercises;
create policy exercises_company_write on public.exercises for all to authenticated
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
