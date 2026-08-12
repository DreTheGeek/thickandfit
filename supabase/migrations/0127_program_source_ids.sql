-- Idempotency for the Lenus program import.
--
-- The import runs more than once by design: once now, and again after any further sweep before the
-- 31 August cutoff. Without a stable source key the second run duplicates all 40 programs, and
-- names cannot be that key because her library legitimately contains "GYM 8 week SNAP BACK 5 day
-- split GYM-LITE MEMBERSHIP" and "... (2)" as distinct plans.

alter table public.plans add column if not exists lenus_id uuid;
alter table public.sessions add column if not exists lenus_id uuid;

-- Unique per tenant, not globally: the same source id could legitimately appear under a second
-- company if this ever white-labels.
create unique index if not exists idx_plans_lenus_id
  on public.plans (company_id, lenus_id)
  where lenus_id is not null;
create unique index if not exists idx_sessions_lenus_id
  on public.sessions (company_id, lenus_id)
  where lenus_id is not null;

comment on column public.plans.lenus_id is
  'Source id from the Lenus workout plan template. The import upserts on it so re-running cannot duplicate her library.';
