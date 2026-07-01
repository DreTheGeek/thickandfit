-- 0052 PHASE 2 -- Harden physique_analyses RLS (defense-in-depth for future white-label multi-tenancy).
-- The 0051 member branch keyed only on profile_id = auth.uid() with no company_id guard, so a member
-- crafting a raw PostgREST write could forge company_id on their own row (harmless at single-tenant +
-- service-client writes today, but a cross-tenant write vector once white-label ships). This mirrors the
-- sibling progress_photos policy: the member branch now also requires company_id = current_company_id().
-- No data change; just tighter SELECT/INSERT checks. Writes still flow through the service client.

drop policy if exists physique_read on public.physique_analyses;
drop policy if exists physique_insert on public.physique_analyses;

create policy physique_read on public.physique_analyses for select
  using (
    (profile_id = auth.uid() and company_id = public.current_company_id())
    or (company_id = public.current_company_id() and public.is_coach())
  );

create policy physique_insert on public.physique_analyses for insert
  with check (
    (profile_id = auth.uid() and company_id = public.current_company_id())
    or (company_id = public.current_company_id() and public.is_coach())
  );
