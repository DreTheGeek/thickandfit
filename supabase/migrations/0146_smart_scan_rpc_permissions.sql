-- 0146 SMART SCAN: harden hybrid food resolver execute permissions.
--
-- PostgreSQL functions are executable by PUBLIC by default. The original 0145 migration revoked
-- PUBLIC and granted authenticated, but the live project retained an explicit anon grant inherited
-- from the API role setup. Keep the resolver unavailable to anonymous clients while preserving
-- authenticated member access, service jobs, and SECURITY INVOKER RLS behavior.

revoke execute on function public.match_food_candidates(text, vector, integer) from public;
revoke execute on function public.match_food_candidates(text, vector, integer) from anon;

grant execute on function public.match_food_candidates(text, vector, integer) to authenticated;
grant execute on function public.match_food_candidates(text, vector, integer) to service_role;

comment on function public.match_food_candidates(text, vector, integer) is
  'Smart Scan hybrid food retrieval. Authenticated/service-role only. SECURITY INVOKER preserves foods RLS. Fuses exact/FTS/trigram/vector similarity with provenance authority; nutrition values always come from the matched corpus row.';
