-- Pin search_path on the auth token hook. custom_access_token_hook (0004) runs as supabase_auth_admin
-- on every token issuance and was the one SECURITY-adjacent function without a fixed search_path. It
-- already fully-qualifies public.profiles, so this is defense-in-depth: it removes any dependence on
-- the caller's search_path. Body is untouched; ALTER FUNCTION only sets the config.
alter function public.custom_access_token_hook(jsonb) set search_path = public;
