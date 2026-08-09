-- Five fields the coach's client record shows in the tool Stephanie is migrating off, and that we
-- had nowhere to put.
--
-- Everything else on that screen we already captured and simply never rendered (allergies,
-- medications, PCOS, sleep, stress, pregnancy, PAR-Q, eating-disorder screening). These five are the
-- genuine gaps.
--
-- All nullable with no default: a column that invents a value is worse than an empty one, because
-- the coach cannot tell a real answer from a placeholder. Every read path already handles null.

alter table public.client_intake
  -- Total daily energy expenditure. We store bmr and activity_level and then recompute tdee in at
  -- least two places at read time, which is how two screens end up disagreeing about her calories.
  add column if not exists tdee integer,

  -- Physical activity level, the multiplier tdee is derived from (bmr * pal). Kept alongside tdee
  -- rather than inferred back out of it, because activity_level is a bucket and pal is the number.
  add column if not exists pal numeric(3, 2),

  -- Her reason, in her words. Not a goal slug: "to be the best version of myself" is not
  -- lose_weight, and the sentence is what a coach actually opens a check-in with.
  add column if not exists client_why text,

  -- How many days a week she can train. We write her a program and have never asked this.
  add column if not exists sessions_per_week smallint,

  -- What she actually has to train with. "home" is either a garage rack or a yoga mat, and a glute
  -- program is either possible or it is not. Slugs, validated in the app layer against
  -- src/lib/health-profile/labels.ts, so adding a kind does not need a migration.
  add column if not exists equipment text[];

comment on column public.client_intake.tdee is 'Total daily energy expenditure, kcal. bmr * pal.';
comment on column public.client_intake.pal is 'Physical activity level multiplier, e.g. 1.54.';
comment on column public.client_intake.client_why is 'Her reason in her own words, shown at the top of her record.';
comment on column public.client_intake.sessions_per_week is 'Days per week she can realistically train.';
comment on column public.client_intake.equipment is 'Equipment slugs she has access to.';

-- Sanity bounds. Loose on purpose: these reject data-entry accidents (a pal of 154, a tdee in
-- joules) without asserting a clinical opinion about any individual body.
alter table public.client_intake
  drop constraint if exists client_intake_tdee_ck,
  add constraint client_intake_tdee_ck check (tdee is null or (tdee between 800 and 8000));

alter table public.client_intake
  drop constraint if exists client_intake_pal_ck,
  add constraint client_intake_pal_ck check (pal is null or (pal between 1.0 and 2.5));

alter table public.client_intake
  drop constraint if exists client_intake_sessions_ck,
  add constraint client_intake_sessions_ck check (sessions_per_week is null or (sessions_per_week between 0 and 14));

-- Backfill, and the important part is how LITTLE of it is possible.
--
-- `activity_level` looks like the source for a multiplier and is not. On this database 188 of 267
-- rows are null and the rest are free prose carried over from the Lenus intake question, e.g.
-- "I've been a weight lifter since 1995 ... currently a firefighter which is a lot of lifting and
-- pulling while wearing roughly 80-100 lbs of gear". That is genuinely useful for a coach to READ,
-- and useless as a number. A first pass at this migration mapped it through a slug CASE and
-- correctly set zero rows; deriving a multiplier from that text would have invented numbers for 79
-- clients.
--
-- The real slug lives in onboarding_responses.answers->>'activity' and only exists for members who
-- completed OUR wizard. Migrated Lenus clients never answered it, so their tdee stays null until
-- someone asks them. Null is the honest answer; a fabricated TDEE silently becomes a calorie target.
--
-- Multipliers match ACTIVITY_FACTOR in src/lib/onboarding/prediction.ts, so a backfilled row and a
-- freshly computed one agree.
update public.client_intake ci
set pal = case orr.answers ->> 'activity'
      when 'sedentary' then 1.20
      when 'light' then 1.375
      when 'moderate' then 1.55
      when 'active' then 1.725
      when 'very_active' then 1.90
    end
from public.onboarding_responses orr
where ci.pal is null
  and orr.profile_id = ci.profile_id
  and ci.profile_id is not null
  and orr.answers ->> 'activity' in ('sedentary', 'light', 'moderate', 'active', 'very_active');

update public.client_intake
set tdee = round(bmr * pal)
where tdee is null
  and bmr is not null
  and pal is not null
  and round(bmr * pal) between 800 and 8000;
