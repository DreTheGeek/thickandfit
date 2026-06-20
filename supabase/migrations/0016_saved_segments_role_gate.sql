-- 0016 Role-gate saved_segments. The custom_access_token_hook (0012) puts company_id + user_role
-- in every authenticated JWT, and this is single-tenant, so a tenant-only policy let any
-- subscriber/free user read or write the coach's smart lists via PostgREST. Restrict to coach
-- roles and add an explicit WITH CHECK so writes are gated too.
drop policy if exists saved_segments_tenant on public.saved_segments;
create policy saved_segments_tenant on public.saved_segments
  using (
    company_id = public.current_company_id()
    and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator')
  )
  with check (
    company_id = public.current_company_id()
    and (auth.jwt() ->> 'user_role') in ('coach', 'assistant_coach', 'operator')
  );
