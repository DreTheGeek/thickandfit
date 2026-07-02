-- 0056 PHASE 2 -- Coach notes on a meal plan (call 2026-07-01). Stephanie's #1 meal-plan ask: a free
-- notes field for "free"/low-cal add-ins ("feel free to add spinach, onions, or cucumbers if you're
-- not full"). Shown to the client on their meal plan. Lenus could not do this.

alter table public.meal_plans add column if not exists notes text;
