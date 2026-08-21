-- Her home programs come back.
--
-- WHAT HAPPENED. An earlier instruction was "archive all of the 6 and 8 week challenges", and the
-- sweep took the whole Month 1/2/3 progression series with it. Those are not challenges, they are
-- progressive training blocks, and they hold EVERY 5-day home program she has ever written. The
-- result was a library with exactly one @HOME plan, at 3 days, so the starter matcher funnelled
-- every at-home member onto it no matter what she answered about how often she could train.
--
-- All eight were verified before this ran: zero plan_assignments on any of them, so nobody is
-- mid-program and nothing is disturbed by bringing them back. Demo coverage is 82-95% on seven of
-- the eight, meaning a member gets Stephanie's own footage on nearly every movement.
--
-- LEVEL IS DELIBERATELY LEFT NULL on all eight. The gym siblings in this series say BEGINNER or
-- ADVANCED in their names; the @HOME ones say nothing. Inventing a level from a name that does not
-- state one is how an advanced block reaches a beginner. match-starter-shared.ts treats a null level
-- as "she did not say" and costs it slightly more than an exact match, so these are reachable
-- without being preferred over a plan that states her level.
--
-- The 16 archived GYM plans stay archived: the live 12-week series already covers gym at 3, 4 and 5
-- days across both levels, so bringing them back would add choice without adding coverage.

-- ---------------------------------------------------------------- offerable to a new member
update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = 'c3ed518b-5e5b-47a8-b2bd-868f2d2faf35';  -- SNAP BACK 5 day @Home-LITE      42/51 demos
-- Not a duplicate of the row above, despite the near-identical name: that one has a HIIT day, this
-- one has a second upper-body day. The title contradicts itself (HOME ... GYM-LITE) and is hers to
-- rename; it is not a reason to withhold a working program.
update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = 'ddf040f9-2da1-4f83-9af1-c943e6221154';  -- SNAP BACK 5 day (2)             45/51 demos

update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = '3e7f97d5-72b9-4443-980d-ccb7e852cfdb';  -- Month 1: 8 week 5 day @HOME!    52/55 demos
update public.plans set archived_at = null,
  days_per_week = 3, location = 'home', level = null, is_starter_candidate = true
  where id = 'aa033d1e-f423-4142-872d-382ff80061cf';  -- Month 1: 8 week 3 day @HOME     47/50 demos
update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = 'e37ff6a1-332f-4b66-b21e-77c78a17f9d5';  -- Month 1: 6 week 5 day @HOME     40/48 demos
update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = 'f3e715a6-8b7a-4a00-8dd1-460a2aab5fc9';  -- Month 2: 6 week 5 day @HOME     51/58 demos
update public.plans set archived_at = null,
  days_per_week = 5, location = 'home', level = null, is_starter_candidate = true
  where id = 'd0cfb43d-aa51-4c9c-aceb-80dd30a222d1';  -- Month 3: 6 week 5 day @HOME     49/54 demos

-- ------------------------------------------------- back in the library, NOT auto-assignable
-- Unarchived so a coach can find it and assign it by hand, but is_starter_candidate stays FALSE.
--
-- A program written for a pregnant member is a clinical decision, not a scoring decision. Onboarding
-- does capture a pregnancy answer, so a matcher COULD route on it, and that is exactly why this is
-- worth being explicit about: getting it wrong in either direction is bad. Handing this to somebody
-- who is not pregnant is wrong; failing to hand it to somebody who is, because she also answered
-- "5 days" and the scorer preferred a 5-day plan, is worse. Its demo coverage is also the weakest of
-- the eight at 52%, so half its movements would show an icon rather than her footage.
--
-- Thirty seconds of a coach's attention is the right price for this one.
update public.plans set archived_at = null,
  days_per_week = 3, location = 'home', level = null, is_starter_candidate = false
  where id = 'f48b3cf6-674c-4953-9d57-a534cafd89a9';  -- Month 1: 6 week 3 day @HOME PREGNANCY
