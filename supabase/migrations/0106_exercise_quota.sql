-- Pass 2: collapse near-duplicate variants down to a per-bucket cap.
--
-- Pass 1 (0105) removed what is out of scope for this audience. What remains is still 676 rows, and
-- the problem with it is repetition rather than relevance: 90 shoulder movements, 63 chest, 56
-- triceps, 46 bicep curls. A coach assigning work does not browse 46 curls, she picks the one she
-- always picks and the other 45 are noise that makes the app feel like a scraped database.
--
-- Deterministic and reproducible: normalise each name to a movement cluster, take the best equipment
-- variant of each cluster first, then the second of each, until the bucket cap is reached. No
-- hand-picking, so this can be re-run and audited.
--
-- TWO PROTECTIONS ABOVE THE CAP, both learned from dry runs rather than designed up front:
--
--   1. is_core. The 50 movements on .planning/FILMING-SHOT-LIST.md are what Stephanie is about to
--      film. A dry run archived "Barbell Step Ups", which is shot number 8. Archiving something we
--      are about to point a camera at is incoherent, so the shot list outranks the cap.
--
--   2. Glute work. A dry run also archived Bodyweight Walking Lunge, Trap Bar Deadlift and Band
--      Good Morning, all tagged glutes in secondary_muscles. In a glute-focused business the cut
--      order matters: when a bucket is over cap, the non-glute work goes first. This is a sort key
--      rather than an exemption, so the cap still holds.

-- ---------------------------------------------------------------------------------------------
-- 1. Mark the filming shot list as core
-- ---------------------------------------------------------------------------------------------
update public.exercises set is_core = true
where name_en in (
  -- Block 1, legs and glutes
  'Barbell Squat','Bodyweight Squat','Romanian Deadlift','Barbell Deadlift','Barbell Lunge',
  'Barbell Walking Lunge','Split Squats','Barbell Step Ups','Butt Lift (Bridge)','Single Leg Glute Bridge',
  'Glute Kickback','Step-up with Knee Raise','One-Legged Cable Kickback','Stiff-Legged Dumbbell Deadlift',
  'Lying Leg Curls','Seated Leg Curl','Front Barbell Squat',
  -- Block 2, shoulders / chest / triceps
  'Barbell Shoulder Press','Arnold Dumbbell Press','Alternating Deltoid Raise','Face Pull',
  'Dumbbell Bench Press','Barbell Bench Press - Medium Grip','Pushups','Cable Crossover',
  'Triceps Pushdown - Rope Attachment','Bench Dips',
  -- Block 3, back and biceps
  'Bent Over Barbell Row','One-Arm Dumbbell Row','Seated Cable Rows','Wide-Grip Lat Pulldown','Pullups',
  'Dumbbell Bicep Curl','Hammer Curls','Barbell Curl',
  -- Block 4, full body HIIT
  'One-Arm Kettlebell Swings','Freehand Jump Squat','Plyo Push-up','Star Jump','Inchworm',
  -- Block 5, core
  'Plank','Russian Twist','Dead Bug','Hanging Leg Raise',
  -- Block 6, post-workout stretch
  'Child''s Pose','Cat Stretch','Hamstring Stretch','Runner''s Stretch','All Fours Quad Stretch','Upper Back Stretch'
);

-- ---------------------------------------------------------------------------------------------
-- 2. Quota
-- ---------------------------------------------------------------------------------------------
with caps(bucket, cap) as (values
  ('glutes',30),('quadriceps',24),('hamstrings',22),('abdominals',20),('mobility',24),
  ('conditioning',18),('shoulders',18),('chest',14),('lats',12),('middle back',12),
  ('biceps',12),('triceps',12),('lower back',8),('calves',6),('abductors',8),('adductors',8),('traps',2)
),
base as (
  select e.id, e.name_en, e.is_core, e.secondary_muscles,
    -- Conditioning and mobility are their own buckets. Left inside quadriceps, Rocket Jump and Star
    -- Jump crowd out the leg work she actually programs; and post-workout stretch is 231 sessions,
    -- so it earns its own allowance rather than competing with strength work.
    case when e.category in ('plyometrics','cardio') then 'conditioning'
         when e.category = 'stretching' then 'mobility'
         else e.muscle_group end as bucket,
    exists (select 1 from public.set_logs s where s.exercise_id = e.id)
      or exists (select 1 from public.session_exercises se where se.exercise_id = e.id) as in_use,
    case e.equipment when 'dumbbell' then 1 when 'barbell' then 2 when 'bands' then 3
      when 'body only' then 4 when 'cable' then 5 when 'machine' then 6
      when 'kettlebells' then 7 when 'foam roll' then 8 else 9 end as equip_pref,
    case e.difficulty when 'beginner' then 1 when 'intermediate' then 2 else 3 end as diff_pref,
    -- Strip the words that describe HOW a movement is loaded or positioned, leaving the movement.
    -- "Seated Dumbbell Curl" and "Standing Barbell Curl" both normalise to "curl", so the cap keeps
    -- one good version of each movement rather than fourteen versions of one.
    btrim(regexp_replace(lower(e.name_en),
      '\y(alternate|alternating|one-arm|one arm|single-leg|single leg|standing|seated|lying|incline|decline|close-grip|wide-grip|reverse-grip|palms-up|palms-down|barbell|dumbbell|cable|machine|smith|kettlebell|kettlebells|band|bands|weighted|bodyweight|rope|bench|floor|plate|pulley|hang|split|body|with|the|a|to|on|and|of)\y','','g')) as norm
  from public.exercises e
  where e.archived_at is null
),
ranked as (
  select b.*,
    row_number() over (partition by b.bucket, b.norm order by b.equip_pref, b.diff_pref, b.name_en) as cluster_rank
  from base b
),
final as (
  select r.*,
    row_number() over (
      partition by r.bucket
      order by
        r.in_use desc,                                        -- never orphan live work
        r.is_core desc,                                       -- never archive a shot-list movement
        ('glutes' = any(r.secondary_muscles)) desc,           -- cut non-glute work first
        r.cluster_rank, r.equip_pref, r.diff_pref, r.name_en
    ) as rk
  from ranked r
)
update public.exercises e set
  archived_at = now(),
  archive_reason = '2026-08 pass2 variant-collapse'
from final f, caps c
where e.id = f.id and c.bucket = f.bucket and f.rk > c.cap;
