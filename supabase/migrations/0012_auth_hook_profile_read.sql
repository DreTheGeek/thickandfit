-- 0012: let the Supabase auth hook read profiles during token issuance.
--
-- custom_access_token_hook (SECURITY INVOKER, executed as supabase_auth_admin) reads
-- public.profiles to inject company_id + user_role into the JWT. RLS on profiles
-- (profile_tenant: company_id = current_company_id()) blocked that read, because at
-- token-issuance time the JWT does not yet carry company_id -> current_company_id()
-- returns null -> the policy matches no rows -> the hook found no profile -> the claim
-- was never set. With no company_id in the JWT, every authenticated profile read then
-- returned empty, resolveAuth() returned null, and EVERY login bounced to /auth/sign-in.
--
-- This permissive SELECT policy scoped to the internal supabase_auth_admin role breaks
-- the cycle. supabase_auth_admin only runs during token issuance and is never a
-- user-facing session role, so this does not widen tenant data access for end users.

grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

drop policy if exists profiles_auth_admin_read on public.profiles;
create policy profiles_auth_admin_read on public.profiles
  as permissive for select to supabase_auth_admin
  using (true);
