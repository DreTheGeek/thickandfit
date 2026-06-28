-- 0044 PHASE 2 — Tighten the exercise_substitutions read policy (anti-hacker / white-label).
-- subs_select was USING(true): readable by any authenticated user. But the table carries a
-- company_id column, so a company-scoped substitution would be readable cross-tenant. Restrict
-- reads to the shared global library (company_id IS NULL) plus the viewer's own company. The table
-- is empty today, so this is correctness + white-label hardening, not a live data leak fix.
-- Surfaced by launchproof's rls-permissive-policy lens.

drop policy if exists subs_select on public.exercise_substitutions;
create policy subs_select on public.exercise_substitutions for select
  using (company_id is null or company_id = public.current_company_id());
