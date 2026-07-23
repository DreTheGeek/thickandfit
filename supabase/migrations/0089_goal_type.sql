-- goal_type: what the member is working toward, as a framing choice separate from the calorie-math
-- `goal` (lose/maintain/gain) already in answers. It decides what the You screen leads with: a
-- weight target, getting stronger, or feeling better / consistency. Null means "derive a sensible
-- default" (see src/lib/goals/goal-type.ts), so existing members need no backfill. A member with a
-- difficult-relationship-with-food screen is never defaulted to lose_weight.
alter table public.onboarding_responses
  add column if not exists goal_type text
  check (goal_type is null or goal_type in ('lose_weight', 'build_strength', 'feel_better'));
