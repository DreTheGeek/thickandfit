-- 0062 SECURITY -- Lock down the two coach match RPCs to the service role only.
-- match_coach_memory (0030) and match_coach_knowledge (0040) are SECURITY DEFINER and trust their
-- p_profile_id / p_company_id args with no in-function auth check. Both were granted to
-- authenticated, so any logged-in member could call them via PostgREST /rpc/ and read another
-- member's coach-chat + food-log content (memory) or pass an arbitrary company id (knowledge).
-- Every legitimate caller is server code on the service client (embeddings.ts, knowledge.ts), so
-- revoking authenticated breaks nothing.
-- INVARIANT: these functions are service-only. If either is ever re-granted to authenticated, an
-- auth.uid() / current_company_id() check MUST be added inside the function body first.
revoke execute on function public.match_coach_memory(uuid, vector, int) from public, anon, authenticated;
revoke execute on function public.match_coach_knowledge(uuid, vector, int) from public, anon, authenticated;
grant execute on function public.match_coach_memory(uuid, vector, int) to service_role;
grant execute on function public.match_coach_knowledge(uuid, vector, int) to service_role;
