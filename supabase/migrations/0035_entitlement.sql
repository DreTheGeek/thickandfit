-- 0035 PHASE 2 — Access entitlement (pay-to-enter + comped-full model).
-- A subscriber/free user gets app access if they hold an active paid subscription (the `subscriptions`
-- table from 0025) OR an unexpired coach-granted comp. Comp access is a single forward-looking timestamp
-- on the profile: a coach sets it (challenge winners, free clients); access simply expires when it passes.
-- Coaches/operators are entitled by role and are never gated. RLS on profiles already exists.

alter table public.profiles
  add column if not exists comp_access_until timestamptz;

comment on column public.profiles.comp_access_until is
  'Comped access expiry. When set and in the future, grants full app access without a paid subscription '
  '(coach-granted: challenge winners, free clients). NULL or past = no comp. Coaches are entitled by role.';

create index if not exists idx_profiles_comp_access_until
  on public.profiles (comp_access_until)
  where comp_access_until is not null;
