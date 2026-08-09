-- Stephanie's exercise library: 371 movements she authored in Lenus, with her own filmed demos
-- and her own written cues.
--
-- WHAT WAS HERE BEFORE. 899 rows of yuhonas/free-exercise-db, bulk-imported 2026-06-18 and curated
-- down to 250 active by 0105/0106. Two of those 899 carry a video and none of them are hers. The
-- generic catalog was always a placeholder for this: the real library is the one she filmed.
--
-- SOURCE. .capture/lenus-exercises.json, 371 records, 370 with her own video and
-- 369 with her own coaching notes. Generated, not hand-typed. Nothing here is invented: every
-- name, cue and media key is a verbatim read of her export.
--
-- THE FOUR DUPLICATES. Her export names four movements twice, each pair filmed twice:
--   DB bent over rows (dropped take: d50445c1-2eab-4120-9f6d-5c4f67e70e10_gen.mp4)
--   machine rear delt flys (dropped take: 7fb045f8-e5f7-4b16-aeef-ecf1233dc1ed_gen.mp4)
--   Reverse hack squats (dropped take: 9cb3780f-b070-402e-8ef3-875b997b62ed_gen.mp4)
--   Smith machine reverse lunges (dropped take: 57dea7d2-d232-4bde-8a5f-4ee856cfb459_gen.mp4)
-- Collapsed to one row each, keeping the LONGEST note and, on a tie, the lexicographically first
-- media key so the pick is reproducible. "DB bent over rows" is a true tie: both notes are byte
-- identical, so only the take differs. The dropped keys are listed above rather than deleted
-- silently: the second take is still in Lenus if the first one is bad.
--
-- WHAT IS NOT TOUCHED.
--   * Nothing is deleted. set_logs cascades onto exercises, so a DELETE here destroys member workout
--     history; 0105 installed a trigger that makes that structural. Generic rows she does not use
--     stay archived exactly as 0105 and 0106 left them.
--   * name_es and cues_es are never written. Her notes are English, and overwriting a Spanish name
--     with English would undo 0109/0110. Her new rows ship with name_es NULL, which every read path
--     already falls back from (`name_es || name_en`). Translating them is follow-up work.
--   * is_own_demo stays false. supabase/functions/mux-webhook sets that flag when a Mux playback id
--     lands, so it means "playable demo", not "she filmed it". Flipping it here would claim a video
--     the player cannot fetch. lenus_video_key is what records that the footage exists.
--
-- IDEMPOTENT. Matching is on the normalised name, so a second run finds the rows the first run
-- inserted and rewrites them to the same values. Proven by running it twice against production.

-- ---------------------------------------------------------------------------------------------
-- 1. Provenance
-- ---------------------------------------------------------------------------------------------
alter table public.exercises
  add column if not exists is_coach_authored boolean not null default false,
  add column if not exists lenus_video_key   text;

comment on column public.exercises.is_coach_authored is
  'Stephanie wrote this row: the name and the cues are hers, not the imported open-source taxonomy. A future curation pass must sort these last, the way 0106 sorts is_core last, or it will archive her own library under a bucket cap.';
comment on column public.exercises.lenus_video_key is
  'Object key of her filmed demo in Lenus (<uuid>_gen.mp4). The footage is not in Mux yet; this is the handle the migration to Mux will fetch by. Not a playback id: never pass it to the player.';

create index if not exists idx_exercises_coach_authored
  on public.exercises (name_en) where is_coach_authored and archived_at is null;

-- ---------------------------------------------------------------------------------------------
-- 2. Upsert her 367 movements
-- ---------------------------------------------------------------------------------------------
-- One statement so the UPDATE and the INSERT read the same snapshot and cannot both claim a name.
with src (name_en, lenus_video_key, cues_en) as (values
  ('Airbike', '975ff221-7241-49fb-a722-a3054f1030cc_gen.mp4', 'Set Up for Success: Adjust the seat height so your legs have a slight bend at the bottom of the pedal stroke, your knees shouldn''t lock out or feel cramped.

Foot Placement: Ball of the foot should be centered on the pedal for better power transfer. Straps optional for sprint sets.

Push, Pull, Pedal: The AirBike is a full-body machine, use both your arms and legs. Drive with your legs while pushing and pulling with your arms to maximize output.

Stay Upright & Core Tight: Keep a tall posture, brace your core, and avoid leaning too far forward or collapsing at the shoulders.

Control Your Breathing: Inhale through your nose, exhale through your mouth, especially important during intervals. Efficient breathing helps manage your heart rate.'),
  ('Alt Bicep Curls', '4135fdba-94f4-4473-bea8-0590857b77cd_gen.mp4', 'Keep elbows locked to your sides, no swinging or rocking

Supinate as you curl (palm turns up on the way up)

Alternate arms while keeping the non-working arm engaged

Control the negative, slow and steady on the way down

Exhale as you curl, inhale on the descent

Quality over ego, drop the weight if form breaks'),
  ('Alt DB hammer curls', '0f39e72c-5ac3-4241-a95a-f526c566be56_gen.mp4', 'Start Neutral: Stand tall with dumbbells at your sides, palms facing in (neutral grip). Keep feet shoulder-width apart and core braced.

One Arm at a Time: Curl one dumbbell up while keeping the opposite arm down. Focus on isolating each side and reducing momentum.

No Twist: Maintain the neutral grip throughout the entire rep, don''t supinate or rotate the wrist.

Elbow Locked In: Elbow stays pinned to your side. Don''t let it drift forward, this keeps the tension in the bicep and brachialis.

Squeeze & Pause: At the top, pause for a second and squeeze the working arm before lowering with control.

Alternate Smoothly: As one arm lowers, the other begins its curl. Keep your tempo controlled and deliberate, no swinging or rocking.'),
  ('Alt DB reverse lunges', '178f60d8-e20b-477d-ada1-58b357fbcc6a_gen.mp4', 'Hold dumbbells by your sides, chest tall, core braced

Step back with control, back knee drops toward the floor

Front knee stays stacked over the ankle (not past the toes)

Push through the front heel to return to standing

Alternate legs each rep, keep your tempo steady

Don''t rush, aim for clean, controlled reps over speed

Keep your torso upright, avoid leaning forward'),
  ('Alt DB Row Into Double Hand Row', '024d7c34-95c0-4467-ad3b-4fe9aa00bf07_gen.mp4', 'Muscles Worked: Lats, rhomboids, traps, rear delts, biceps, core

Hinge at the hips, back flat, core braced, maintain that position throughout

Start with alternating single-arm rows, drive elbow back, keep it close to your side

Squeeze your lat at the top, control the lower, no twisting or shifting

After alternating, row both dumbbells at the same time (double hand row)

Focus on pulling elbows toward your hips, not up toward your shoulders

Keep your neck neutral and spine aligned, no rounding or jerking

Control the tempo and keep constant tension on the lats'),
  ('Alt DB V-Ups', '27b8a664-11dc-4b32-8f10-a8174396ca46_gen.mp4', 'Start lying flat, arms extended overhead with a DB in each hand

Engage your core to lift one leg and both DBs toward each other

Reach both DBs toward the raised leg, keep arms and leg as straight as possible

Return under control and alternate legs each rep

Avoid swinging, use your core to initiate the movement

Keep your low back pressed into the floor at the start of each rep

Exhale at the top, inhale on the way down

Option to slightly bend the knee if hamstring flexibility limits range'),
  ('Alt hammer curls to bicep curl', '57b9e81a-576f-41c7-9c58-7fca0a877a17_gen.mp4', 'Stand tall, core braced, dumbbells at your sides

Start with alternating hammer curls, palms face in, elbows tight to the body

After completing reps on both arms, transition into traditional bicep curls, palms up, full supination

Focus on control and squeeze at the top of each rep

No swinging, elbows stay glued to your sides throughout

Control the eccentric (lowering phase) to maximize time under tension'),
  ('Alt Heel taps', 'c5d2cb5a-35e0-4e60-b006-0a7b8a17a186_gen.mp4', 'Lie on your back, knees bent, feet flat, arms at your sides

Crunch up slightly, shoulder blades off the floor, core tight

Reach side to side, tapping the outside of each heel

Keep your neck relaxed, chin off your chest

Engage your core the entire time, avoid dropping your shoulders

Breathe steadily, don''t hold your breath

Focus on small, controlled side bends, not big torso twists'),
  ('Alt KB Gorilla Rows', '1b46db51-0e95-48b6-894a-350149027a73_gen.mp4', 'Start in a sumo stance, feet wider than shoulder-width, toes slightly turned out

Hinge at the hips, push your hips back, keep back flat and chest proud

Core braced, maintain a strong, low position throughout

Row one kettlebell at a time, drive elbow back, squeeze your lat

Keep the opposite arm extended and kettlebell grounded

Avoid torso rotation, hips and shoulders stay square

Control each rep, no jerking or using momentum

Exhale as you pull, inhale on the way down'),
  ('Alt Scissor kicks', 'de045c1b-c31b-4621-9867-f8380f5c9d7d_gen.mp4', 'Lie flat on your back, hands under your glutes for support

Legs stay straight, lift one leg up toward 90°, the other hovers just above the floor

Quickly alternate legs in a scissoring motion, big kicks, fast tempo, full range

Core stays tight, lower back pressed into the mat at all times

Keep your head and shoulders lifted for added tension (optional)

No pausing at the top, keep the rhythm smooth and snappy

Breathe continuously, exhale with each switch'),
  ('Arm circles (forward & backwards)', '21401fa4-7323-4f60-854c-f65b85fcb6a9_gen.mp4', 'Stand tall with arms extended straight out to the sides at shoulder height.
Keep your arms straight, core braced, and shoulders relaxed (not shrugged)'),
  ('Around The World', '08832b25-6ae2-4c48-b369-9b76719834e3_gen.mp4', 'Stand tall, feet shoulder-width apart, core braced

Start with dumbbells in front of your thighs, palms facing up

With a slight bend in the elbows, raise the DBs outward and upward in a wide arc

Meet overhead without clashing the dumbbells, then reverse the motion back down

Think of drawing a big circle, control the movement the entire way

Keep chest proud and shoulders down, no shrugging or swinging'),
  ('Assisted machine dips', 'c9f5e95c-9a4b-4dd8-b94a-81c4ad3039bb_gen.mp4', 'Select an assistance weight that allows you to maintain proper form throughout the set.
Step onto the platform carefully and place your knees on the assistance pad.
Grip the handles firmly and support your body with your arms fully extended at the top.
Keep your chest slightly lifted with a slight forward lean.
Lower your body by bending your elbows until your upper arms reach about parallel to the floor or your mobility allows.
Keep your elbows tracking slightly behind you throughout the movement.
Press through your palms to extend your elbows and return to the starting position.
Squeeze your triceps hard at the top of each rep.
Avoid shrugging your shoulders, swinging your body, or dropping too quickly into the bottom position.
Keep your core engaged and maintain control from start to finish.
Think: "Lower with control, then drive yourself up by pushing through your triceps."'),
  ('Australian pull ups', 'e4680294-ef2d-4af0-8b05-bc72162cab68_gen.mp4', 'Set the Bar Low: Use a Smith machine, squat rack, or stable barbell set around waist height. Bar should be secure and won''t roll or move.

Get Under It: Position your body underneath the bar, arms fully extended, chest lined up directly under the bar. Heels on the ground, legs extended.

Rigid Body = More Gains: Keep your body straight, head, shoulders, hips, and heels in one line. Core tight, glutes engaged, legs locked out.

Grab Shoulder-Width: Use an overhand grip (palms facing away) or neutral if the bar allows. Wrists straight, elbows tracking back, not flaring out.

Row to Mid-Chest: Pull your chest to the bar, not your neck or chin. Squeeze your shoulder blades together at the top.

Pause, Then Lower Slow: Hold the top for a beat, then lower with control. Don''t let your hips drop or back arch.

Modify Angle to Scale:

Easier: Keep knees bent or set the bar higher (less bodyweight load).

Harder: Elevate your feet or slow the tempo for more time under tension.'),
  ('B Stance DB RDLs (single DB)', '3b64ec2a-3235-4e9a-ae67-c734c7ccec14_gen.mp4', 'Stand with feet about hip-width apart

Shift one foot slightly back and onto the toes, this is your kickstand foot (about 6-12 inches behind the front foot)

Hold a dumbbell in each hand, arms extended in front of your thighs

Keep a soft bend in both knees, but most of your weight should be in the front leg

Hinge at the hips, lowering the dumbbells along the front leg while keeping your back flat and core braced

You should feel the stretch primarily in the hamstring and glute of the front leg

Squeeze your glute to return to standing, don''t push off the back foot

Control the tempo and keep dumbbells close to your legs throughout

Complete all reps on one side before switching legs'),
  ('B-stance hipthrust', '0971e76c-1b4a-447d-a39c-4ed7dddea742_gen.mp4', 'Sit on the floor with your upper back against a bench, barbell or dumbbell over your hips (or bodyweight for beginners).

Plant your working leg flat, knee bent.

Slightly stagger the non-working foot, heel lifted, toe down, and positioned about 6-12 inches forward.

Execution:

Drive through the heel of your working leg to lift your hips toward the ceiling.

Squeeze the glutes hard at the top, ensuring hips stay square.

Lower hips under control and repeat for reps before switching sides.

Coaching Cues:

"The closer foot does the work, the other is just there for balance."

"Tuck your chin and keep ribs down to avoid arching your back."

"Squeeze your glute like you''re trying to crack a walnut at the top."

"Control the descent, no bouncing.'),
  ('Band asst chin ups', 'b786bcdb-2e7d-49f1-ae60-d179706dd6d3_gen.mp4', 'Anchor a pull-up band securely around a barbell set high on a squat rack
Step both feet onto the band, stand tall and grip the bar with palms facing you (chin-up grip)

Start in a full hang with feet relaxed in the band, core braced

Pull yourself up by driving elbows down and back, engaging your lats and biceps

Chin clears the bar, no shrugging or flaring elbows

Lower yourself slowly under control, maintain tension

Keep your body stable, no swinging or kicking'),
  ('Band asst pull ups', 'dd76e084-c62a-44f8-876c-87677bd4d660_gen.mp4', 'Loop a pull-up band securely over the bar and step both feet onto the band

Grip the bar with palms facing away from you (overhand grip), slightly wider than shoulder-width

Start from a full hang, arms extended, core tight, feet relaxed in the band

Pull your chest up toward the bar by driving elbows down and slightly in

Keep your neck neutral and shoulders pulled down and away from ears

Chin should clear the bar at the top, then lower with control, no dropping

Avoid using momentum, stay tight through your core and legs'),
  ('Band pull aparts', 'df3eede6-3b48-42ac-9389-d47282e1b6be_gen.mp4', 'Keep your arms straight and band at chest height.
Start with your hands shoulder-width apart, palms facing down or slightly turned out.
Pull the band apart by squeezing your shoulder blades together, not by shrugging your traps.
Keep your core braced and avoid arching your lower back.
Maintain tension in the band throughout the entire movement.'),
  ('Band Shoulder Dislocates', '1f4d1b16-3e63-4df1-aebe-b086aa95c326_gen.mp4', 'Hold a long resistance band (or stick) with a wide overhand grip, arms extended in front of you
Keep your arms straight as you raise them overhead and behind your body, then return to the front.
Keep your core engaged and avoid arching your back.
Adjust grip width based on flexibility, wider is easier, closer is harder.
You should feel a deep stretch through the shoulders and chest, not pain.'),
  ('Band windshield wipers', 'dfc621db-d7e1-44d1-9edf-1be7ffc7647b_gen.mp4', 'While keeping your elbow bent at 90 degrees and pinned at your side, rotate your arm back and forth in a controlled "windshield wiper" motion
Focus on external rotation, don''t let the band yank you back too fast
Keep your wrist neutral and avoid arching your back
Move with control both directions, this is about activation, not speed'),
  ('Banded alt step outs', 'c96652e3-8397-4cbe-b2ca-5313429396ea_gen.mp4', 'Place a cloth resistance band just above the knees

Start in a shallow squat stance, feet hip-width, knees bent, core braced

Step one foot out to the side, keeping tension on the band

Bring the other foot back to center, then repeat on the opposite side

Stay low in the squat the entire time, don''t stand up between steps

Keep knees pressed outward, don''t let the band pull them in

Lead with your heel, not your toe, to better activate glutes

Move with control, no bouncing or rushing'),
  ('Banded Bilateral Shoulder ER', '0fabdc3a-8ab4-4fc7-9e03-eb1512d05ca2_gen.mp4', 'Hold a resistance band with both hands, palms facing up, elbows bent at 90° and tucked tight to your sides.
Stand tall with your core engaged and shoulders down & back.
Pull the band apart by rotating your forearms outward, keeping elbows glued to your ribs.
Pause briefly at end range, then slowly return to the start, maintain tension.
Focus on control, avoid jerking or pulling with your hands only.
Keep your neck relaxed and upper traps out of the movement.'),
  ('Banded Bodyweight Squats', 'c1d032e1-de47-456f-98f2-aca9944886b8_gen.mp4', 'Use a cloth resistance band placed around your thighs

The lower the band sits (closer to the knees or below), the more glute tension = harder

Stand feet shoulder-width apart, toes slightly turned out

Keep chest tall, core braced, and knees tracking over toes

As you squat down, drive knees outward against the band to activate glutes

Lower until thighs are parallel (or lower if mobility allows), weight stays in heels

Press through your heels to return to standing without letting knees cave in'),
  ('banded donkey kicks', 'a2c503e8-3d35-4ea4-a896-1dc104833256_gen.mp4', 'Loop a mini band around your thighs

Start in an all-fours position, wrists under shoulders, knees under hips

Core tight, hips square, no arching or rotating

Flex your foot and kick the working leg straight back and slightly up

Squeeze the glute hard at the top, then return with control, don''t let the knee touch the ground

Keep tension in the band the entire time, no slack

Avoid opening the hip or twisting the torso

Exhale as you kick up, inhale as you return'),
  ('Banded fire hydrant to donkey kick variation', '6b095516-808e-49ed-82ca-1bded152d0de_gen.mp4', 'Set Up Right: Place a mini band just above your knees. Start in a tabletop position, wrists under shoulders, knees under hips, core tight, neutral spine.

Fire Hydrant First: Lift one knee out to the side, keeping it bent at 90°. Don''t twist the hips, movement comes from the glute, not momentum.

Control the Return: Lower your leg back to the start position without letting the band snap it down.

Flow into Donkey Kick: From the tabletop, kick that same leg straight back and up, keeping your knee bent. Foot should drive toward the ceiling.

Squeeze at the Top: Pause and squeeze your glute at the peak of the donkey kick before lowering with control.

Core Stays Locked: No arching or dipping in the lower back, engage your abs to stabilize your hips.

Minimize Weight Shift: Try not to lean into the opposite hip or shoulder. Keep your weight evenly distributed.

Repeat Smoothly: One full rep = fire hydrant + donkey kick. Complete all reps on one side before switching.'),
  ('Banded fire hydrants', '82fbefec-5af1-4dd0-9e1a-102f0465f168_gen.mp4', 'Use a cloth resistance band placed just above the knees

Start on all fours, shoulders stacked over wrists, hips over knees

Keep your core braced and hips square to the floor

Lift one leg out to the side, maintaining a 90° bend in the knee, don''t twist or lean

Pause at the top for a strong glute squeeze, then return with control

Keep constant tension on the band, no resting at the bottom'),
  ('Banded glutebridge', '33ead7b2-e060-4eea-978b-98f36de46c5b_gen.mp4', 'Place a cloth resistance band just above your knees

Lie on your back, knees bent, feet flat on the floor hip-width apart

Keep arms by your sides, palms down for support

Press knees outward into the band to activate glutes and prevent caving

Drive through your heels to lift your hips toward the ceiling

At the top, squeeze your glutes and pause briefly, avoid over-arching the lower back

Lower slowly with control, don''t let your hips hit the ground fully

Maintain constant tension on the band throughout the entire set'),
  ('Banded good morning to squat', 'ef96eba8-dd89-4840-99dd-ec769c90ab79_gen.mp4', 'Place a cloth band just above the knees

Stand with feet shoulder-width apart, core braced, slight bend in the knees

Begin with a hip hinge, push hips back into a good morning, keeping back flat and chest up

Feel the stretch in your hamstrings, then return to standing fully

From the standing position, drop into a controlled squat, drive knees outward into the band

Push through your heels to stand tall and finish the rep

Keep tension on the band throughout, don''t let the knees cave in

Control each phase, good morning → stand → squat → stand = 1 rep'),
  ('Banded good mornings', 'b73c63a2-44bc-4ef9-9d24-65fa2b38c2ec_gen.mp4', 'Place a cloth resistance band just above your knees

Stand with feet hip- to shoulder-width apart, slight bend in the knees

Keep core braced, chest up, and back flat

Hinge at the hips, push your hips back while maintaining band tension

You should feel a deep stretch in the hamstrings at the bottom

Drive through your heels to return to standing and squeeze the glutes at the top

Keep knees pressing slightly outward into the band to activate the glutes'),
  ('Banded lateral steps', 'a8e1898b-09b3-49b1-a236-058cd9af7c96_gen.mp4', 'Place a cloth resistance band just above the knees (for moderate resistance)

Lower on the legs = more tension, more glute activation

Stand in an athletic stance, feet hip-width apart, knees slightly bent, core engaged

Keep your chest up and back flat

Step laterally (side to side) while maintaining constant tension on the band

Feet should not come closer than hip-width, don''t let the band slack

Lead with the heel, not the toe, to better engage the glutes

Control your pace, avoid bouncing or rushing'),
  ('Banded Lateral to Inward Hip Rotations', '61e23c7d-f165-4765-ae40-9013e619f074_gen.mp4', 'Place a short resistance band securely around the arches/laces of both feet.
Stand tall with feet shoulder-width apart and core engaged.
Shift weight onto one leg, keeping a soft bend in the standing knee.
Extend the opposite leg laterally, then sweep it across your body with internal hip rotation, tapping the toe.
Focus on keeping the band under control, don''t let it snap back.
Keep your torso upright and hips square throughout the movement.'),
  ('Banded Pulse Squats', '01c4f8bf-aa02-4dd6-a719-b5e464cf31bb_gen.mp4', 'Band Placement: Loop a mini resistance band just above your knees. Keep tension in the band throughout the movement, don''t let your knees cave.

Feet Shoulder-Width Apart: Toes slightly turned out. Drive your knees out into the band as you lower to keep glutes activated.

Stay in the Bottom Half: Drop into a squat and pulse, small up-and-down movements at the bottom ⅓ of the squat. No full lockout.

Constant Tension = Glute Fire: The band forces your outer glutes (glute medius) to stay active while the pulses hit your quads and glute max.

Core Braced, Chest Up: Don''t fold forward. Keep your spine neutral, core tight, and torso tall as you pulse.

Controlled Movement: No bouncing or rushing. Each pulse should feel intentional, like you''re fighting to stay low and in control.'),
  ('Banded rows', 'c6c9ce27-80a2-4283-9fda-bc54785b340d_gen.mp4', 'Set Your Stance: Stand on the band with feet hip-width apart. Grab the handles or ends of the band with a firm overhand grip.

Hinge, Don''t Squat: Push your hips back to get into a bent-over position, flat back, soft knees, chest over thighs. Think RDL position.

Neutral Spine: Keep your neck in line with your spine. Don''t crank your head up, gaze at the floor a few feet in front of you.

Row With Control: Pull the band toward your lower ribs or belly button, keeping elbows close to your body.

Squeeze at the Top: Pinch your shoulder blades together at the top of the row, pause for a second to feel it.'),
  ('Banded shoulder press', 'e2c8e859-9eb9-4852-8ac2-2b80168da5d8_gen.mp4', 'Stand on the band with feet shoulder-width apart and grab the other end of the band with both hands at shoulder height (palms facing forward).
Brace your core and press the band straight up overhead until your arms are fully extended.
Keep your ribs tucked and avoid arching your back during the press.
Adjust resistance by widening your stance or shortening the band length.'),
  ('Banded split squats', 'd2e5bc1f-2d18-4531-a0ce-dfc4096495de_gen.mp4', 'Place a cloth resistance band just above your knees

Get into a split stance, one foot forward, the other back on the toes

Keep chest lifted, core tight, and hips squared forward

As you lower, drive the front knee outward against the band to keep glute engagement

Back knee drops straight down, aim for 90° angles in both legs

Push through the front heel to return to standing, avoid shifting weight forward

Maintain band tension the entire time, no knee collapse'),
  ('Banded squat hold', 'd3d6a7d8-5fc6-4ac3-82c4-43252097587c_gen.mp4', 'Place a cloth resistance band just above your knees

Stand with feet shoulder-width apart, toes slightly turned out

Lower into a squat, thighs parallel to the ground or slightly above

Keep chest lifted, back flat, and core braced

Drive knees outward into the band to activate glutes and prevent collapse

Hold the position, no bouncing, no shifting

Focus on constant tension in your legs and glutes'),
  ('Banded squats', 'b6dd4ca3-18fc-487d-934a-35be6c0573db_gen.mp4', 'Place a cloth band just above the knees

Stand with feet shoulder-width apart, toes slightly turned out

Brace your core, chest up, back flat

As you lower, drive your knees outward into the band, don''t let them cave in

Squat down until thighs are at least parallel to the floor (or deeper if mobility allows)

Keep your weight in your heels, not your toes

Push through your heels to stand, squeeze your glutes at the top

Control each rep, smooth on the way down, powerful on the way up'),
  ('Barbell Back Squats', '6ffaabe2-26c4-4e17-adcd-57ecfedfe2bb_gen.mp4', 'Bar Placement: Rest the barbell across your traps or rear delts.

Feet Shoulder-Width Apart: Toes slightly turned out. This sets you up for a strong and stable base.

Brace Your Core: Inhale before you descend and keep the core tight like you''re preparing to take a punch. This protects your spine and improves power.

Push Your Hips Back First: Initiate the movement by sending the hips back, then bend the knees. Keep the chest lifted and back neutral.

Depth Matters (to a point): Aim for thighs parallel or slightly below, as long as your form stays locked in. No butt winks or rounded backs.

Drive Through the Heels: On the way up, push through your heels and keep knees tracking in line with your toes, no collapsing in.'),
  ('Barbell back squats into alt reverse lunges5e', 'f5e112d9-61d2-4a52-978f-fa4e066af42d_gen.mp4', 'Start with the barbell racked on your upper traps (not your neck)

Set your stance shoulder-width apart, toes slightly turned out

Brace your core like you''re about to get punched, ribs down, lats tight

Lower into a controlled back squat, hips going back and down

Drive up through your heels to stand tall

From the top, step your right leg straight back into a reverse lunge

Both knees at 90° at the bottom

Chest stays lifted, front foot planted heel-to-toe

Press through the front heel to return to standing

Repeat the lunge on the left leg

That''s one full rep. Keep the rhythm smooth and intentional.'),
  ('Barbell bench press', '5e8d4e45-03e7-4b84-a8d2-b98d55a3bb33_gen.mp4', 'Lie flat on the bench, eyes aligned just under the bar

Feet flat on the floor, glutes and upper back pressed into the bench

Grip the bar slightly wider than shoulder-width, wrists stacked over elbows

Unrack the bar and lower it under control to the mid-chest/sternum

Keep elbows at about a 45° angle, not flared, not tucked too tight

Press through your palms, driving the bar straight up

Keep a slight arch in your lower back, don''t lift your glutes

Exhale as you press up, inhale as you lower'),
  ('Barbell Bicep Curls', '7a52bc29-c8b3-451f-b557-ba3cb9a35bca_gen.mp4', 'Set Your Grip: Use a shoulder-width underhand (supinated) grip. Wrists stacked under elbows, elbows tight to your sides.

Stand Tall: Feet hip-width apart, knees soft, core braced. Don''t lean back or sway, this is strict form, not a full-body lift.

Control the Curl: Curl the bar up in a smooth arc, keeping elbows pinned at your sides. Don''t let them drift forward.

Squeeze at the Top: Pause briefly at the peak and flex the biceps hard, no need to go past 90° if it causes shoulder takeover.

Lower With Control: Slowly bring the bar down, keeping constant tension on the biceps. Don''t let it drop.

No Swinging: Momentum is the enemy. If you have to rock your body to lift the weight, it''s too heavy.

Optional Tweaks: Use an EZ-bar if straight bar causes wrist strain.'),
  ('Barbell box squats', '4da322c9-a680-468f-9b3f-476f28d6ac9a_gen.mp4', 'Set a box or bench just below parallel (or at parallel for beginners)

Barbell rests across your traps, set up like a traditional back squat

Feet shoulder-width apart, toes slightly turned out

Brace your core, hinge slightly at the hips, and lower with control

Tap the box softly, don''t plop or fully sit down

Drive through your heels to return to standing, squeezing glutes at the top

Keep knees tracking over toes and maintain an upright chest

Exhale on the way up, inhale on the way down

Great for building squat depth, posterior chain strength, and explosive power'),
  ('Barbell box step ups', 'a21e711e-1386-4616-8754-7a8d6b3c759e_gen.mp4', 'Use a box at knee height or slightly below

Barbell rests across your upper traps, stand tall, core tight

Step fully onto the box with one foot, plant the entire foot flat

Drive through the heel of the front leg to lift yourself up

Do not push off the back foot, focus on isolating the working leg

Fully extend at the top, glutes tight, hips locked out

Lower under control, keeping your balance

Repeat all reps on one side, then switch legs

Keep torso upright and eyes forward throughout'),
  ('Barbell deadlifts', '8c089bd3-c9eb-4fe8-9ba7-08ca6666df45_gen.mp4', 'Feet hip-width apart, barbell over mid-foot (shoelaces under the bar)

Grip just outside the legs, arms straight, shoulders slightly in front of the bar

Hinge at the hips, slight bend in knees, back flat, core braced

Keep your gaze down, eyes on the floor to maintain a neutral neck

As you lift, your head will naturally come up with your spine

Engage your lats (pull the bar in close), and drive through your heels to stand

Hips and chest rise together, avoid shooting the hips up first

At the top, stand tall and squeeze your glutes, don''t lean back

Lower with control by hinging at the hips first, then bending the knees

Inhale to brace, exhale at the to'),
  ('Barbell Front Squats', '0d2187b8-6c58-4e09-8550-8ed93fde6764_gen.mp4', 'Warm up with the bar for 8-10 reps first

Setup:
Grip: Hands just outside shoulder-width, elbows high and forward.

Bar Position: Rest the bar on the front deltoids, not the throat. Elbows form a shelf to keep the bar stable.

Feet: Shoulder-width or slightly wider, toes pointed slightly out.

Execution:
Brace Core: Take a deep breath, tighten your core, and engage your lats to keep the bar stable.

Descent: Push hips back slightly, bend the knees, and squat deep (at least parallel). Keep chest upright and knees tracking over toes.

Ascent: Push through heels, keeping elbows high. Fully extend hips and knees at the top.

Breathing:
Inhale at the top, hold your breath through the descent, and exhale at the top after completing the squat.'),
  ('Barbell hipthrust', '710f0abf-694c-45c0-8e40-2a39b1fc0c04_gen.mp4', 'Set Up the Bench: Use a stable bench that hits just below your shoulder blades when seated. Sit with your upper back resting against it, knees bent, feet flat on the floor hip-width apart.

Roll the Barbell Over Your Hips: Use a pad or towel for comfort. The bar should rest in the crease of your hips, not on your stomach or thighs.

Brace Your Core & Tuck Your Pelvis: Slight posterior tilt, tuck your tailbone under to avoid overextending your low back. Keep your ribs down.

Drive Through Heels: Push your feet into the floor and lift the bar by driving through your heels, not your toes. This keeps the tension on your glutes.

Full Lockout & Squeeze: At the top, your shins should be vertical, hips fully extended, and your back neutral. Pause and squeeze the glutes hard.

Chin Tucked: Look forward and keep your chin slightly tucked, this keeps your spine aligned and prevents overextending your neck or lower back.

Control the Eccentric: Lower the weight with control, don''t drop your hips or bounce off the floor. Time under tension builds growth.

No Hyperextension: You shouldn''t feel this in your lower back. If you do, check your hip/neck position or reduce the weight'),
  ('Barbell Jumpsquats', '4c64633a-834e-4ab9-ab62-7f6221d6a85a_gen.mp4', 'Use a light barbell across the traps, this is about power, not max load

Stand shoulder-width apart, toes slightly turned out

Keep chest lifted, core braced, and back flat

Perform a controlled squat, then explode up into a jump

Land softly into the next rep, knees tracking over toes, heels down

Absorb the impact by immediately moving into your next squat

Keep the bar stable on your back, no bouncing or wobbling

Exhale on the jump, inhale on the reset

Quality > height, focus on clean landings and strong, explosive takeoffs'),
  ('Barbell overhead press', 'c7e006e4-a7f1-4793-ba9b-dc2f8ef1032e_gen.mp4', 'Start with the barbell racked at shoulder height, grip just outside shoulder-width, wrists stacked over elbows.
Unrack the bar and brace your core, feet should be shoulder-width, glutes and abs tight.
Press the bar overhead in a straight line, finishing with your arms fully extended and biceps by your ears.
Keep ribs tucked and avoid overextending your lower back.
Lower the bar with control back to shoulder height.
Don''t flare the elbows out, keep them slightly in front of the bar path'),
  ('Barbell push press', '93454585-42f1-4d88-873b-714198c18abd_gen.mp4', 'Start with the barbell in the front rack position, resting across your shoulders, elbows slightly forward

Feet shoulder-width apart, core tight, chest proud

Dip slightly by bending the knees, keep torso upright

Immediately drive through your heels and use your legs to help press the bar overhead

Bar path should be straight, move your head slightly back, then through at the top

Lock out at the top, arms fully extended, biceps by ears

Lower the bar back to your shoulders with control

Exhale on the press, inhale on the dip

Focus on speed and power, this is a leg-assisted press, not a strict shoulder press'),
  ('Barbell RDLs', '1a8c6a4b-958f-4572-8d5c-6cdbe732bb21_gen.mp4', 'Start With Feet Hip-Width Apart: Feet flat, toes forward or slightly turned out. Grip the bar just outside your thighs with an overhand grip.

Soft Knees: Slight bend in the knees, this is key. Don''t lock them out, but don''t turn it into a squat either. The bend stays consistent throughout.

Hinge at the Hips: Push your hips back like you''re closing a door with your glutes. Keep the bar close to your legs as it travels down.

Flat Back, Core Tight: Spine neutral, chest up, and lats engaged. No rounding, think about lengthening through the crown of your head.

Lower With Control: Descend until you feel a deep stretch in the hamstrings, usually just below the knees or mid-shin. Don''t force the range by rounding.

Squeeze & Drive Up: Press through your heels and drive your hips forward to return to standing. Squeeze your glutes hard at the top, don''t hyperextend.

Tempo Focused: 3-4 seconds down, 1 second pause at the bottom, explosive on the way up = best results'),
  ('Barbell Reverse Lunges', '8019f383-bb79-457c-9400-fdc78c78fed5_gen.mp4', 'Barbell rests across the traps, chest lifted, core tight

Stand tall with feet hip-width apart

Step one leg straight back, lower until both knees are at 90°

Front knee stays stacked over the ankle, don''t let it push past the toes

Push through the front heel to return to standing

Keep torso upright and hips square, no leaning or twisting

Complete all reps on one side before switching (or alternate legs)

Inhale as you step back, exhale as you drive up

Control is key, focus on depth, balance, and clean reps over spee'),
  ('Barbell split squats', 'c40c3dcc-29c8-4e01-bbc1-1d5b8f6fafc2_gen.mp4', 'Barbell rests across your traps, chest tall, core braced

Take a long step back into a split stance, feet should be hip-width apart for balance

Front foot flat, back foot on the toes

Lower under control, both knees should bend to ~90°, with the back knee dropping straight down

Keep your front knee stacked over the ankle, don''t let it cave in or push too far forward

Push through the front heel to return to the top

Torso stays upright, hips square, and movement stays vertical, no forward lean

Exhale as you push up, inhale as you lower

Repeat all reps on one leg before switching sides'),
  ('Barbell thrusters', '0aabc03e-2dc9-49c7-8bb8-fbb91276b362_gen.mp4', 'Start with the barbell in a front rack position, elbows slightly forward, chest tall

Feet shoulder-width apart, core braced

Perform a full front squat, hips below parallel if mobility allows

Drive through the heels and explode upward

Use the momentum from the squat to press the bar overhead in one fluid motion

At the top: arms fully extended, biceps by ears, no arching the lower back

Lower the bar back to the front rack as you descend into your next squat

Breathe in on the squat, exhale hard as you press

Focus on speed, control, and full-body coordination, this is a strength + power combo'),
  ('Behind-the-Neck Band Lat Pulldown', 'e3d2235a-1ff5-4c65-be28-912e78e43f15_gen.mp4', 'Anchor the band overhead and stand tall with a wide stance.
Grab the band with a wide grip, arms fully extended overhead.
Pull the band down behind your head with control, keeping your elbows flared out slightly and squeezing your shoulder blades together.
Stop when your hands are just above shoulder level behind your head, avoid pulling too low.
Keep your core tight, chest lifted, and head neutral (don''t lean forward or arch the back).'),
  ('Bench asst crossbody mountain climbers', 'ada7ee25-fb3d-4201-bb67-d5b8616ab9ae_gen.mp4', 'Place your hands on the edge of a bench, shoulders stacked over wrists

Step your feet back into a high plank, body in a straight line, core braced

Drive one knee across your body toward the opposite elbow

Keep the movement controlled, hips low, back flat

Alternate legs in a smooth, steady rhythm, avoid bouncing or twisting the torso'),
  ('Bench asst DB rows', 'd2a86521-f250-4872-9580-fc51ed7e31c8_gen.mp4', 'Set the bench at a 45° incline and lie face down with your chest supported and feet planted

Hold a dumbbell in each hand with arms extended and palms facing in (neutral grip)

Keep your core tight and spine neutral, avoid arching or hyperextending your neck

Row the dumbbells up toward your ribcage, squeezing your shoulder blades together at the top

Elbows should move in close to the body, control the tempo

Lower the dumbbells back down with control (don''t let them swing)'),
  ('Bench asst push ups', 'b4f22e4b-463e-47a2-a8ff-59b1a105dc68_gen.mp4', 'Place hands on the edge of a bench, shoulders stacked over wrists

Step your feet back into a straight line, body in a strong plank position

Brace your core, glutes tight, no sagging or hiking hips

Lower your chest toward the bench, elbows at about a 45° angle

Keep your neck neutral and core engaged

Press through your palms to return to the top, full lockout at the top'),
  ('Bench Dips', 'fa0f59e0-fc06-4ff3-a58c-243b155010e0_gen.mp4', 'Sit on the edge of a bench, hands placed beside your hips, fingers pointing forward

Walk your feet out and slide your hips off the bench, chest tall, core tight

Lower your body by bending your elbows straight back, not out to the sides

Elbows should reach about a 90° angle at the bottom

Press through your palms to return to the top, control the movement

Keep your hips close to the bench, don''t let them drift forward

The farther your legs are extended, the harder the movement

Modify by bending knees (easier); extend legs straight for more challenge'),
  ('Bench Hops', 'e0c2f30b-c540-4b75-837b-9e3482d2e672_gen.mp4', 'Place your hands on the edge of a bench, arms extended, shoulders stacked over wrists

Jump both feet together side-to-side over the bench or to each side of it (depending on height/modification)

Keep your knees slightly bent and core engaged throughout

Land softly on the balls of your feet, stay light, quick, and controlled

Hips stay low, body in a slight crouch, avoid bouncing up too high

Exhale as you hop, inhale as you land/reset

Keep your upper body stable, movement should come from the lower body and core'),
  ('Bench step ups', 'c2dacf62-e41e-4414-b05e-26ee740ec956_gen.mp4', 'Stand tall in front of a bench, chest up, core engaged

Step one foot fully onto the bench, heel flat and planted

Drive through the front heel to lift your body up

Avoid pushing off the back leg, let the front leg do the work

Stand fully at the top, hips extended, glutes squeezed

Lower with control, stepping down under balance

Repeat all reps on one side before switching

Keep your torso upright and knee tracking over the toes'),
  ('Bench V-ups', '4c2aca2f-9141-4a10-915f-d0b6c224f69e_gen.mp4', 'Sit on the edge of a flat bench with your hands gripping the sides just behind your hips.
Extend your legs out in front of you, hovering slightly off the ground.

Keep your chest lifted and core braced, avoid rounding your spine.

Simultaneously lift your knees toward your chest while leaning your upper body slightly back to create a "V" shape.

At the top of the movement, squeeze your core and pause briefly.

Slowly extend back to the starting position without letting your feet or shoulders rest.

"Keep tension in your core the entire time."

"Control the movement, don''t swing your legs."

"Lift with your abs, not your momentum."'),
  ('Bicycle Crunches', 'e1261a70-48a8-493c-94f1-256ba74a8f86_gen.mp4', 'Lie flat on your back with your hands behind your head (lightly supporting, not pulling)

Bring your knees up to a 90° tabletop position and lift your shoulders off the ground

Begin alternating sides by extending one leg out straight while pulling the opposite knee in

Twist through your core, bringing the opposite elbow toward the bent knee

Keep the movement controlled and fluid, not rushed or jerky

Focus on quality over speed to really target the obliques

Keep your lower back pressed into the mat the entire time to avoid strain'),
  ('Bird dog', 'ccf3155e-4974-4109-b406-b7a7dc4a1eb6_gen.mp4', 'Start on all fours, wrists under shoulders, knees under hips

Brace your core, back flat, avoid arching or rotating the hips

Extend opposite arm and leg fully, reach long, not high

At full extension, pause and squeeze glutes and core

Return by bringing your elbow to meet the opposite knee underneath your body

Keep the movement smooth and controlled, no rocking or twisting

Exhale as you extend, inhale as you pull elbow to knee

Focus on balance, control, and keeping your torso stable throughout

Pro tip: Move slow, this variation adds anti-rotation core work and more challenge to your coordination'),
  ('Body weight Alternating Reverse Lunges', 'ac9c3c88-2c11-4d35-9bab-436e164eb612_gen.mp4', 'Stand tall with feet hip-width apart, core engaged, chest lifted

Step one leg straight back, lowering into a lunge, both knees should hit ~90°

Keep your front knee stacked over the ankle, not past the toes

Push through the front heel to return to standing

Alternate legs with each rep, keeping movement controlled

Torso stays upright, hips square, no leaning or twisting

Inhale as you step back, exhale as you drive up

Focus on balance, depth, and glute engagement, not speed'),
  ('Body weight Crunches', '3341b72e-d472-4a7a-95cc-f1a3f9a0c269_gen.mp4', 'Lie flat on your back, knees bent, feet flat on the floor

Hands behind your head or crossed over your chest

Engage your core and lift your shoulder blades off the floor, chin stays tucked (imagine holding an orange under your chin)

Keep lower back pressed into the ground, avoid pulling on your neck

Exhale as you crunch up, inhale as you lower with control

Movement is small and focused, lift with your abs, not momentum'),
  ('Body weight Curtsey Lunges', '31e22bf6-43c6-426d-966e-f5ccf43363de_gen.mp4', 'Stand tall with feet hip-width apart, core engaged, chest lifted

Step one leg diagonally behind you, like a "curtsy", crossing behind the front leg

Lower into a lunge, both knees should bend, and front knee should stay tracking over your front foot

Keep hips square and torso upright, avoid twisting or leaning forward

Push through the front heel to return to standing

Alternate sides with each rep, maintaining control and balance

Inhale as you lower, exhale as you rise

Focus on glute engagement and hip stability, don''t rush the movement'),
  ('Body weight Donkey Kicks', '8c7204a1-2d27-41e7-98b3-3376a5ff79ef_gen.mp4', 'Start on all fours, wrists under shoulders, knees under hips

Keep your core tight and back flat, no arching or rotating the hips

Flex your working foot and drive your heel up toward the ceiling

Keep your knee bent at 90° throughout the movement

Pause and squeeze the glute at the top, then lower with control, don''t rest the knee on the floor between reps

Hips stay square, avoid opening or twisting through the torso

Exhale as you kick up, inhale as you return

Perform all reps on one side before switching'),
  ('Body weight Fire Hydrant Donkey Kick variation', '40ea46c1-fa33-464c-be50-6c9ae433abf1_gen.mp4', 'Start on all fours, wrists under shoulders, knees under hips

Keep your core tight and back flat, no arching or rotating the hips

Flex your working foot and drive your heel up toward the ceiling

Keep your knee bent at 90° throughout the movement

Pause and squeeze the glute at the top, then lower with control, don''t rest the knee on the floor between reps

Hips stay square, avoid opening or twisting through the torso

Exhale as you kick up, inhale as you return

Perform all reps on one side before switching'),
  ('Body weight Fire Hydrants', '73325db5-399b-4146-ae6d-4c0446ed3bb4_gen.mp4', 'Start on all fours, wrists under shoulders, knees under hips

Brace your core and keep your back flat, no arching or shifting your weight

Keeping your knee bent at 90°, lift one leg out to the side like opening a gate

Pause at the top for a strong glute squeeze, then lower with control

Hips stay square, avoid twisting or leaning into the opposite side

Exhale as you lift, inhale as you lower

Keep tension in the glute throughout, don''t rest the knee at the bottom

Perform all reps on one side before switching'),
  ('Body weight front lunge to back lunge', 'afe154ca-e949-478d-a8d3-96311caa6270_gen.mp4', 'Start standing tall with feet hip-width apart and core engaged

Step forward into a lunge, lowering until both knees are at 90°, front knee stacked over ankle

Push off the front foot to return to center, then immediately step backward with the same leg

Lower into a reverse lunge, keeping your chest lifted and weight centered

Return to standing and repeat all reps on one side before switching

Keep movements controlled and balanced, focusing on smooth transitions

Maintain a strong, upright posture throughout to protect your knees and activate the core'),
  ('Body weight Good Mornings', '6833d663-349a-4e45-b719-40cf82b69e5d_gen.mp4', 'Stand tall with feet hip-width apart, core tight, and hands placed behind your head or crossed over your chest

Slight bend in the knees, not locked out

Hinge at the hips, pushing your glutes back while keeping your spine neutral and chest open

Lower your torso until it''s about parallel to the ground or until you feel a good stretch in your hamstrings

Keep your weight in your heels and avoid rounding your back

Drive through your glutes to return to standing

Squeeze at the top, then repeat with control

Focus on a slow, controlled tempo, this is about muscle activation, not speed'),
  ('Body weight hip thrust', '4d0dc566-5459-409a-b001-bae7ece422b8_gen.mp4', 'Start with your upper back positioned on a flat bench, feet flat on the floor and hip-width apart

Knees should be bent at 90 degrees with heels stacked under your knees

Keep your chin tucked and core braced throughout the movement

Drive through your heels to lift your hips until your torso is parallel to the floor

At the top, squeeze your glutes hard and hold for 1-2 seconds

Lower your hips back down with control without letting your glutes touch the floor

Keep your gaze forward to maintain neck and spine alignment

Focus on pushing through the heels and engaging your glutes, not your lower back'),
  ('Body weight Jump Squats', '38694518-7716-4803-917e-bdf7b7c50712_gen.mp4', 'Start With a Strong Base: Feet shoulder-width apart, toes slightly turned out. Brace your core and engage your glutes before you move.

Drop With Control: Squat down like a standard bodyweight squat, hips back, chest up, and knees tracking over toes.

Explode Up: Drive through your heels and jump straight up with power. Think of it as a quick, explosive release from the bottom.

Land Softly: Absorb the landing by bending your knees and hips, no stiff legs. The landing should feel light and controlled.'),
  ('Body weight lateral lunges', '9bb931a7-539d-4648-9414-70401fec0a38_gen.mp4', 'Stand tall with feet hip-width apart and core engaged

Step out wide to one side, keeping the opposite leg straight

Push hips back as if sitting into a chair; keep chest up and knee tracking over toes

Press through the heel of the bent leg to return to starting position

Keep both feet flat and avoid letting the knee collapse inward

Move slow and controlled; aim for depth without losing form'),
  ('Body weight Pulse Squats', '1b0e30b4-b1a4-4a37-a2f7-836277944cca_gen.mp4', 'Stand with feet shoulder-width apart, toes slightly turned out

Lower into a squat until thighs are parallel to the floor

Stay in the bottom half of the squat and perform small pulses (1-2 inches up and down)

Keep your chest lifted, core tight, and knees tracking over your toes

Focus on control and constant tension, don''t fully stand up between reps

Great for finishing sets or adding intensity without weight'),
  ('Body weight Russian Twist', 'c0722eca-9224-4f00-b53c-cf3691f61119_gen.mp4', 'Sit on the floor with knees bent and feet flat or slightly lifted for more challenge

Lean back slightly to engage your core, keeping your spine neutral and chest lifted

Clasp your hands together or hold an imaginary object at chest level

Rotate your torso to one side, bringing your hands beside your hip, then twist to the other side

Keep the movement slow and controlled, avoid using momentum

Focus on twisting through your core, not just moving your arms side to side

Keep your feet together and off the floor if you want to increase difficulty, but maintain balance and form'),
  ('Body weight Single Leg Lifts', 'ac8379f9-f1af-4c46-be06-7829937c2244_gen.mp4', 'Lie on your side, propped up on your forearm with elbow stacked under your shoulder

Legs extended straight, stacked on top of each other, core engaged

Keep hips squared and lifted, avoid sinking into the shoulder or letting the hips roll

Flex the toes of your top leg and lift it up slowly to about 45 degrees

Squeeze the glute at the top, pause briefly, then lower down with control

Maintain a straight line from head to heels, avoid arching or leaning back

Complete all reps on one side, then switch'),
  ('Body weight Single Leg V Ups', '052c5b68-143e-4b96-87fd-16d334db9acf_gen.mp4', 'Lie flat on your back with legs extended and arms reaching overhead

Keep your core braced and lower back pressed into the floor

Lift one leg and your upper body at the same time, reaching opposite hand toward the lifted foot

Keep the lifted leg as straight as possible, using your core to lift, not just swinging the leg

Lower back down with control and immediately repeat on the other side

Exhale as you lift, inhale as you lower

Focus on keeping movement controlled and reaching up, not just forward

Keep your neck neutral, avoid straining or tucking the chin too much'),
  ('Body weight Split Squats', '21209434-22b7-4e20-b26e-9b53f4fda98a_gen.mp4', 'Start in a staggered stance with one foot forward and the other extended back, toes pointing straight

Keep your torso upright, core tight, and hands on hips or in front of you for balance

Lower your back knee straight down toward the floor, keeping the front knee stacked over the ankle

Your front shin should remain vertical, and the back heel should stay lifted

Push through the heel of the front foot to rise back up without shifting forward

Keep reps smooth and controlled, avoid bouncing or rushing

Complete all reps on one leg before switching sides'),
  ('Body weight Squat to Calf Raise', '1e3d11f3-5c4c-4a82-bc2c-3eefc2e572fe_gen.mp4', 'Stand with feet shoulder-width apart, toes slightly turned out

Lower into a squat by pushing your hips back and bending your knees, keeping your chest lifted and core tight

Drive through your heels to stand up, and at the top, immediately rise onto your toes into a controlled calf raise

Squeeze your glutes and calves at the top before lowering heels back to the floor

Keep the transition between squat and calf raise smooth and controlled

Avoid leaning forward or shifting weight into your toes during the squat

Great for improving balance, coordination, and ankle stability'),
  ('Body weight squats', '6840d81a-5bb8-4d77-9cc6-3128503afeca_gen.mp4', 'Stand with feet shoulder-width apart and toes slightly turned out

Keep your core braced and chest tall throughout the movement

Push your hips back and sit down into your squat, keeping knees tracking over your toes

Lower until your thighs are parallel to the floor (or as low as mobility allows)

Keep your heels grounded, avoid letting them lift

Drive through your heels to stand back up, squeezing your glutes at the top

Maintain a neutral spine from top to bottom, no arching or rounding'),
  ('Body weight Step pumps', 'a0ac79ce-54fd-4a10-8a97-575ea828b071_gen.mp4', 'Place one foot flat on a bench or sturdy box, this foot stays planted throughout the entire set

The other foot starts on the ground

Push through the heel of the planted foot to lift yourself up, lightly tapping the back foot on the surface (don''t shift weight onto it)

Lower back down with control, lightly tapping the ground before pressing back up

Maintain a slight forward lean with chest tall and core engaged

Keep all the tension in the working leg, this should feel like a pump/burn, not a full step-up

Repeat all reps on one side before switching'),
  ('Body weight Straight Leg Kickbacks', 'f9a8f901-418e-46e3-8d2d-5165c2193cc4_gen.mp4', 'Start on all fours in a tabletop position with wrists under shoulders and knees under hips

Brace your core and keep your spine neutral, avoid arching your back

Extend one leg straight back and slightly upward, keeping it in line with your body

Flex the foot and squeeze your glute at the top of the movement

Lower the leg back down with control, keeping the toes off the ground

Focus on using your glute to lift, not your lower back or momentum

Keep your hips square, avoid letting the working side rotate upward

Complete all reps on one leg before switching sides'),
  ('Body weight sumo squats', '15db3bd8-07a2-4f2f-8856-341e1f7f40fc_gen.mp4', 'Stand with feet wider than shoulder-width apart and toes pointed out at about 45 degrees

Keep your chest tall, shoulders back, and core engaged

Lower your hips straight down, keeping knees tracking over toes, avoid letting them cave in

Drop as low as your mobility allows while maintaining good posture

Drive through your heels to return to standing, squeezing your glutes at the top

Maintain tension in your legs throughout, don''t lock out your knees'),
  ('Body weight Toe Touches', '7fda8728-74c0-42ab-b76c-ec3fc86a5498_gen.mp4', 'Lie flat on your back with legs extended straight up toward the ceiling, feet flexed

Arms should be extended straight overhead or toward your toes

Engage your core and press your lower back into the floor

Lift your head, neck, and shoulders off the ground, reaching your fingertips toward your toes

Exhale as you lift, focusing on crunching from your core, not pulling with your neck

Keep legs as straight and still as possible throughout the movement'),
  ('Body weight Twist Squat', '127d4007-5f84-4b40-966f-57ba4ad7e689_gen.mp4', 'Stand with feet shoulder-width apart, toes slightly turned out, core tight

Lower into a squat, keeping your chest tall and knees tracking over toes

As you rise from the squat, rotate your torso to one side and pivot the opposite foot slightly, bringing your elbow across your body (as if doing a standing oblique twist)

Return to center and immediately go into your next squat

Alternate twist directions with each rep

Keep movement fluid and controlled, focus on driving through the heels and using your core to initiate the twist'),
  ('Body weight walking lunges', '95e07676-e9e4-4786-a510-0659a0ac4259_gen.mp4', 'Stand tall with feet hip-width apart and core engaged

Step forward with one leg and lower your body until both knees are at about 90 degrees

Keep your front knee stacked over your ankle and your back knee hovering just above the ground

Push through the heel of your front foot to bring your back leg forward into the next lunge

Maintain an upright posture, avoid leaning forward or arching your back

Keep your steps controlled and purposeful, don''t rush

Alternate legs with each step and keep your core tight for balance and stability'),
  ('Bodyweight Bulgarian split squats', '3fdd126a-4dcb-46e8-9226-eaff0565c3dc_gen.mp4', 'Stand a few feet in front of a bench or elevated surface

Place the top of one foot on the bench behind you, front foot should be far enough forward to allow for proper depth

Keep chest lifted, core braced, and hips square

Lower your back knee toward the ground, both knees should bend to ~90°

Keep the front knee stacked over the ankle, don''t let it cave in

Push through the heel of the front foot to return to standing

Complete all reps on one side before switching

Exhale as you drive up, inhale as you lower

Focus on control, balance, and full range of motion, not speed'),
  ('bodyweight single Leg Hipthrusts w/ 10 Second Hold', '15ec2ae7-671a-4a8d-922f-a1dd3be69b1c_gen.mp4', 'Lie flat on your back with one knee bent and foot flat on the floor, the other leg extended straight out

Keep arms by your sides for stability and brace your core

Drive through the heel of the grounded foot to lift your hips off the floor

At the top, your extended leg should be in line with your torso, hold this position for 10 seconds, keeping glutes squeezed tight

Avoid letting your hips rotate or drop, keep them square and level

Slowly lower your hips to the floor after the hold

Reset and repeat all reps on one leg before switching sides'),
  ('Box Step Up and Down', '0063835c-f852-47dc-965f-2e30ecf458a0_gen.mp4', 'Stand facing a sturdy box or bench with feet hip-width apart

Step up with one foot, pressing through the heel to lift your body onto the box

Bring the opposite foot up to stand fully on the box

Step back down with the same foot that came up second, then follow with the first

Alternate the lead leg each rep

Keep your chest tall, core tight, and movement controlled, don''t bounce off the box

Use your glutes and quads to drive the motion, not momentum'),
  ('Bulgarian split squat- Quad focused', '7cd7ed5b-b604-439f-a2e9-7b14ee3c11f9_gen.mp4', 'Set the back foot on a bench or pad laces down; keep it low enough to avoid hip strain.

Front foot is placed closer to the bench than a glute-focused setup to allow more knee travel.

Keep the torso upright and chest tall throughout the movement.

Brace the core and sit straight down, not back.

Allow the front knee to track forward over the toes (pain-free range).

Drive through the mid-foot and heel of the front leg to stand.

Keep hips and shoulders square, avoid leaning or twisting.'),
  ('Bulgarian split squat- Quad focused* BW dropset', '2e0ffc04-f0b1-49a3-bf52-e753c61272d9_gen.mp4', 'Set the back foot on a bench or pad laces down; keep it low enough to avoid hip strain.

Front foot stays relatively close to the bench to allow increased knee travel.

Torso stays upright, do not hinge forward (this keeps the quad bias).

Brace the core and sit straight down, not back.

Allow the front knee to track forward over the toes in a pain-free range.

Descend under control (2-3 seconds), then drive up through the mid-foot/heel.

Once you finish your weighted reps, immediately drop the load and continue with bodyweight reps.

Push BW reps to near failure while maintaining clean form, no bouncing or rushing.'),
  ('Burpees', 'c420d462-2796-42d6-a3e6-c787e54c2bc4_gen.mp4', 'Start standing tall with feet shoulder-width apart

Drop into a squat position and place your hands on the floor in front of you

Jump your feet back into a high plank position, keep core tight and back flatJump your feet back toward your hands to return to the squat position

Explosively jump straight up, reaching arms overhead

Land softly and move right into the next rep

Keep movement fluid and maintain good form, quality > speed if you''re just starting out

Modify by stepping back into plank and removing the jump if needed'),
  ('Butterfly Sit Up', '1c4b1ddf-2719-454d-8698-d83a4391bb16_gen.mp4', 'Sit on the floor and bring the soles of your feet together, letting your knees fall open (butterfly position)

Lie back with arms extended overhead and core engaged

Use your abs to sit all the way up, reaching your hands toward or past your feet

Keep feet pressed together and avoid using momentum, focus on core control

Lower back down slowly with control until shoulders touch the floor

Exhale as you come up, inhale as you return to the floor'),
  ('Cable flys', '658e997c-ea08-40ac-8714-6b50b18bfd78_gen.mp4', 'Set both cables above head height on the machine.

Grab the handles and step forward into a staggered stance for stability.

Chest tall, shoulders down and back, core braced.

Maintain a soft bend in the elbows and keep that angle fixed throughout the rep.

Pull the handles down and in in a wide arc until hands meet in front of the lower chest/upper abs.

Actively squeeze the chest at the bottom for 1 second.

Control the return as the arms open back up (2-3 second negative).

Stop when you feel a deep chest stretch, don''t let shoulders roll forward.

Avoid momentum or turning it into a tricep press.'),
  ('Cable front raises', '35397920-997d-43f8-bf32-7efb75bcc9c2_gen.mp4', 'Attach a rope to the low pulley and stand facing the cable machine

Grab both ends of the rope with palms facing inward (neutral grip)

Drop into a slight squat or hinge position, knees bent, hips back, chest forward, core tight

With arms extended and soft elbows, raise the rope straight up in front of you to shoulder height

Keep the rope ends slightly apart at the top and squeeze through the front delts

Slowly lower with control, avoid letting the weight pull your arms down quickly

Stay grounded in your legs and keep your torso still, no swinging or momentum'),
  ('cable glute kickbacks', '3c2fa534-1eb4-44d8-84cf-a32e7b719eee_gen.mp4', 'Attach an ankle strap to the cable machine and set the pulley to the lowest setting.
Secure the strap around your ankle and lightly hold onto the machine for balance.
Stand with a slight bend in the standing leg and keep your chest up and core tight.
Start with the working leg slightly in front of the body.
Drive the heel back and slightly upward while squeezing the glute at the top of the movement.
Keep the movement controlled and avoid swinging the leg or using momentum.
Maintain a neutral spine and avoid arching the lower back as the leg extends.
Focus on pushing through the heel rather than the toes to maximize glute engagement.
Slowly return the leg back to the starting position while keeping tension on the glute.
Keep hips square to the machine and avoid rotating the pelvis during the movement.
Think about shortening the glute at the top of every rep for a strong contraction.'),
  ('Cable lat pull downs', '209cc32f-fdf0-49a6-a2c4-24f7881d5461_gen.mp4', 'Attach a rope to the high pulley.

Stand facing the machine with feet hip-width apart, a few feet back from the cable.

Hold each end of the rope with a neutral grip.

Slight bend in the knees, soft hinge at the hips, arms extended straight overhead (in line with cable), and chest proud.
With straight arms, pull the rope downward in an arc motion, keeping the arms mostly straight (small bend at elbow is okay).

Drive the rope down toward your thighs/lower abdomen, just below the navel, squeezing through your lats.

Pause briefly at the bottom with full lat contraction.

Slowly reverse the motion, returning to the start without letting the arms fully relax.
"Pull through your lats, not your arms."

"Keep arms straight, core tight, and avoid swinging."

"Hinge at the hips slightly to feel that full lat stretch at the top."

"Rope finishes at your lower abs, not your chest."'),
  ('Cable Pull Through-hamstrings', '6fbadad2-8ec6-415e-bcc6-66276a3fc128_gen.mp4', 'Set a cable machine with a rope attachment at the lowest setting

Face away from the machine, grab the rope between your legs, and take a few steps forward to create tension

Stand with feet hip-width apart, knees slightly bent, and core braced

Hinge at your hips (not your lower back) by pushing your hips back while keeping your spine neutral and chest tall

You should feel a deep stretch in your hamstrings at the bottom of the movement

Drive your hips forward and squeeze your glutes to return to standing, keeping arms relaxed and letting the hips do the work

Avoid shrugging, leaning back, or overextending at the top, stand tall and lock out with glutes

Control the movement, don''t let the cable snap you back'),
  ('Cable reverse flys', '5f6edafc-0411-440e-8302-c88d701abe11_gen.mp4', 'Set both cable pulleys around shoulder height and attach single handles.
Grab the opposite handle with each hand so the cables cross in front of the body.
Stand tall with a slight bend in the knees and keep your core engaged.
Start with arms slightly bent and hands in front of the chest.
Pull the handles outward in a wide arc until arms are in line with the shoulders.
Focus on driving through the elbows rather than pulling with the hands.
Squeeze the rear delts and upper back at the end of the movement.
Control the weight slowly back to the starting position without letting the stack slam.
Keep shoulders down and away from the ears throughout the exercise.
Avoid excessive swinging, shrugging, or using momentum.
Maintain a soft bend in the elbows the entire movement to protect the joints and keep tension on the rear delts.'),
  ('Cable shoulder press', '55a9cb7c-4a62-4648-b5e8-9207df68a63e_gen.mp4', 'Set both cable pulleys to the lowest setting and attach single handles.
Grab each handle normally with palms facing forward at shoulder height.
Stand with one foot slightly in front of the other for better balance and stability.
Keep your core braced, chest up, and spine neutral throughout the movement.
Press the handles directly overhead until arms are fully extended.
Control the weight on the way down and return handles back to shoulder level.
Keep elbows slightly in front of the body instead of excessively flared outward.
Avoid arching the lower back or using momentum to move the weight.
Maintain constant tension through the shoulders by moving slowly and with control.
Keep shoulders down and away from the ears during the press.
Focus on driving through the shoulders and triceps while staying stable through the core.'),
  ('Cable tricep extension', '3880585f-dbec-4a76-971b-3d2bc30463bb_gen.mp4', 'Attach a Rope to the High Pulley: Set the cable at the highest setting. Grab the rope with a neutral grip (palms facing each other), thumbs pointing up.

Staggered Stance or Feet Hip-Width: Slight bend in the knees and a slight lean forward helps anchor your position.

Elbows Locked at Your Sides: Keep elbows tight and fixed, only the forearms should move. Don''t let your elbows swing forward or outward.

Pull Down & Split the Rope: As you extend your arms down, pull the rope ends apart at the bottom, this maximizes lateral head activation of the triceps.

Squeeze at the Bottom: Fully extend your elbows and pause for a second at the bottom with arms straight and rope ends separated. Feel that contraction.

Control the Eccentric: Bring the rope back up slowly until forearms are about parallel to the floor, don''t let the weight stack pull you back.

Neck Neutral, Core Tight: Avoid hunching forward or letting your ribs flare. Keep a strong posture and your spine aligned.

Breathe With It: Exhale as you press down, inhale as you return to the top.'),
  ('Cat cow pose', 'ad22547a-e7e6-4591-8af8-3a1d379f66bb_gen.mp4', 'Start in Tabletop: Hands under shoulders, knees under hips, spine neutral. Spread your fingers wide and grip the floor lightly for stability.

Inhale. Cow Pose: Drop your belly, lift your chest, and tilt your pelvis forward. Pull your shoulder blades back and gaze up gently, open through the front body.

Exhale. Cat Pose: Round your spine up toward the ceiling, tuck your pelvis, and draw your chin to your chest. Push the floor away and spread your shoulder blades.

Move With the Breath: Let your inhale guide you into Cow, and your exhale into Cat. Keep the movement fluid and intentional.

Focus on Mobility, Not Speed: This is about increasing spinal awareness and flexibility, slow and controlled reps are key.

Neck Follows Naturally: Don''t crank your neck. Let it follow the curve of your spine throughout each phase.'),
  ('close grip overhand lat pulldown', '8d21556e-cab2-45a5-9a8e-014f3d339f53_gen.mp4', 'Grab the straight lat pulldown bar with an overhand grip, keeping your hands just inside shoulder-width apart.
Sit tall with your chest up, core braced, and shoulders pulled down away from your ears.
Initiate the movement by driving your elbows down toward your sides.
Pull the bar to your upper chest while keeping your torso mostly upright.
Squeeze your lats at the bottom of the movement.
Slowly return the bar to the starting position, allowing for a full stretch at the top.
Avoid shrugging your shoulders, pulling behind your neck, or using momentum to move the weight.'),
  ('Close Grip Rows', '04f4faf1-0d17-4a5b-abcf-911bdecf3ae8_gen.mp4', 'Sit down at a seated cable row machine and grab the close-grip V-handle

Place feet on the platform, knees slightly bent, and sit tall with your chest up and core braced

Start with arms fully extended and shoulder blades pulled slightly forward for a full stretch

Pull the handle toward your torso, aiming for your lower chest or upper abs

Focus on driving your elbows straight back, keeping them close to your sides

Squeeze your shoulder blades together at the peak of the movement

Control the weight on the way back to the starting position, don''t let the stack pull you forward'),
  ('Crazy 24''s leg extensions', '27404a06-294f-4db9-b1b0-3860a9ecc71f_gen.mp4', 'Set up on the leg extension machine with back flat and knees aligned with the machine''s pivot point

Start with toes pointed inward (heels slightly out) and perform 8 controlled reps

Without resting, shift to neutral foot position and perform another 8 reps

Immediately shift to toes pointed outward (heels in) and complete the final 8 reps

Focus on squeezing the quads at the top of each rep and controlling the weight on the way down

Don''t swing or use momentum, stay locked in and keep constant tension'),
  ('Crossbody hammer curls', 'e8720963-6b63-4de7-8a0f-8ef42bf50b92_gen.mp4', 'Stand tall with a dumbbell in each hand, arms fully extended at your sides, palms facing your body (neutral grip).

Keep your feet hip-width apart and core engaged.

Execution:

Curl one dumbbell across your body toward the opposite shoulder, keeping your palm facing in.

Pause at the top for a squeeze in the bicep.

Lower with control and alternate to the other side.

Keep elbows close to your torso, only the forearms should move.

Coaching Cues:

"Cross the chest, not just straight up."

"Squeeze at the top like you''re flexing for a picture."

"Control the negative, don''t let it drop."

"No swinging, keep it clean and steady."

Muscles Worked:

Primary: Biceps (especially brachialis)

Secondary: Forearms, shoulders (isometric stabilization'),
  ('Crossbody Mountain Climbers', 'f86b0398-51f3-432f-82bd-799b2e87e885_gen.mp4', 'Start in a high plank position with wrists under shoulders, arms straight, and body in a straight line from head to heels

Keep your core braced and glutes tight

Drive one knee toward the opposite elbow, rotating slightly through the torso to engage the obliques

Return to plank and alternate sides in a controlled, rhythmic pace

Keep your hips low and avoid bouncing, focus on core control, not speed

Maintain steady breathing and keep shoulders stacked over wrists'),
  ('Crunch Reach', 'f7fb1024-b520-4b8e-af8f-83ca8e93008d_gen.mp4', 'Lie flat on your back with knees bent and feet flat on the floor

Place your hands on your thighs with arms extended

Engage your core and press your lower back into the mat

Exhale as you slide your hands up your thighs, reaching toward your knees

Focus on lifting your shoulder blades off the ground, not pulling with your neck

Keep the movement slow and controlled, avoid using momentum

Inhale as you return to the starting position with control'),
  ('DB asst half burpee', 'f3c45fc9-b102-4112-8988-462918cc9aec_gen.mp4', 'Start with a dumbbell in each hand, placed vertically on the floor about shoulder-width apart

Grip the dumbbells and set up in a high plank position, shoulders stacked over wrists

Jump or step your feet forward toward your hands, landing in a deep squat or crouch position

Keep your chest lifted and core tight as you immediately jump or step your feet back into plank

Maintain a flat back and neutral spine, avoid letting the hips sag

Move with control and stay light on your feet

This variation removes the push-up and vertical jump, making it lower impact while still spiking the heart rate and targeting the full body

Focus on core stability and shoulder control throughout the movement'),
  ('DB bench press', 'e1e2c9bb-7d58-4b4c-a91f-4b231f536c6e_gen.mp4', 'Lie flat on a bench with a dumbbell in each hand, feet planted firmly on the floor

Start with the dumbbells at chest level, elbows bent at about 90 degrees, and wrists stacked over elbows

Press the dumbbells up until your arms are fully extended, keeping a slight bend in the elbows at the top

Slowly lower the dumbbells back down under control, aiming for a stretch in the chest without letting elbows drop too far below the bench

Keep your shoulder blades retracted and pressed into the bench throughout the set

Avoid flaring your elbows too wide, aim for a 45-degree angle relative to your torso

Exhale as you press, inhale as you lower'),
  ('DB bent over rows', '61b5cc82-273b-4c73-b3a2-adf9c414ecd9_gen.mp4', 'Stand with feet hip-width apart, holding a dumbbell in each hand

Hinge at the hips with a slight bend in the knees, keeping your back flat and chest over the floor, spine should stay neutral

Let the dumbbells hang straight down with palms facing each other (neutral grip)

Pull the dumbbells toward your waist, driving your elbows back and keeping them close to your sides

Squeeze your shoulder blades together at the top, then lower the weights back down with control

Avoid rounding your back or using momentum, this is a strict row

Keep your core braced throughout to protect your lower back'),
  ('DB bicep curl with ISO hold', 'c70ef24b-98dd-4b6a-bb6c-a1a88362e45f_gen.mp4', 'Set Up
Grip: Hold a dumbbell in each hand with palms facing forward (supinated grip). Keep your arms fully extended at your sides.

Posture: Stand tall with feet shoulder-width apart. Engage your core, and maintain a neutral spine throughout the movement.

Starting Position: Hold the dumbbells with your elbows fully extended and close to your torso, making sure your arms are straight but not locked.

2. Execution (Curl + Isometric Hold)
Curl the Dumbbells: Begin by curling both dumbbells upwards, keeping your elbows close to your body.

ISO Hold (Mid-Curl): As you curl the weights, at the halfway point (where your forearms are parallel to the floor), pause and hold the position for a few seconds (usually 2-5 seconds). Keep your elbows fixed in place and avoid swinging the dumbbells.

Full Curl: After the isometric hold, continue curling the dumbbells up until your biceps are fully contracted, bringing the weights to shoulder height.

Controlled Return: Lower the dumbbells slowly, maintaining control through the eccentric (lowering) phase.

Repeat: After completing a rep, pause again at the midpoint on the next curl.'),
  ('DB box Step Ups', '7a1a977c-d6bf-4215-a7ee-4a3a5001f677_gen.mp4', 'Choose the Right Height: The box should be high enough so your working leg is at about a 90° angle when your foot is planted, but not so high that you have to launch yourself up.

Drive Through the Heel: Press through the heel of the foot on the box, not your toes. This keeps the focus on your glutes and quads.

Minimal Push From Back Leg: Use the front leg to lift yourself, not momentum or a hop from the back foot.

Stand Tall at the Top: Fully extend the working leg and squeeze the glute at the top before stepping back down.

Core Tight, Chest Up: Maintain a strong torso, don''t lean too far forward or collapse into the step.'),
  ('DB Bulgarian split squats', '6f2557f1-0b9b-42a0-b23c-25f01fb9a213_gen.mp4', 'Stand a few feet in front of a bench or sturdy elevated surface, holding a dumbbell in each hand at your sides

Place the top of your back foot on the bench, keeping your front foot flat and positioned far enough forward so you can drop into a deep lunge

Keep your chest lifted, shoulders back, and core tight

Lower your back knee toward the ground, aiming for 90 degrees in the front leg

Drive through the heel of your front foot to return to standing, don''t push off the back leg

Keep your knee tracking in line with your toes and avoid letting it cave inward

Maintain a slight forward lean to keep tension on the glutes

Complete all reps on one leg before switching'),
  ('DB curl to press', 'bedac3dd-a083-42e8-894d-51a4a54c8e20_gen.mp4', 'Start standing tall with a dumbbell in each hand, palms facing forward

Perform a controlled bicep curl, bringing the dumbbells to shoulder height

Without dropping the arms, rotate the palms outward and press both dumbbells overhead

Slowly reverse the movement, lower the weights back to shoulders, then control the curl down

Keep elbows tucked during the curl and stacked under wrists during the press

Maintain a strong core and avoid arching your lower back'),
  ('DB Curtsey lunges', '73ed1a4c-77ae-4bb5-82db-238110ae2471_gen.mp4', 'Hold a dumbbell in each hand at your sides with shoulders relaxed and chest up.
Stand with feet hip-width apart and keep your core braced throughout the movement.
Step one leg diagonally behind the body into a curtsey position.
Lower into the lunge by bending both knees while keeping the front heel grounded.
Keep the majority of your weight in the front leg to maximize glute engagement.
Push through the front heel to return back to the starting position.
Keep hips square and avoid rotating through the torso during the movement.
Maintain a neutral spine and avoid leaning excessively forward.
Keep the front knee tracking in line with the toes and avoid knee collapse inward.
Move with control and focus on feeling the glutes and outer glutes working throughout each rep.
Control the lowering phase and avoid using momentum to stand back up.'),
  ('DB deadlift to rows', 'b7d13787-2963-4ae5-9d2a-6782418a2f04_gen.mp4', 'Stand with feet hip-width apart, holding a dumbbell in each hand in front of your thighs

Hinge at the hips with a slight bend in the knees, lowering the dumbbells along your legs while keeping your back flat and core tight

Once your torso is nearly parallel to the floor, pause and perform a bent-over row, pull the dumbbells toward your waist, squeezing your shoulder blades together

Lower the dumbbells back down with control, then drive through your heels and squeeze your glutes to return to standing

Avoid rounding your back or using momentum during the row, this is a controlled, compound movement

Reset your hinge each rep to maintain proper form'),
  ('DB goblet squat', 'c0d68224-e61d-44d8-973d-491d0fd13b17_gen.mp4', 'Hold one dumbbell vertically at your chest with both hands, elbows tucked in

Stand with feet slightly wider than shoulder-width, toes slightly turned out

Brace your core and keep your chest tall

Lower into a squat by pushing your hips back and bending your knees, keeping the dumbbell close to your chest

Drive your knees out in line with your toes, don''t let them cave inward

Go as low as your mobility allows while maintaining a neutral spine and flat feet

Press through your heels to return to standing, squeezing your glutes at the top

Keep your torso upright and avoid letting the weight pull you forward'),
  ('DB good mornings', '4bf45c13-1212-499d-872a-d4f490abf288_gen.mp4', '1. Set Up
Feet: Stand hip-width apart with knees slightly bent. Your feet should be flat on the ground.

Dumbbells: Hold a dumbbell in each hand, with arms hanging straight down by your sides, or hold one dumbbell with both hands in front of your chest (goblet position).

Core: Engage your core and maintain a neutral spine throughout the movement.

2. Hip Hinge (Descent)
Push hips back: Start the movement by pushing your hips back, not by bending your knees too much.

Torso Lowering: As you push your hips back, lower your torso toward the ground, keeping your back straight. Your torso should move toward a 90-degree angle to the floor (or as far as your hamstring mobility allows).

Dumbbell Path: If holding dumbbells by your sides, let them hang straight down. If using a goblet position, keep the dumbbell close to your chest.

Knee Flexion: Keep knees slightly bent (don''t lock them), and keep your weight on your heels.

3. Return to Standing (Ascent)
Hip Drive: Reverse the motion by driving your hips forward (not pulling with your back) to return to standing.

Keep Back Neutral: Ensure your spine stays straight and your chest stays up as you return to the standing position. Avoid rounding your back.

4. Breathing
Inhale as you lower your torso.

Exhale as you return to the top.'),
  ('DB half burpee to row', '45eac235-e9d8-4714-98f3-8cf99d5dd28a_gen.mp4', 'Start with a dumbbell in each hand, placed on the floor shoulder-width apart

From a standing position, jump or step back into a high plank, hands gripping the dumbbells

Keep your feet wider than hips for balance, and core tight to prevent hip sway

Perform a single-arm row on each side, pull the dumbbell toward your ribcage, elbow close, then switch

After the row, jump or step your feet back in toward the dumbbells

Return to standing or repeat immediately for the next rep

Keep your spine neutral, shoulders over wrists, and control the row, no twisting'),
  ('DB Lateral Lunges', 'dd78069f-e376-4aee-916f-89d52b230360_gen.mp4', 'Stand tall with one dumbbell held vertically with both hands, arms extended down in front of your body

Step out wide with one leg, keeping the opposite leg straight

Push your hips back and bend the stepping knee, lowering into a lateral lunge

The dumbbell should stay centered, hanging straight down between both legs, do not let it pull you forward

Keep your chest lifted, spine neutral, and core engaged

Drive through the heel of the working leg to push back to the starting position

Maintain control and balance, no bouncing or shifting weight into the toes

Complete all reps on one side before switching, or alternate sides depending on your programming'),
  ('DB Lateral Raises', '7fd66462-4369-4a20-8c7e-4a96a9b89168_gen.mp4', 'Stand tall with a dumbbell in each hand, arms at your sides, palms facing in

Keep a slight bend in your elbows and engage your core

Raise both arms out to the sides until they reach shoulder height, wrists, elbows, and shoulders should form a straight line

Pause briefly at the top, then lower with control, don''t let the weights drop

Keep your traps relaxed, don''t shrug your shoulders up

Avoid swinging or using momentum; lift with the delts, not the traps or back'),
  ('DB marches', '5d4bc8b1-7d96-40fe-9878-bd0179fd4936_gen.mp4', 'Setup:
Stand tall holding a dumbbell in each hand at your sides or in front rack position. Brace your core and keep shoulders back.

Movement:
Lift one knee to hip height, pause briefly, then lower and alternate legs. Keep your torso upright and hips level throughout.'),
  ('DB plank pull thru', 'cbbf7876-1f4e-40f1-8ba8-9b4f8dddbece_gen.mp4', 'Set up in a high plank position with a dumbbell placed just outside one hand

Feet should be wider than hips to increase stability

While maintaining your plank, reach across with the opposite hand, grab the dumbbell, and drag it underneath to the other side

Keep your hips square and avoid letting them rotate or sway, core stays tight

Plant your hand back down and repeat with the other arm

Exhale as you pull, inhale as you reset

Move with control, don''t rush the reps or let the dumbbell slide too far out

Shoulders stay stacked over wrists, glutes engaged, and spine neutral'),
  ('DB Rdl Into alt reverse lunges', 'a2dabf86-98ff-4132-8013-87731426ed4b_gen.mp4', 'Hold a dumbbell in each hand at your sides, palms facing your body

Begin with a Romanian Deadlift:

Hinge at the hips, keeping a soft bend in the knees

Keep your back flat and dumbbells close to your legs as you lower until you feel a stretch in your hamstrings

Drive through your heels and squeeze your glutes to return to standing

From the top of the RDL, step one foot back into a reverse lunge

Lower until both knees are at 90 degrees, keeping your torso upright and front heel grounded

Push through the front heel to return to standing'),
  ('DB RDLs', '2599e874-a81c-4b7c-af9c-509a983e4c89_gen.mp4', 'Hold a dumbbell in each hand with your palms facing your thighs.
Keep a slight bend in your knees and brace your core.
Push your hips back while lowering the dumbbells down the front of your legs.
Keep your back flat and the dumbbells close to your body throughout the movement.
Lower until you feel a stretch in your hamstrings.
Drive your hips forward to return to the starting position and squeeze your glutes at the top.
Avoid rounding your back or turning the movement into a squat.'),
  ('DB Rdls to curl', '2d7a5fd1-c3a5-49d6-a04a-8bd66b0cd5a8_gen.mp4', 'Stand with feet hip-width apart, holding a dumbbell in each hand in front of your thighs, palms facing your body

Perform a Romanian Deadlift:

Hinge at the hips with a slight bend in the knees

Keep dumbbells close to your legs, back flat, and core tight as you lower until you feel a stretch in your hamstrings

Squeeze your glutes and return to standing

At the top of the RDL, rotate palms to face forward and perform a controlled bicep curl

Keep elbows close to your sides and avoid swinging

Lower the dumbbells back down with control, rotate back to neutral grip, and repeat

Focus on clean transitions between movements and maintaining tension throughout'),
  ('DB Reverse flys', '96e6ab67-23b8-4d2a-a88e-513e3b55d02a_gen.mp4', 'Stand with feet hip-width apart, holding a dumbbell in each hand

Hinge at the hips with a flat back and slight bend in the knees, torso should be nearly parallel to the floor

Let the dumbbells hang beneath your chest with palms facing each other

With a slight bend in the elbows, squeeze your shoulder blades together and raise the dumbbells out to the sides

Pause at the top, then slowly lower the weights back down with control

Avoid using momentum, this is a small, controlled movement

Keep your neck neutral and avoid shrugging

Focus on isolating the rear delts by moving from the shoulders, not the traps or lower back'),
  ('DB reverse lunge with knee drive', 'd7e1db13-ddc3-45b0-aac8-9aa5fd46c760_gen.mp4', '1. Set Up
Grip: Hold a dumbbell in each hand with arms at your sides, palms facing inward.

Feet: Stand with your feet hip-width apart, posture tall, and core braced.

2. Perform the Reverse Lunge
Step one leg back into a reverse lunge, keeping the front knee over the ankle and lowering your hips until the back knee is just above the ground.

Make sure the back knee moves straight down, not forward.

Keep your chest upright, core tight, and both knees tracking straight ahead (no inward collapse).

Depth: Aim to bring your back knee close to the ground but avoid letting your front knee push past your toes.

3. Knee Drive
Push through the heel of your front foot to return to the standing position.

As you rise, drive the back leg knee up toward your chest in a high knee drive.

Engage your core and keep your posture tall as you balance on the standing leg.

4. Breathing
Inhale as you step back into the lunge.

Exhale as you return to standing and drive your knee up.'),
  ('DB shoulder shrugs', '73427365-ba74-4989-9027-1ffc86ef6415_gen.mp4', 'Stand tall with a dumbbell in each hand, arms hanging at your sides, palms facing in

Keep your shoulders relaxed, chest lifted, and core engaged

Raise your shoulders straight up toward your ears, avoid rolling them

Squeeze the traps at the top for 1-2 seconds

Slowly lower your shoulders back down with control

Avoid using momentum or bending your elbows, let the traps do the work

Maintain a neutral spine and keep your gaze forward throughout the set

Focus on range and tension, not speed or heavy weight that breaks form'),
  ('DB Sit Ups', '65b8ccd2-e097-4382-afd3-d5ff98d8d02c_gen.mp4', 'Lie on your back with knees bent and feet flat on the floor

Hold one dumbbell against your chest or straight above your chest with arms extended (for added difficulty)

Engage your core and press your lower back into the floor before initiating the movement

Exhale as you sit all the way up, keeping the dumbbell stable

If holding overhead, keep arms extended as you sit up, don''t swing the weight

Lower yourself back down with control, avoiding any momentum or crashing

Keep your feet grounded and avoid using your hips to yank yourself up'),
  ('DB Skull Crushers', '8edc22ef-5dc8-4d3d-b0d7-b54d6f4d817b_gen.mp4', 'Lie flat on a bench (or the floor if needed) with a dumbbell in each hand

Start with arms extended above your chest, palms facing each other (neutral grip)

Keep your elbows tucked and locked in place, only your forearms should move

Slowly bend your elbows to lower the dumbbells toward your temples or just outside your ears

Pause briefly, then extend your arms back to the starting position, squeezing your triceps at the top

Move in a controlled manner, avoid flaring the elbows or letting the dumbbells drift too far back

Keep your core engaged and shoulders pressed into the bench to prevent arching

Great for isolating the triceps and building arm definition'),
  ('DB Squat Press', '57dbbd4b-0f6a-482e-a421-f7f2a89e7ea8_gen.mp4', 'Hold a dumbbell in each hand at shoulder height, elbows bent, feet shoulder-width apart

Engage your core and squat down, keeping your chest tall and knees tracking over your toes

Drive through your heels to stand up and press the dumbbells overhead in one fluid motion

Fully extend your arms at the top, then bring the dumbbells back to shoulder level

Control the descent into your next squat, avoid rushing'),
  ('DB Sumo 1¼ Squat', '973628a6-40c8-44a0-bdd5-905eb72a9cb1_gen.mp4', 'Hold a dumbbell and take a wide sumo stance with your toes slightly turned out.
Lower into a full squat.
Come up ¼ of the way.
Lower back into the squat.
Then drive through your heels and stand all the way up.
Keep your chest tall, core engaged, and knees tracking over your toes throughout the movement.'),
  ('DB sumo RDL to Squat', '24952d27-fc5c-4fd6-b9e3-6f456d743917_gen.mp4', 'Setup:
Wide sumo stance, toes slightly out. Hold dumbbells at arm''s length in front of you. Brace core, shoulders back.

RDL Phase:
Hinge at the hips, pushing them back with soft knees. Keep a flat back and lower the dumbbells to mid-shin. Feel the stretch in hamstrings and glutes.

Squat Phase:
From the bottom of the RDL, drop into a deep sumo squat. Keep chest up, knees tracking over toes.

Return:
Push through the full foot to stand tall. Squeeze glutes at the top.'),
  ('DB sumo RDLs', '608a73cf-5e11-4a9e-9486-a6185c682a4d_gen.mp4', 'Stand with feet wider than shoulder-width, toes slightly turned out

Hold one dumbbell with both hands, arms extended straight down between your legs

Keep a soft bend in the knees and brace your core

Hinge at the hips, push your hips back as the dumbbell lowers down the centerline of your body

Keep your spine neutral, chest lifted, and dumbbell close to your body throughout

Go down until you feel a deep stretch in your hamstrings and inner thighs, then pause

Drive through your heels to stand up, squeezing your glutes at the top

Avoid rounding the back or turning it into a squat, the motion should come from the hip hinge

Control every rep, no bouncing at the bottom'),
  ('db sumo squat', '6a3eddc7-072e-4eea-b081-86bb828ac614_gen.mp4', 'Stand with feet wider than shoulder-width apart, toes turned slightly outward

Hold one dumbbell vertically with both hands, letting it hang straight down between your legs

Keep your chest up, shoulders back, and core braced

Lower your hips straight down between your heels, keeping knees tracking in line with toes

Go as low as your mobility allows without letting the heels lift or the chest collapse

Drive through your heels to return to standing, squeezing the glutes at the top

Maintain a neutral spine and avoid leaning forward, keep the dumbbell centered

Great for targeting inner thighs and glutes while reinforcing squat depth and control'),
  ('DB Sumo Squat Swing', '93504d0d-70f2-43c8-a961-83483622083b_gen.mp4', 'Stand with feet wider than shoulder-width, toes turned slightly out

Hold one dumbbell with both hands (gripping the top of the handle or around one end) in front of your body

Drop into a sumo squat by pushing your hips back and lowering the dumbbell between your legs

As you drive through your heels to stand, swing the dumbbell up to shoulder height with straight arms

Use your hips and glutes to generate the swing, this is a hip-driven movement, not a front raise

Let the dumbbell naturally swing back between your legs as you drop into the next squat

Keep your chest tall, core tight, and knees tracking with toes

Control the momentum and keep movement fluid and powerful'),
  ('DB Toe Touches', '31184632-7852-4870-bcab-c0d9456a4782_gen.mp4', 'Lie flat on your back with both legs extended straight up toward the ceiling

Hold one dumbbell with both hands, arms extended straight above your chest

Keep your core braced and your lower back pressed into the floor

Crunch upward by lifting your shoulder blades off the ground and reaching the dumbbell toward your toes

Exhale as you lift; focus on using your abs to initiate the movement, not swinging the weight

Keep arms mostly straight and avoid jerking or using momentum

Slowly lower your upper body back down with control, maintaining tension in the core

Keep legs straight and stable throughout the movement'),
  ('DB Tricep Extension', '7f2fee62-5e4b-4a0c-8991-1266720590d6_gen.mp4', 'Sit or stand tall with feet planted and core engaged

Hold one dumbbell vertically with both hands, palms cupped under the top weight plate (diamond grip)

Press the dumbbell straight overhead, keeping elbows close to your ears and biceps by your head

Lower the dumbbell behind your head by bending only at the elbows, upper arms should stay fixed

Go as deep as your range allows without letting the elbows flare out

Press back up by extending the arms fully, squeezing the triceps at the top

Keep your ribs down and avoid arching your lower back

Move with control, don''t let the dumbbell swing or bounce'),
  ('DB tricep kickbacks', 'eeee8361-eab0-4c66-877a-f1e8cef1197c_gen.mp4', 'Hold a dumbbell in each hand and hinge at the hips, keeping a flat back and soft bend in the knees

Pull your elbows up so your upper arms are parallel to your torso, lock them in place

Extend your arms straight back, squeezing the triceps at full extension

Slowly return to the start position without letting the elbows drop

Keep your core engaged, chest lifted, and neck neutral

Exhale as you kick back, inhale as you return

Avoid swinging, the movement comes from the elbows, not the shoulders'),
  ('DB upright row to lateral raise', '02de8442-10cb-4c30-90b0-6bb385638a7e_gen.mp4', 'Begin with an upright row:

Pull the dumbbells up toward chest height, leading with your elbows

Keep the dumbbells close to your body, elbows above wrists

Lower the dumbbells back down with control

Immediately go into a lateral raise:

With a slight bend in your elbows, raise the dumbbells out to your sides until they reach shoulder height

Pause at the top, then slowly lower back down

Alternate between one upright row and one lateral raise per rep

Avoid swinging or using momentum, control each movement and stay braced through your core

Keep your traps relaxed during the lateral raise to isolate the delts'),
  ('Dead bugs', 'c304948d-a5c3-4230-8108-66471fc0a22b_gen.mp4', 'Start Supine in 90/90: Lie on your back with arms extended straight up and knees bent at 90°, stacked directly over your hips.

Brace Your Core: Before you move, flatten your lower back into the mat and brace your core, like you''re preparing to take a punch. No gap under the lower back.

Opposite Arm & Leg Extend: Slowly extend your right arm and left leg toward the floor at the same time, moving slow and controlled.

Keep Hips & Ribs Locked: Your ribs should stay down and hips square. No arching or flaring of the lower back. If your back lifts, reduce range or pause and re-brace.

Exhale on Extension: Exhale deeply as you reach, focusing on core compression. Inhale as you bring everything back in.

Reset & Alternate: Return to center with control, then repeat on the other side. Keep tension the entire time, no limp limbs or flailing.

Progress or Modify:

Too easy? Add a band or hold a stability ball between knees and hands.

Too hard? Tap the heel to the floor instead of fully extending.'),
  ('Dead hangs', '0aa6de36-03ee-4583-b31b-8f44e2b116df_gen.mp4', 'Grip the pull-up bar with hands shoulder-width apart, palms facing forward or neutral.

Let your body hang fully extended with arms straight and shoulders slightly engaged (don''t let them shrug up to your ears).

Keep your core tight, legs together, and avoid swinging.

Hold for time while maintaining control and steady breathing.'),
  ('Double handed DB sumo squats', '107854ac-ae51-4969-bf39-9bb719aab7d4_gen.mp4', 'Wide Stance, Toes Out: Set your feet wider than shoulder-width with toes turned out ~30-45°. This opens the hips and shifts focus to the inner thighs and glutes.

Hold the Weight with Both Hands: Grip a dumbbell or kettlebell with both hands between your legs, arms extended straight but relaxed. Keep the weight close to your body.

Hinge & Drop: Push your hips back slightly, then drop straight down into a deep squat. Don''t lean forward, stay upright through the torso.

Keep Knees Out: Drive your knees outward over your toes as you descend. Don''t let them cave in, this keeps the inner thighs and glutes firing.

Chest Tall, Core Tight: Maintain a neutral spine and open chest. Brace your core like you''re preparing to take a punch.

Drive Through Heels: On the way up, push through your heels to engage the glutes and hamstrings. Squeeze the glutes at the top without hyperextending.

Control the Tempo: Slow and controlled, especially on the eccentric (lowering) portion. Use the weight for tension, not momentum.'),
  ('Double Handed Dumbbell Snatch', 'c048a00b-0ec8-442d-b266-3624c8b86a90_gen.mp4', 'Start with two dumbbells on the floor between your feet, stance shoulder-width apart.

Hinge at the hips and bend knees slightly, gripping a dumbbell in each hand with palms facing you.

Keep chest tall, back flat, core braced.

Explosively drive through the legs and hips, extending upward as you pull both dumbbells close to your body.

As the weights pass chest level, punch them overhead in one smooth motion, finishing with arms fully extended and biceps by your ears.

Keep heels grounded during the lift and finish tall through the hips.'),
  ('Double Kettlebell Marches (Standing)', '5e4f9f09-40ea-4e44-9b23-37042e675d2d_gen.mp4', 'Clean both kettlebells into a double rack position: elbows slightly forward, wrists neutral, handles resting lightly against the chest.

Stand tall with ribs stacked over hips, no arching or leaning back under the load.

Brace your core before each step like someone is about to hit your stomach.

Lift one knee to hip height slow and controlled without letting the torso sway or rotate.

Keep the kettlebells still, think "freeze the upper body, move from the hips."

Drive the foot into the floor on the standing leg to stay stable and tall.

Shorter, controlled marches > high sloppy marches.

Maintain steady breathing: inhale on the stance leg, exhale as you lift.'),
  ('Double pump barbell walking lunges', 'eab7ab75-bde8-4eda-8a25-6f25072195e6_gen.mp4', 'Start with a barbell resting across your upper back, feet hip-width apart.

Step forward into a lunge, lowering until both knees are bent at 90 degrees.

Pause at the bottom, drive halfway up, then lower back down for a controlled second dip.

Press firmly through the front heel to rise tall and bring the back leg forward into the next step.

Keep chest tall, core braced, and knees tracking over toes throughout the movement.

Maintain a steady rhythm as you continue alternating legs.'),
  ('Double pump DB walking lunges', '257dc40e-d5e6-4bc4-9c4b-784f8725095e_gen.mp4', 'Hold a dumbbell in each hand at your sides, palms facing in, arms straight.

Step forward into a full lunge, lowering until your back knee is just above the floor.

Drive up fully to standing without stepping through yet.

Immediately drop back down into another full lunge on the same leg.

After the second full rep ("double pump"), step forward into the next lunge on the opposite leg and repeat.

Keep chest lifted, shoulders back, and core tight throughout.

Front heel drives into the ground, avoid letting the front knee track inward or collapse forward.

Move with control, avoid bouncing, and maintain balance with a steady stride.'),
  ('Double Pump Sumo Squats (with Long Resistance Band)', 'd5f8e59c-c572-4ea9-b295-dda0abaccb76_gen.mp4', 'Stand on the band with a wide sumo stance, feet turned slightly outward.
Hold the top of the band at chest height with your elbows tucked under for tension.
Keep your chest lifted, core braced, and back neutral throughout the movement.
Lower into a deep squat, keeping your knees pushed out in line with your toes.
At the bottom, perform a small controlled double pulse (staying low), then drive through your heels to stand tall.
Focus on glute engagement and keeping constant tension in the band.
Avoid bouncing or letting momentum take over, control each rep.'),
  ('Dumbbell Hipthrust', 'f5e297aa-3e35-448d-ad34-0137cabb3ef1_gen.mp4', 'Sit on the floor with your upper back against a bench and feet flat, shoulder-width apart

Place a dumbbell across your hips, holding it securely with both hands

Drive through your heels to lift your hips, squeezing your glutes at the top

Your body should form a straight line from shoulders to knees at full extension

Pause and contract at the top, then lower down slowly and with control

Keep your chin tucked, ribs down, and core engaged throughout the movement

Exhale as you thrust up, inhale as you return down

Avoid hyperextending your lower back, focus on glute activation, not just hip height'),
  ('Dumbbell Jack Press', 'eff1050b-d7ad-436b-acd8-d23890b7b390_gen.mp4', 'Hold a light pair of dumbbells at shoulder height, palms facing forward

Start with feet together in a standing athletic stance

As you jump your feet out, simultaneously press the dumbbells overhead

As you jump feet back in, lower the dumbbells back to shoulder level, repeat in a rhythmic motion

Keep core braced, spine neutral, and land softly on the balls of your feet

Movement should be fluid, no pause between reps

Focus on control during the overhead press, don''t let the dumbbells swing or crash'),
  ('Dumbbell Jump Squat w/ Calf Raise', '6d97d98f-cb8a-4e75-9c9f-a7daa939207e_gen.mp4', 'Hold a dumbbell in each hand at your sides, palms facing in.

Stand with feet shoulder-width apart, chest tall, core braced.

Lower into a squat, hips back and down until thighs are at least parallel to the floor.

Explosively drive through the heels to jump upward, keeping dumbbells stable at your sides.

Land softly back into squat position, absorbing impact by bending the knees and hips.

Immediately rise onto the balls of your feet at the top of the landing, performing a controlled calf raise.

Reset into your next squat → jump → calf raise sequence.

Keep your chest upright, knees tracking over toes, and avoid leaning forward or letting dumbbells swing.'),
  ('Dumbbell KAS Glutebridges', 'b467a3a6-a5e8-49a5-95a6-0c74924bc304_gen.mp4', 'Sit on the floor with your upper back against a bench and knees bent, feet flat and under knees

Place a dumbbell across your hips and hold it in place

Unlike a traditional hip thrust, you''ll use a shorter range of motion, lift your hips just high enough to fully contract the glutes

Focus on a slow, controlled tempo, lift for 1-2 seconds, pause and squeeze at the top for 2-3 seconds, then lower slowly

Keep your ribs down, chin tucked, and core braced, no arching through the back

Feet should press through the heels; avoid pushing through the toes

Keep the dumbbell steady and avoid bouncing at the bottom'),
  ('Dumbbell Punches with a squat hold', '3682db45-b3fe-4e70-82ce-6e487d10ec83_gen.mp4', 'Begin in a bodyweight squat hold, feet shoulder-width apart, knees bent, hips pushed back, and chest upright

Hold light dumbbells at shoulder height, elbows in

Maintain the squat position and begin to alternate forward punches, fully extending each arm without locking out

Keep your lower body still, no bouncing or standing up

Core should stay tight to resist torso rotation and maintain balance

Focus on tempo and endurance, punch with purpose while keeping form crisp'),
  ('Dumbbell Squat into Alt Reverse Lunges (goblet hold)', 'aaed153d-a82d-47c0-8272-ec496212c2be_gen.mp4', 'Hold one dumbbell vertically in a goblet position (hands cupping the top end, dumbbell resting against chest).

Stand tall with feet shoulder-width apart, core tight, and chest lifted.

Perform a full squat: hips back and down until thighs are parallel (or deeper if mobility allows).

Drive through your heels to return to standing.

Immediately step one leg straight back into a reverse lunge, lowering until back knee hovers just above the floor.

Push through the front heel to return to standing.

Repeat the squat, then step back with the opposite leg into a reverse lunge.

Continue alternating sides, maintaining smooth transitions between squat and lunge.

Keep chest upright, knees tracking over toes in the squat, and avoid letting the front knee collapse inward on lunges.'),
  ('Dumbbell Squat to hammer curl', '6d55e893-1ca2-4dd6-94ce-255959e40487_gen.mp4', 'Hold a dumbbell in each hand with palms facing your sides (neutral grip)

Stand tall, feet shoulder-width apart, core engaged

Lower into a squat, hips back, chest up, knees tracking over toes, dumbbells hanging by your sides

Drive through your heels to stand up

At the top, perform a controlled hammer curl, elbows stay tucked, dumbbells move in a straight line

Slowly lower the dumbbells back down and flow into the next rep

Inhale as you squat, exhale on the curl

Keep movement smooth and connected, don''t swing the dumbbells or rush the transition'),
  ('Dynamic Warm-up', 'd42b9ad3-3a80-47b1-8197-815ec0739d19_gen.mp4', 'A dynamic warm-up is a series of active, movement-based stretches and exercises that prepare your body for a workout. Unlike static stretching (where you hold a stretch), dynamic warm-ups get your muscles warm, joints mobile, and heart rate elevated, all while moving.'),
  ('Elevated alt DB reverse lunges', '939e4030-e71e-4033-afdc-fc00f84ba7d2_gen.mp4', 'Start with a dumbbell in each hand, arms by your sides, standing tall with feet hip-width apart.

Place one foot on a stable elevated platform behind you (like a low step or bench) so you''re set up for a reverse lunge.

Step the front foot forward slightly and lower your back knee toward the floor, keeping the front knee tracking over your toes.

Pause at the bottom, then press through the front heel to return to standing, alternating legs each rep.

Keep chest tall, core engaged, and movement controlled, avoid leaning forward or letting the knee collapse inward.

Maintain steady breathing and focus on balance as you continue alternating legs.'),
  ('Elevated barbell alt reverse lunges', 'fc8914c1-e524-4606-b99a-22b8b62afac5_gen.mp4', 'Setup:

Barbell Placement:

Position the barbell on the upper back, just like a back squat, with the bar resting on the trapezius (not the neck).

Hands should be just outside shoulder-width with an overhand grip.

Foot Positioning:

Stand with feet hip-width apart, ensuring a strong, stable base.

Keep your chest up and shoulders retracted throughout the movement.

Execution:

Step Back:

Take a step back with one leg into a reverse lunge. Keep the back knee hovering just above the ground.

Ensure the front knee stays in line with the toes, not going past the toes.

Core engaged throughout the movement, maintaining an upright torso.

Drive Forward:

Push through the front heel and glute to return to standing, bringing the rear foot forward.

Alternate legs and repeat for the desired number of reps.'),
  ('Elevated barbell squats', '3b28fc99-3a1b-4980-93cf-34ca4c40a06c_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, toes slightly turned out. Place a small plate or wedge under your heels to elevate them slightly. Position a barbell across your upper back (not your neck), brace your core, and engage your glutes.

Drop With Control: Squat down by pushing your hips back and keeping your chest tall. Let your knees track over your toes, lowering until your thighs are parallel (or deeper if mobility allows). Keep your core tight and spine neutral.

Drive Through Heels: Push through your heels to return to standing, keeping the barbell stable on your back. Focus on controlled movement and full engagement of glutes and quads.

Finish Strong: Stand tall at the top with hips and glutes engaged. Reset and repeat for the next rep with control and proper form.'),
  ('Elevated Bulgarian split squat', 'e69657d2-7ae7-4358-86f8-cc045755e447_gen.mp4', 'Start With a Strong Base: Stand a couple of feet in front of a bench or elevated surface. Place the top of one foot on the bench behind you. Feet should be hip-width apart for balance. Hold a dumbbell or kettlebell at chest level (or by your sides) and brace your core.

Drop With Control: Lower your back knee toward the ground while keeping your front knee tracking over your toes. Keep chest tall and glutes engaged. Descend slowly to maintain control and tension.

Drive Through Front Heel: Push through your front heel to return to standing. Focus on engaging your glutes and quads, keeping the movement controlled and steady.

Finish Strong: Stand tall at the top with hips and glutes engaged. Reset your position and repeat for the other leg.'),
  ('Elevated Cable RDLS (french bar)', '9a8e678e-3e3a-474c-9b88-a7f602dd78cf_gen.mp4', null),
  ('Elevated Calf Raises', '1915271b-a1f5-4481-80a3-78ab3baf4741_gen.mp4', 'Start by standing on the edge of a sturdy platform or step with the balls of your feet, heels hanging off. Keep feet hip-width apart and core engaged.

Press through the balls of your feet to lift your heels as high as possible, fully contracting your calves.

Pause briefly at the top, squeezing the muscles.

Slowly lower your heels below the level of the platform to stretch the calves, keeping control throughout the movement.

Keep chest tall, shoulders relaxed, and maintain steady breathing.'),
  ('Elevated DB Reverse Lunges', 'd717c5c8-da85-40ec-bf67-81ea11e81b62_gen.mp4', 'Start Elevated: Stand on a low step or platform (2-4 inches). This elevation increases the range of motion and shifts more tension to the glutes.

Dumbbells by Your Sides: Keep the dumbbells controlled, no swinging. Shoulders relaxed, grip neutral, core engaged.

Controlled Step Back: Step one foot back slowly

Deep Lunge With Control: The elevation allows you to sink deeper into the lunge, maximize it without losing form. Light tap with the back knee (if mobility allows).

Knee Alignment: Front knee stays stacked over the ankle. Don''t let it drift too far forward or cave inward.

Drive Through the Heel: Push through the front foot''s heel to return to standing. You should feel this in your glutes and hamstrings.

Stay Tall: Chest up, back flat, and core tight, no leaning or collapsing at the bottom.

Alternate Smoothly: Control each rep instead of rushing. Balance, form, and tension over speed.'),
  ('Elevated KB sumo squat', '8ee3edc8-e94a-4d6f-a120-65f21beaf0bc_gen.mp4', 'Start With a Strong Base: Stand with feet wider than shoulder-width, toes pointing out at about 45 degrees. Place your heels on a small plate or wedge and hold a kettlebell at chest level. Brace your core and engage your glutes before you move.

Drop With Control: Squat down slowly, pushing your hips back and keeping your chest tall. Let your knees track over your toes and lower until your thighs are parallel (or deeper if mobility allows).

Drive Through Heels: Push through your heels to stand back up, keeping the kettlebell at chest level and chest upright. Maintain tension in your glutes and inner thighs.

Finish Strong: Stand tall at the top, fully engaging glutes and core. Reset and repeat, focusing on control and depth for each rep.'),
  ('Elevated KB Sumo Squats-Beginner', '2837892d-433e-4edd-bd5e-9b236126ea75_gen.mp4', 'Start With a Strong Base: Stand with feet wider than shoulder-width apart, toes pointing slightly outward. Place a small plate or wedge under your heels. Hold a kettlebell at chest level with both hands in a goblet position. Brace your core and engage your glutes.

Drop With Control: Squat down slowly, pushing your hips back and keeping your chest tall. Lower only as far as comfortable, ideally until thighs are roughly parallel to the ground. Let knees track over your toes.

Drive Through Heels: Push through your heels to stand, maintaining proper posture and keeping the kettlebell at chest level. Focus on controlled, steady movement.

Finish Strong: Stand tall at the top with glutes and core engaged. Reset and repeat for the next rep, keeping the movement smooth and controlled.'),
  ('Ez bar skull crushers', '62cd7079-8a02-4b5b-9520-69b63b79eea3_gen.mp4', 'Lie flat on a bench with feet planted and core engaged

Grip the EZ bar just inside shoulder width with palms facing up

Start with arms extended straight over the shoulders, elbows locked in place

Lower the bar toward the forehead or just behind the head by bending only at the elbows

Keep upper arms still, don''t let elbows flare or drift

Lower with control, then extend the elbows to press the bar back up

Squeeze the triceps fully at the top without locking out aggressively

Use a controlled tempo; ego lifting defeats the purpose

Cue: "Elbows in, hinge at the elbows, long triceps stretch"'),
  ('Ez bar upright rows', '6ae20a0b-60f3-4c4f-bd32-eeadc5ee088d_gen.mp4', 'Grip the EZ bar with hands just outside shoulder-width (angled grips help reduce wrist strain).

Start with the bar resting against the thighs, arms fully extended, chest tall.

Brace the core and pull the bar straight up along the body, keeping it close.

Lead the movement with the elbows, driving them up and slightly out.

Stop the pull when elbows reach shoulder height, don''t force higher range.

Pause briefly at the top to control the movement and feel the shoulders/traps.

Lower the bar slowly back to the thighs (2-3 second negative).

Avoid swinging, jerking, or using momentum, this is controlled, not explosive.'),
  ('Farmer carry’s', '382e8555-b317-4eda-8d78-c0153dc55475_gen.mp4', 'Start by standing tall with a dumbbell or kettlebell in each hand, arms fully extended by your sides, palms facing inward. Feet should be hip-width apart and core braced.

Engage your shoulders, keeping them back and down, and maintain a tall, upright posture.

Walk forward in a controlled manner, taking steady, deliberate steps. Keep your chest lifted and eyes forward.

Avoid leaning side to side or letting the weights swing; focus on keeping the core tight and shoulders stable.

Continue for the prescribed distance or time, maintaining proper posture throughout.'),
  ('Flutter Kicks', '605b6d22-0cd8-4458-9a40-2d100ba8cbf3_gen.mp4', 'Start by lying flat on your back with your legs extended and arms by your sides or under your glutes for support. Engage your core and press your lower back gently into the floor.

Lift both legs a few inches off the ground, keeping them straight and toes pointed.

Alternate kicking your legs up and down in a controlled, scissor-like motion. One leg moves upward while the other moves downward.

Keep your core tight and lower back pressed into the floor throughout the movement. Avoid letting your legs drop too low if it causes your back to arch.

Maintain steady breathing and a smooth rhythm, focusing on core engagement rather than speed.'),
  ('Forward lunge', 'c4ec65d0-4508-4c3d-a56f-c2b88e98fa82_gen.mp4', 'Start by standing tall with feet hip-width apart, core engaged, and chest lifted. Arms can be at your sides or on your hips for balance.

Step forward with your right foot, lowering your body until both knees are bent at roughly 90 degrees. Keep the front knee tracking over your toes and the back knee hovering just above the floor.

Press through the heel of your front foot to return to the starting position.

Alternate legs with each rep, maintaining control and steady breathing throughout.

Keep torso upright, core tight, and avoid leaning forward or letting the front knee collapse inward.'),
  ('Frogers', '170dcef5-88e7-4725-9c23-5265ab6c7272_gen.mp4', 'Start in a push-up position with hands directly under your shoulders and legs extended behind you. Keep your core tight and body in a straight line from head to heels.

Jump both feet forward toward your hands, landing softly just outside your hands in a low squat position.

Immediately jump your feet back to the starting push-up position.

Keep movements controlled but quick, maintaining a strong core and steady breathing throughout.

Focus on soft, precise landings and proper form rather than speed.'),
  ('Front squat (long resistance band)', '300a831f-d181-40b8-809c-29afc3051f9d_gen.mp4', 'Stand on the band with feet shoulder-width apart.
Bring the top of the band up to your shoulders, crossing your arms in front to secure it (like a front rack position).
Keep your elbows high, chest lifted, and core braced.
Squat down by pushing your hips back and bending your knees, keeping your weight in your heels.
Go as low as your mobility allows while maintaining a flat back.
Drive through your heels to return to standing, squeezing your glutes at the top.'),
  ('Full body stretch', '25406cbe-6ac5-4935-a3ac-99eef110fc0a_gen.mp4', 'Start by standing tall with feet hip-width apart and arms relaxed by your sides. Engage your core and roll your shoulders back gently.

Reach both arms overhead, stretching toward the ceiling, elongating your spine.

Lean slightly to the right, feeling a stretch along your left side, then return to center. Repeat on the left side.

Slowly hinge at the hips and reach toward your toes, keeping knees soft if needed, stretching the hamstrings and lower back.

Finish by gently rolling up to standing, then open your arms wide and back, stretching the chest and shoulders.

Focus on controlled breathing, holding each position for 10-20 seconds, and feeling a gentle stretch without strain.'),
  ('Glute hyperextension', '73834a3b-0f00-4c46-85d3-df50eaf5ca03_gen.mp4', 'Start by lying face down on a hyperextension bench or glute-ham developer, securing your feet under the footpads. Hips should be just above the pad, and hands can be crossed over your chest or behind your head.

Engage your core and glutes, keeping your back neutral, and slowly lower your upper body toward the floor.

Contract your glutes and hamstrings to lift your torso until your body forms a straight line from head to heels.

Pause at the top, then lower back down with control, maintaining proper form throughout.

Focus on smooth, controlled movements and avoid hyperextending the lower back.'),
  ('Glute medius 45 degree cable kickbacks', '2e0f03d2-6218-4aae-9bd2-ee15a3d6501f_gen.mp4', 'Start Sideways to the Cable Stack: Strap the ankle cuff to your working leg and face perpendicular to the machine.

Cross the Non-Working Leg Over: Bring your non-working leg in front of the working leg, stepping it slightly across the midline of your body. This forces the working leg to kick out at a more isolated lateral angle.

Hinge Slightly & Brace: Soft bend in the knees, hinge forward slightly, and keep your core tight. Hold the machine lightly for balance. (standing on a plate will help with avoiding the working leg from dragging on the ground)

Kick Back & Out (Diagonal Line): Drive the working leg up and out at a 45-60° angle behind you, around the front leg. Keep the motion smooth and controlled.

Toes Down, Heel Leads: Keep the toes pointed toward the ground and lead with your heel to target the glute medius more than the glute max.

Pause at the Top: Squeeze hard at the peak, this variation forces a stronger contraction in the outer glute.

Return with Control: Resist the return. Don''t swing or rush, keep tension throughout.

Square Hips = Clean Form: Your hips and chest should stay square, no twisting or rotating to cheat the rep.'),
  ('Glutebridge Hold', '96b9e190-a8fc-4517-ba91-e88c08b914fc_gen.mp4', 'Start by lying on your back with knees bent, feet flat on the floor hip-width apart, and arms resting by your sides. Engage your core.

Press through your heels to lift your hips toward the ceiling until your body forms a straight line from shoulders to knees.

Squeeze your glutes at the top and hold the position, keeping your core tight and lower back neutral.

Avoid overextending your back; focus on glute activation and maintaining a steady, controlled hold.

Slowly lower your hips back to the floor when the hold is complete, reset, and repeat if doing multiple sets.'),
  ('Glutebridges', '06c33961-450b-4157-84b8-5640460376b0_gen.mp4', 'Start by lying on your back with knees bent, feet flat on the floor hip-width apart, and arms resting by your sides. Engage your core.

Press through your heels to lift your hips toward the ceiling until your body forms a straight line from shoulders to knees.

Squeeze your glutes at the top, hold for a moment, then slowly lower your hips back to the floor with control.

Keep your chest lifted, core tight, and avoid overextending your lower back.

Repeat for the prescribed number of reps, maintaining steady breathing and smooth movement throughout.'),
  ('Good mornings (long resistance bands)', 'eee91e05-9794-4c59-b4ac-c9931b2eb5f9_gen.mp4', 'Step onto the band with both feet shoulder-width apart.
Loop the other end of the band around the back of your neck/traps (not directly on the neck).
Stand tall with a soft bend in your knees and core braced.
Hinge at the hips, sending your glutes back while keeping your back flat and chest lifted.
Lower until you feel a strong stretch in the hamstrings, then squeeze your glutes to return to standing.
Avoid rounding your spine, maintain a neutral back throughout.
Keep tension in the band the entire time.'),
  ('Gorilla Squats', '16ec13c9-64dd-48e9-a684-8fd61d4afed2_gen.mp4', '1. Set Up
Feet Position: Start with your feet slightly wider than shoulder-width apart, with toes pointed slightly outward.

Hands: Keep your arms hanging down between your legs, ready to explode upward. You can optionally hold onto a weight (e.g., dumbbell, kettlebell) for extra challenge, or do it bodyweight.

2. Squat Descent
Start by pushing your hips back and lowering your body into a deep squat. Your hands should travel down to the floor, between your legs.

Keep your chest upright, core engaged, and make sure your knees are tracking over your toes (don''t let them cave inward).

Aim to get your hips below parallel to fully activate the glutes and hamstrings.

3. Explosive Jump
From the bottom of the squat, explode upwards with force, jumping as high as possible.

As you jump, reach for the sky with your hands (this adds to the explosive energy).

Land softly, absorbing the impact through your legs, and immediately go back into the next squat.

4. Breathing
Inhale as you squat down.

Exhale as you explode upward into the jump.'),
  ('Greatest stretch in the world', '4dc49ec9-0ee2-4809-bee8-bcd0ac6de303_gen.mp4', 'Start in a Lunge: Step one foot forward into a deep lunge, knee stacked over ankle, back leg extended long behind you.

Inside Elbow Drop: Bring both hands down inside the front foot, then lower the same-side elbow (as front leg) toward the floor. Hold for a deep hip and groin stretch.

Thoracic Rotation: Lift that same arm up and rotate through the spine, reaching toward the ceiling. Eyes follow your hand to deepen the twist.

Hamstring Extension: Shift your hips back and straighten the front leg slightly to stretch the hamstring. Keep the spine long, no rounding.

Stay Controlled: Don''t rush through it, each phase should feel intentional. Breathe into tight areas and move mindfully.

Switch Sides Smoothly: Step back into a plank or step through to repeat on the other side.'),
  ('Half burpee to DB shoulder press', '86561f2d-bda0-426c-99e4-3667b5200313_gen.mp4', 'Start standing with a dumbbell in each hand at shoulder height, feet hip-width apart, and core engaged.

Hinge at the hips and place the dumbbells on the floor (or just set them down safely), stepping one foot back at a time into a plank position. Keep your core tight and back flat.

Step your feet forward toward your hands, returning to a low squat position.

As you rise to standing, grab the dumbbells if you set them down, and press them overhead in a controlled shoulder press.

Lower the dumbbells back to shoulder height and repeat, maintaining smooth, steady movements.

Keep chest tall, core braced, and knees tracking over toes throughout the exercise.'),
  ('Half Burpee to Jump Squat', '0be46a72-69cc-41f2-9642-f2fbdff7066e_gen.mp4', 'Start Strong: Stand with feet shoulder-width apart. Brace your core and engage your glutes before you move.

Drop Into a Half Burpee: Bend at the hips and place your hands on the ground, stepping or jumping your feet back slightly, no full push-up needed.

Jump Forward: Step or hop your feet back toward your hands, returning to a squat position.

Explosive Jump Squat: From the squat, drive through your heels and explode upward into a jump. Land softly with knees slightly bent to absorb impact.

Reset and Repeat: Return to standing, maintain control, and continue for the next rep. Focus on smooth transitions and explosive power.'),
  ('Half Burpees', 'ed34e74c-263a-49b4-835c-b4969798349d_gen.mp4', 'Start in a standing position with feet hip-width apart, arms relaxed by your sides.

Hinge at the hips and place your hands on the floor in front of you, stepping one foot back at a time into a plank position. Keep your core engaged and back flat.

Step your feet forward one at a time back toward your hands, returning to a low squat position.

Rise to standing, reaching your arms overhead or clapping hands if desired, finishing tall and controlled.

Maintain steady breathing and smooth, controlled movements throughout. Focus on form rather than speed.'),
  ('Hallow hold', '5f03b513-352c-4759-8af6-2397b2f3e054_gen.mp4', '1. Set Up
Start Position: Lie flat on your back with your arms extended overhead and legs straight.

Core Engagement: Engage your core by pulling your belly button toward your spine. This will protect your lower back.

Limb Position:

Raise your legs slightly off the ground (about 6 inches) and point your toes.

Lift your shoulders and head off the floor while keeping your arms extended overhead.

Your lower back should be pressed into the ground to avoid any arching.

2. Execution (Hold)
Hold the Position: Hold the hollow position with your body in a slight curve (like a "banana shape"), with the lower back pressed into the ground.

Arms & Legs: Keep your arms extended in front of your head and legs extended, with your core braced tight.

Engage the Core: Maintain tension in your core to keep your legs and torso off the ground.

Breathing: Breathe steadily but don''t let your posture break. Exhaling deeply can help maintain core tension.'),
  ('Hanging Knee Tucks with Medicine Ball', '79cf9803-4f7b-434d-ab03-a37f6b77731b_gen.mp4', 'Hold a medicine ball securely between the knees or ankles before hanging.

Grip the bar firmly, start in a dead hang with shoulders engaged (slight scapular depression).

Brace the core and tuck the knees up toward the chest, keeping the movement controlled.

Focus on curling the pelvis upward at the top to fully engage the lower abs.

Pause briefly at the top to prevent swinging.

Lower the legs slowly back to the start (2-3 second negative).

Keep the upper body quiet, avoid excessive swinging or kip momentum.

Maintain steady breathing; exhale as knees come up.'),
  ('Heel elevated banded squats', 'cb49d19d-9f03-446b-87a1-c55a25254eff_gen.mp4', 'Start With a Strong Base: Stand with heels elevated on a small plate or wedge, feet shoulder-width apart, toes slightly turned out. Place a resistance band just above your knees. Brace your core and engage your glutes before you move.

Drop With Control: Squat down slowly by pushing your hips back and keeping your chest tall. Let your knees track over your toes and push outward against the band for extra glute and hip activation. Lower until your thighs are at least parallel to the ground.

Drive Through Heels: Push through your heels to return to standing, maintaining tension on the band and keeping the chest upright. Focus on controlled movement and glute engagement.

Finish Strong: Stand tall at the top with glutes and core fully engaged. Reset and repeat for the next rep, maintaining slow, controlled tempo throughout.'),
  ('Heel elevated front squats', '79f20dc4-5a15-4b46-aa60-bce97d530879_gen.mp4', 'Setup:

Feet: Shoulder-width apart, toes slightly out. Elevate heels on a slant board or plates (1-2 inches).

Barbell: Position bar on anterior deltoids (not neck). Elbows high, creating a "shelf" for the bar. Fingers under the bar, hands just outside shoulder-width.

Posture: Chest proud, core braced (like you''re about to get punched), spine neutral.

Execution:

Descent:

Break at hips and knees simultaneously. Allow knees to track forward over toes.

Keep torso upright and elbows high to maintain proper front rack position.

Go deep, aim for hips below parallel.

Ascent:

Push through midfoot, leading with elbows and extending hips/knees together.

Finish tall, locking out at the top with a neutral spine.'),
  ('Heel elevated goblet squat', 'c003fbdc-08eb-4538-89e9-5de2577f73fd_gen.mp4', 'Start With a Strong Base: Stand with your heels on a small plate or wedge, feet slightly wider than hip-width, toes pointing slightly out. Hold a dumbbell or kettlebell at chest level, brace your core, and engage your glutes.

Drop With Control: Squat down slowly, pushing your hips back and keeping your chest tall. Let your knees track over your toes, lowering as deep as your mobility allows.

Drive Through Heels: Push through your heels to return to standing, keeping the chest upright and the dumbbell at chest level. Focus on controlled movement rather than speed.

Finish Strong: Stand tall at the top, fully engaging your glutes and core. Reset and repeat for the next rep with the same control and focus.'),
  ('Heel elevated medicine ball squats', '3998d6a1-7801-4472-94f4-1b8d1886fe2f_gen.mp4', 'Start With a Strong Base: Stand with heels on a small plate or wedge, feet shoulder-width apart, toes slightly turned out. Hold a medicine ball at chest level. Brace your core and engage your glutes before you move.

Drop With Control: Squat down slowly by pushing your hips back and keeping your chest tall. Let your knees track over your toes and lower until your thighs are at least parallel to the ground.

Drive Through Heels: Push through your heels to stand back up, keeping the medicine ball close to your chest. Focus on controlled movement and proper squat mechanics.

Finish Strong: Stand tall at the top with glutes and core fully engaged. Reset and repeat for the next rep, maintaining steady control and proper form throughout.'),
  ('High Knees', '6d795242-8a41-422f-93aa-711b3073d6c2_gen.mp4', 'Set Up
Feet Position: Stand tall with your feet hip-width apart.

Core Engagement: Engage your core, keeping your posture upright.

Arm Position: Keep your arms bent at 90 degrees, with elbows close to your body, as you''ll use them to help drive the movement.

2. Execution
Knee Drive: Start by quickly driving one knee up towards your chest as high as you can, aiming for your hip level or higher.

Alternate Legs: As the first knee comes down, immediately drive the opposite knee up in a fast, continuous rhythm.

Arm Action: As your knees come up, your arms should naturally pump in sync (left knee up, right arm swings forward).

Pace: Keep a fast pace, this is a cardio-based movement, so aim for speed while maintaining control of the movement.

Foot Placement: Ensure each foot lands softly on the ground with minimal impact.'),
  ('High Plank Hold', '04a3cf4d-e61f-4a8d-b047-08864a8d745d_gen.mp4', 'Start on the floor with hands directly under your shoulders and feet hip-width apart. Keep your body in a straight line from head to heels.

Engage your core by drawing your belly button toward your spine and squeezing your glutes.

Keep your shoulders down and back, avoiding shrugging toward your ears.

Hold the position, maintaining a neutral neck and spine, and breathe steadily throughout.

Focus on keeping your hips level, avoid sagging or lifting them too high.'),
  ('In & Out Crunches (with Dumbbell)', '61f3ceec-9afa-4cef-8423-6846fdccd9db_gen.mp4', 'Sit upright with your hands planted firmly on the floor beside your hips for balance.
Hold a dumbbell securely between your feet or ankles.
Keep your chest tall and core braced.
Extend your legs forward with control, keeping them elevated off the ground.
Bring your knees back in toward your chest without touching the floor.
Maintain tension in your core, avoid rocking or leaning back.'),
  ('In And Out Crunches', 'ca9f8999-56c4-43d5-8c19-b18673756e58_gen.mp4', 'Start lying on your back with legs extended and arms by your sides. Engage your core and press your lower back gently into the floor.

Lift both legs off the ground, keeping them straight, so your body forms an "L" shape.

Crunch your torso up and simultaneously draw your legs toward your chest, curling your knees in and reaching your hands toward your feet.

Slowly extend your legs back out while lowering your upper body, returning to the starting position with control.

Maintain steady breathing and focus on core engagement throughout, avoiding momentum or swinging.'),
  ('In And Out Squats', '10e5204f-ac4a-490b-8601-2c86e506e4be_gen.mp4', 'Start With a Strong Base: Stand with feet together, chest tall, and core engaged. Brace your glutes and prepare to move.

Step Out and Squat: Step your feet wide into a squat position, toes slightly turned out. Squat down by pushing your hips back and keeping your chest upright, letting knees track over toes.

Step In and Stand: Step your feet back together to return to the starting position while standing tall.

Repeat Smoothly: Continue alternating stepping out into a squat and back in, keeping movements controlled and fluid. Focus on maintaining proper squat mechanics throughout.'),
  ('Incline bench press', 'b8ef1300-60ad-4816-93b7-9e0cb29b5c2f_gen.mp4', 'Set the bench to a 30-45° incline.

Lie back with feet flat on the floor, spine neutral, and eyes directly under the barbell.

Grip the bar slightly wider than shoulder-width, wrists stacked over elbows.

Retract your shoulder blades and keep them pinned to the bench throughout the movement.

Unrack the bar and bring it directly over your chest.

Lower the bar in a controlled motion to just above your upper chest, around nipple line or a touch higher.

Press the bar back up explosively to the starting position, keeping your elbows at a slight angle (not flared wide).

"Keep your chest high and shoulder blades tight."

"Think about breaking the bar in half to activate your upper chest."

"Don''t bounce, control the bar down, explode up."

"Bar path should move slightly back, not straight up.'),
  ('Incline DB bench press', 'c5d7768c-4b5e-4059-beaa-eb6208b89395_gen.mp4', 'Set your bench to a 30-45° incline.

Sit back with a dumbbell in each hand, resting them on your thighs.

Kick the dumbbells up as you lie back, planting your feet firmly on the floor.

Start with dumbbells just outside your shoulders, palms facing forward, elbows at about a 45° angle from your torso.

Press both dumbbells up until your arms are fully extended, bringing them together at the top without clashing them.

Lower slowly and under control until your elbows are slightly below the bench line.

Keep the movement smooth and controlled throughout.

"Keep your chest proud and core engaged."

"Press up and slightly in, don''t let the dumbbells drift too far out."

"Avoid arching your lower back, stay grounded."

"Squeeze your chest at the top of each rep."'),
  ('Incline walk', '7ebfbf47-a6a7-4b49-babe-b19aa3ca508c_gen.mp4', 'Set treadmill incline to 8-15% depending on fitness level.

Speed should be brisk but manageable (typically between 2.5-3.5 mph).

Maintain an upright posture, avoid leaning forward or holding the rails if not needed for safety.

Walk at a consistent pace while maintaining tension in your core.

Drive through your glutes and hamstrings with each step.

Keep your arms relaxed and swinging naturally to assist with balance and momentum.

"Stand tall, imagine a string pulling you up from the top of your head."

"Squeeze your glutes with each step to maximize posterior chain activation."

"Avoid holding the rails unless absolutely necessary for stability."

"Breathe deeply and focus on consistent, controlled steps'),
  ('Inverted Toe Touches', '3e00713d-8fd1-40c4-b4c9-6ea92f65e23c_gen.mp4', 'Start in High Plank: Hands under shoulders, feet hip-width apart, core braced. Your body should be in a strong, straight line, no sagging or arching.

Push into Downward Dog: Shift your hips up and back into an inverted V. Keep your legs as straight as your hamstring mobility allows.

Reach for Opposite Toe: While in the inverted position, lift one hand and reach toward the opposite foot (or shin/ankle depending on flexibility).

Engage the Core & Shoulders: As you reach, your core stabilizes and your shoulder girdle works hard to support the movement.

Return to Plank With Control: After each tap, return to the high plank position, reset your form before switching sides.

Alternate Sides Smoothly: Keep a steady rhythm, but don''t rush. Focus on range, control, and full-body engagement.

Breathe With Intention: Inhale in plank, exhale as you reach for your toe.'),
  ('Inward to lateral hip rotations', '32d2dfc4-f43a-4d7d-86e0-c68baf29283e_gen.mp4', 'Stand tall with feet hip-width apart, core braced, shoulders relaxed.

Lift one knee up to hip height, rotate it inward toward midline, then open out to the side in a smooth controlled motion.

Think "draw a circle with your knee", keep your torso still and let the movement come from the hip.

Move slow and intentional to warm up the hip capsule and increase mobility.

Keep tension through the standing leg for stability, and avoid leaning or twisting through the upper body.

Perfect for priming the hips before lower-body training, especially squats and lunges.'),
  ('Isometric Glutebridge to DB Chest Press', 'ab96b320-776b-4cb5-93cd-e8484af936fa_gen.mp4', 'Start lying on your back with knees bent, feet flat on the floor hip-width apart, holding a dumbbell in each hand at chest height. Engage your core.

Press through your heels to lift your hips into a glute bridge, forming a straight line from shoulders to knees. Squeeze your glutes at the top.

While holding the glute bridge, press the dumbbells straight up toward the ceiling, extending arms fully without locking elbows.

Lower the dumbbells back to chest height with control, maintaining the glute bridge throughout the movement.

Slowly lower your hips back to the floor when the set is complete, keeping movements smooth and controlled.'),
  ('jump rope', '56a9c09a-5c93-4104-a9c4-c714c87163a8_gen.mp4', 'Hold handles lightly in each hand with elbows tucked close to your ribs

Keep wrists relaxed and use them to rotate the rope, avoid big arm movements

Stay on the balls of your feet and keep knees soft for smooth landings

Maintain an upright posture, chest up, core braced, shoulders relaxed

Jump just high enough to clear the rope, no excessive bouncing

Focus on rhythm and breathing, inhale through your nose, exhale through your mouth

Keep your gaze forward, not down at your feet

If tripping up, reset your stance and tempo, quality over speed'),
  ('Jumping Jacks', '4d090789-fa65-407c-88c0-d14bbc6c648a_gen.mp4', 'Start Position:

Stand upright with feet together.

Arms down by your sides.

Movement:

Jump your feet out to shoulder-width or wider while simultaneously:

Swing your arms overhead, clapping or nearly clapping above your head.

Return:

Jump your feet back together.

Bring your arms back down to your sides.

Repeat at a steady, rhythmic pace.'),
  ('KB RDLs', '6e88162e-fbd5-4268-9a88-879b4f4321f5_gen.mp4', 'Start by standing tall with feet hip-width apart, holding a kettlebell in both hands in front of your thighs. Engage your core and keep chest lifted.

Hinge at the hips, pushing your glutes back while keeping a slight bend in your knees. Lower the kettlebell along the front of your legs, feeling a stretch in your hamstrings.

Keep your back flat and shoulders pulled back as you descend, avoiding rounding your lower back.

Drive through your heels and engage your glutes to return to standing, bringing the kettlebell back to starting position.

Maintain controlled movement, steady breathing, and focus on hamstring and glute engagement throughout the exercise.'),
  ('KB Squat into KB Jump Squat', '999ab9f5-24af-4ede-bf02-7c8896f2a8d5_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, holding a kettlebell at chest level in a goblet position. Brace your core and engage your glutes before you move.

Drop With Control: Squat down by pushing your hips back and keeping your chest tall. Lower until your thighs are at least parallel to the ground, knees tracking over toes.

Explosive Jump: Drive through your heels and explode upward into a jump, keeping the kettlebell close to your chest. Land softly with knees slightly bent to absorb impact.

Reset and Repeat: Return to a controlled squat position after landing, maintaining good form. Repeat for the next rep, focusing on smooth transitions and controlled movements.'),
  ('KB Squat to a High Pull', '1a225a69-b8b9-4b2a-ba4d-0f56b6f26d84_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, toes slightly turned out. Hold a kettlebell with both hands in front of your chest or at hip level. Brace your core and engage your glutes before you move.

Drop With Control: Squat down by pushing your hips back and keeping your chest tall. Lower until your thighs are at least parallel to the ground, knees tracking over toes.

Explosive Pull: As you stand up through your heels, pull the kettlebell up toward your chin, keeping elbows high and close to your body. Focus on generating power from your legs and hips, not just your arms.

Finish Strong: Stand tall with the kettlebell near chest or chin level, glutes and core fully engaged. Lower the kettlebell back to start and repeat for the next rep.'),
  ('Kettlebell Deadlift', '68add775-6c91-4875-8032-7b8a478831ee_gen.mp4', 'Start by standing with feet hip-width apart, kettlebell on the floor between your feet. Hinge at the hips and bend your knees slightly to grip the kettlebell with both hands.

Engage your core, keep chest lifted, and pull your shoulders back.

Drive through your heels, extending your hips and knees to lift the kettlebell off the ground, standing tall at the top.

Lower the kettlebell back to the floor in a controlled manner by hinging at the hips first, then bending the knees, keeping your back flat throughout.

Focus on smooth, controlled movements and maintaining proper form, avoiding rounding your lower back.'),
  ('Kettlebell Gorilla Rows', '51d23a7b-d423-4e37-b625-c9990173f558_gen.mp4', 'Start by standing with feet shoulder-width apart, holding a kettlebell in each hand. Hinge slightly at the hips, keeping a flat back and core engaged, allowing the kettlebells to hang in front of you.

Row one kettlebell toward your ribcage, keeping elbow close to your body and squeezing your back muscles at the top. Lower it back down with control.

Repeat on the other side, alternating rows in a smooth, controlled motion. Keep chest lifted and avoid twisting your torso excessively.

Maintain steady breathing and focus on engaging your lats, traps, and core throughout the exercise.'),
  ('Kneeling alt med ball push ups', 'ee5934ed-30e3-40d0-94fe-73a25c7a84c8_gen.mp4', 'Start in a kneeling push-up position with your hands shoulder-width apart and a medicine ball under one hand.
Perform a push-up, lowering your chest evenly despite the uneven surface.
Push back up, then roll or pass the ball to the other hand.
Reset your position and repeat on the opposite side.
Keep your core braced and hips level, avoid rotating through your torso.
Move with control during both the push-up and the ball transfer.'),
  ('Kneeling Arnold press', 'd0f8209f-0208-4f4d-a321-7c343cdb7a8c_gen.mp4', 'Start in Tall Kneeling: Knees hip-width apart, glutes and core engaged, torso upright. This position removes lower-body momentum and forces strict form.

Start Palms In, Elbows Bent: Hold dumbbells at shoulder height, palms facing you (like a hammer curl at the top). Elbows stay tight to your body.

Press + Rotate: As you press the weights overhead, rotate your palms outward so they finish facing forward at the top. This combines a press with a twist.

Full Extension at the Top: Finish with arms fully extended overhead, biceps next to ears. No leaning or arching, core stays braced the whole time.

Control the Descent: Reverse the movement, rotate the palms back toward your face as you lower the dumbbells slowly to the starting position.

Stay Locked In: No swaying, no lower back arch. Squeeze your glutes and keep ribs down to maintain spinal alignment.'),
  ('Kneeling cable crunches', '85fa6add-1d48-4cbd-8c16-c1efc64017e9_gen.mp4', 'Start by kneeling in front of a cable machine with a rope attachment. Hold the rope at either side of your head or shoulders, elbows bent, and engage your core.

Keep hips stationary and shoulders back, then crunch your torso down toward your knees by contracting your abs. Exhale as you curl downward.

Slowly return to the starting position with control, feeling a stretch in your abs without arching your lower back.

Maintain steady breathing and focus on engaging the abdominal muscles rather than using momentum or pulling with your arms.'),
  ('Kneeling cable face pulls', '896034d5-9ed3-4115-9cb0-0e8b755a6454_gen.mp4', 'Start by kneeling in front of a cable machine with a rope attachment set at upper-chest or eye level. Hold the rope with both hands, palms facing inward, and engage your core.

Keep your chest tall and shoulders back. Pull the rope toward your face, leading with your elbows and keeping them high, squeezing your shoulder blades together at the peak.

Slowly return to the starting position with control, maintaining tension in your upper back and shoulders.

Focus on smooth, controlled movements and avoid using momentum. Keep your core engaged and spine neutral throughout.'),
  ('Kneeling curl to press', '31ea9189-eeb8-49ed-84f4-6fd3cd523b7b_gen.mp4', 'Start by kneeling on the floor with knees hip-width apart, holding a dumbbell in each hand at your sides, palms facing forward. Engage your core and keep chest lifted.

Perform a bicep curl by bending your elbows and bringing the dumbbells toward your shoulders. Keep elbows close to your body.

Without pausing, rotate your wrists if needed and press the dumbbells overhead until arms are fully extended.

Lower the dumbbells back to shoulder height, then slowly return to starting position with control. Maintain core engagement and upright posture throughout.

Focus on smooth, controlled movements, avoiding momentum, and keeping tension on both the biceps and shoulders.'),
  ('Landmine Curtsey Lunges', 'db2ac1bd-e6ff-4741-b32f-54a308ab7901_gen.mp4', 'Stand sideways to the landmine, holding the bar near your shoulder with your inside hand.

Lean into the bar slightly, it helps stabilize your upper body without leaning excessively.

Position feet hip- to shoulder-width apart, with a strong, neutral spine.

Step your outside leg diagonally behind your front leg, crossing behind as if performing a curtsey.

Lower your hips until the front thigh is parallel (or near parallel) to the floor.

Keep chest tall and core engaged, don''t round forward or collapse through the front knee.

Press through the front heel to stand and return to start.

Complete all reps on one side before switching.'),
  ('Landmine curtsey lunges with knee drive', '6f8f5d01-3a31-4167-a9dd-1e029f6067ac_gen.mp4', 'Step the opposite leg behind and across into a curtsey lunge, keeping the landmine close to your body.

Keep the chest upright and core braced throughout.

Drive through the front heel to return to standing.

As you rise, bring the rear leg forward and drive the knee up toward your chest in one smooth motion.

Reset and repeat on the same side before switching.

"Sink into that lunge, don''t rush the drive."

"Keep tension in the core and glutes throughout the movement."

"Knee drive should be powerful and controlled, imagine breaking through resistance at the top."

"Don''t let the landmine pull you, stay centered."'),
  ('Landmine Hack Squats', '125c6097-f63b-4238-9505-2ca3f94a901f_gen.mp4', 'Stand facing away from the landmine with the bar positioned behind you and resting on one shoulder or held with both hands at shoulder height (bar angled from the floor).

Feet shoulder-width apart, toes slightly turned out.

Lean slightly forward into the bar for counterbalance; keep your chest lifted and core braced.

Lower into a deep squat, hips back and down, keeping the knees tracking over the toes.

Keep your torso at a slight forward angle to stay balanced with the landmine''s angle.

Push through your heels to return to standing, squeezing the glutes at the top.

"Stay loaded through your heels and midfoot."

"Brace your core and lean slightly into the bar."

"Control the descent, then drive up strong through the floor."

"Keep the bar tight to your body throughout the movement'),
  ('landmine kneeling single arm shoulder press', 'db146119-9eea-4eb9-aeee-b3bcec7226d2_gen.mp4', 'Start in a half-kneeling position: one knee down (same side as the pressing arm), opposite foot forward.

Hold the end of the landmine bar with a neutral grip (palm facing in), close to your shoulder.

Keep your core tight and glutes engaged to avoid leaning or arching the back.

Press the bar diagonally up and forward in line with the landmine''s natural path.

Control the descent, bringing the bar back down to shoulder height.

Avoid rotating through your torso, keep your hips square and spine neutral.'),
  ('Landmine RDL to Squat', 'c7175724-1c8a-4cb2-8065-65ae06a6a579_gen.mp4', 'Start standing tall, holding the landmine barbell with both hands at the sleeve.

Initiate the RDL by hinging at the hips, soft knees, neutral spine, bar stays close to the body.

Feel the stretch in your hamstrings at the bottom, then return to standing.

From the top, drop into a deep squat, keeping your chest upright and elbows inside the knees.

Drive through your heels to stand, then repeat the sequence.'),
  ('Landmine RDLs', '31afaa5e-5b12-4681-8492-988acc1c0f60_gen.mp4', 'Stand facing the landmine, feet hip-width apart.

Hold the barbell with both hands at the end sleeve, close to your hips, arms extended.

Soften your knees and brace your core.

Hinge at the hips by pushing them back while keeping the bar close to your body.

Keep your spine neutral and shoulders pulled back, don''t round your upper back.

Lower the bar until you feel a stretch in your hamstrings (just below the knees or mid-shin).

Drive through your heels to return to standing, squeezing glutes at the top.

Coaching Cues:

"Push your hips back like you''re closing a door behind you."

"Keep the bar close and your lats tight."

"Only go as low as you can without rounding your back."

"Squeeze your glutes and drive your hips forward to stand."'),
  ('Landmine side to side lunges', 'd3cfc6c2-7cc5-4fe4-9f8b-bcdfec41fe3f_gen.mp4', 'Start with the barbell anchored in a landmine unit, holding the sleeve with both hands at chest height.

Stand with feet wider than shoulder-width apart, toes slightly turned out.

Shift your weight laterally into one leg, bending the knee while keeping the opposite leg extended.

Keep your chest tall and core braced as you lower your hips into the lunge.

Press through the heel to return to center, then lunge to the other side, alternating fluidly.'),
  ('Landmine Squat Press With Calf Raises', 'a46658ce-a85b-4bdb-bf68-28bdbfbd176d_gen.mp4', 'Stand facing the landmine, holding the end of the barbell with both hands close to your chest (interlocked or palms cupped under).

Feet shoulder-width apart, core braced, chest upright.

Lower into a full squat, hips back, knees out, heels grounded.

As you rise to stand, press the barbell overhead.

At the top of the press, simultaneously drive up onto your toes into a calf raise.

Pause for a beat, then lower the barbell back to chest level and heels to the ground.

Reset and repeat.

"Drive through your heels, finish on your toes."

"Use your legs for power, press up and out in one fluid motion."

"Keep your core tight and ribs stacked under your hips as you press."

"Control the calf raise, don''t bounce."'),
  ('Lateral leg swings', '42246f82-3f74-46ba-861d-eb6d50f0384d_gen.mp4', 'Stand tall and hold onto a wall or stable surface for support.
Keep your torso upright and core engaged throughout the movement.
Swing one leg side-to-side across your body in a smooth, controlled motion.
Start with smaller swings, gradually increasing the range of motion.
Focus on hip mobility, don''t force the leg higher than your range allows.'),
  ('Lateral to inward hip rotations', 'eb1c167e-1bfe-46d1-a45b-37f7488eaf54_gen.mp4', 'Stand tall with your core engaged and a soft bend in the standing leg.

Keep the working leg straight and lift it out laterally with control, go only as high as your mobility allows.

From the lateral position, sweep the leg in toward your midline and bring the knee up into a high-knee position.

Keep your torso tall; avoid leaning or shifting heavily to one side.

Move slow and controlled to feel the rotation come from the hip joint, not momentum.

Keep the foot flexed for better stability and hip engagement.

Perfect for warming up hip mobility, balance, and coordination before squats, lunges, or any lower-body session.'),
  ('Leg lifts', 'e807b5ef-4a04-4ef4-aeba-a16883d156cb_gen.mp4', 'Start by lying on your back with legs extended straight and arms by your sides or under your glutes for support. Engage your core and press your lower back gently into the floor.

Lift both legs off the ground together, keeping them straight, until they form roughly a 90-degree angle with your torso.

Slowly lower your legs back down toward the floor without letting your lower back arch, maintaining tension in your core.

Keep movements controlled and steady, focusing on engaging the lower abdominals throughout the exercise.'),
  ('Leg Raises', '6077a330-2345-43ba-a175-4e8e9e680fc7_gen.mp4', 'Start by lying flat on your back with legs extended straight and arms by your sides or under your glutes for support. Engage your core and press your lower back gently into the floor.

Lift your legs together off the ground toward the ceiling while keeping them straight, until they are perpendicular to the floor or as high as comfortable.

Slowly lower your legs back down with control, avoiding letting your lower back arch or touch the floor.

Maintain steady breathing and focus on engaging your lower abdominals throughout the movement.'),
  ('leg raises with hiplifts', '5fb7df36-7660-4a2b-b483-34f0adf0f930_gen.mp4', 'Lie flat on your back with legs extended straight on the floor.

Reach arms overhead and firmly wrap your hands around the pole above your head for stability.

Engage your core before starting, lower back pressed gently into the ground.
Keeping legs straight, slowly lift them up toward the ceiling until they are vertical.

Once legs are vertical, press into the pole for stability and lift your hips slightly off the ground, driving feet toward the ceiling (controlled hip lift).

Lower your hips back down with control, then slowly lower your legs back to the floor without letting them slam down.

Repeat for reps, keeping tension in the core the entire time.

"Think slow and controlled, don''t swing your legs."

"Lift with your abs, not momentum."

"Drive your toes straight up, not back over your head."

"Keep your lower back pressed into the floor as much as possible."

"Squeeze your core at the top, breathe out as you lift."'),
  ('Long resistance band B stance RDL', '66af63db-5c3e-4efc-bc89-8e01e0da67d8_gen.mp4', 'Start by standing on the middle of a long resistance band with one foot, the other foot slightly back in a staggered "B-stance" position. Hold the ends of the band in each hand at your sides, palms facing your body. Engage your core and keep chest lifted.

Hinge at the hips, pushing your glutes back while keeping a slight bend in both knees. Lower your torso and arms toward the floor, feeling a stretch in the hamstrings of the front leg. Keep your back flat and shoulders pulled back.

Drive through the heel of your front foot and engage your glutes to return to standing, bringing your torso back to upright position.

Maintain controlled, smooth movements, keeping your core engaged and focusing on hamstring and glute activation throughout.'),
  ('Long resistance band squats', '261c9ef0-dd20-48ed-9c6d-462496ede2de_gen.mp4', 'Start by standing on the middle of a long resistance band with feet shoulder-width apart. Hold the ends of the band at your shoulders or sides, keeping your chest tall and core engaged.

Sit back and down into a squat by bending at the hips and knees, keeping your knees tracking over your toes and weight through your heels. Lower until your thighs are roughly parallel to the floor or as deep as comfortable.

Drive through your heels and engage your glutes to return to standing, keeping your chest lifted and core braced throughout the movement.

Maintain smooth, controlled movements, focusing on glute and quad activation while avoiding collapsing the knees inward.'),
  ('Lying down DB bench press', 'c592e19f-a6ce-431e-960e-64036be07e95_gen.mp4', 'Setup:

Lie on your back on the floor (use a mat for comfort).

Bend your knees, feet flat on the ground.

Hold a dumbbell in each hand, with elbows resting on the floor and dumbbells over your chest.

Palms can face forward (standard grip) or each other (neutral grip) for shoulder-friendly variation.

Pressing Phase:

Press the dumbbells upward until your arms are fully extended above your chest.

Keep the dumbbells under control, and squeeze your chest at the top.

Lowering Phase:

Lower the dumbbells slowly until your upper arms gently touch the floor (don''t slam them down).

Pause briefly, then repeat.'),
  ('Lying hamstring Curls', 'efa04a08-3cfe-4808-8028-5f2e40c1436c_gen.mp4', 'Set Up Tight: Lie flat on the machine with the pad resting just above your heels, not on your calves. Adjust the machine so your knees line up with the pivot point.

Control the Curl: Curl the weight up smoothly, don''t jerk it. Focus on squeezing the hamstrings at the top of the movement.

Keep Hips Down: Press your hips into the bench to avoid compensation. No arching or lifting your butt.

Full Range of Motion: Bring your heels up as far as your range allows, then slowly lower back down without letting the weight slam.

Slow the Eccentric: Lower the weight slower than you lifted it to maximize hamstring engagement.

Toes Neutral or Slightly Pointed: This keeps the tension on the hamstrings. Don''t over-flex the calves.

Stay Locked In: Keep your upper body still. No swinging or rocking for momentum, your hammies should be doing the work.'),
  ('Machine bicep curls', '333b2544-aae9-43d5-bec1-8a39863e9d5a_gen.mp4', 'Adjust the seat so your armpits are comfortably positioned against the top of the preacher pad.
Place your upper arms firmly on the pad and grip the handles with your palms facing up.
Keep your chest tall and shoulders pulled down away from your ears.
Start with your arms nearly fully extended, maintaining a slight bend in the elbows.
Curl the handles up by driving through your biceps, keeping your upper arms glued to the pad.
Squeeze your biceps hard at the top of the movement for 1 second.
Lower the weight slowly and under control until your arms are nearly straight.
Avoid lifting your elbows off the pad or using momentum to move the weight.
Keep your wrists neutral throughout the exercise.
Think: "Curl with your biceps, not your shoulders."'),
  ('Machine chest flys', '469dd3c8-4d81-4cc3-a9df-7a7f5e34f67a_gen.mp4', 'Adjust the seat height so the handles are aligned with mid-chest

Sit tall with your back flat against the pad and feet planted

Grasp the handles with a slight bend in your elbows, arms should form a wide "hugging" shape

Exhale as you squeeze your arms together in front of your chest

Keep your elbows at the same angle, don''t lock out or change the bend mid-movement

Pause briefly at the top for a strong chest contraction

Inhale as you slowly return to the start position, feeling the stretch

Control the tempo, no bouncing or using momentum'),
  ('Machine chest press', '32575b77-8431-4545-80af-9aaf289bba84_gen.mp4', 'Note: I''m using a machine that has a slight sway or arc in the pressing motion, it''s designed that way to mimic a more natural path of movement. No worries if your gym has a different version, the same cues still apply! Just focus on controlled reps, full range of motion, and keeping your chest engaged throughout.
Adjust the seat so the handles are level with the mid-chest

Sit back with your shoulders pressed into the pad and feet flat on the floor

Grip the handles with elbows bent about 90°, keeping wrists neutral

Engage your core and press the handles forward until arms are extended (but not locked out)

Exhale as you press; inhale on the way back

Lower the weight back with control until elbows are just past 90° for full range of motion

Keep your shoulder blades retracted throughout to protect the joints and maximize chest activation

Focus on squeezing the chest at the top and avoid using momentum'),
  ('Machine glute bridges', '7cb8ac95-2ef9-401b-aae4-e1d3f40238f3_gen.mp4', 'Set Up the Machine: Sit on the platform with your upper back pressed into the pad, knees bent, and feet flat on the platform, about hip-width apart. Adjust the shoulder/back pad to sit just under your shoulder blades.

Foot Placement: Place your feet where your shins are vertical at the top of the bridge. To bias the glutes more, place your feet slightly higher and wider.

Secure the Belt or Pad: Strap the pad across your hips snugly but not overly tight, this ensures a smooth range of motion without shifting.

Tuck Your Pelvis: Slight posterior pelvic tilt. Ribs down, core tight. This helps prevent lower back compensation.

Drive Through Your Heels: Push the platform away using your glutes. Don''t drive through the toes, this will shift the load to your quads.

Full Hip Extension: At the top, your hips should be fully extended but not overarched. Squeeze the glutes hard at the top.

Chin Tucked, Eyes Forward: Keep your neck neutral by tucking your chin, this also helps control your rib and spine positioning.

Controlled Eccentric: Lower back down with control until the glutes just tap the bottom, then go right back into the next rep, no bouncing.'),
  ('Machine Glute Kickback', '5c2e9aef-bbb9-4efa-8ccc-b37008d84542_gen.mp4', 'Adjust the machine so the foot pad sits comfortably against the bottom of your foot.
Place your chest firmly against the pad and grip the handles for stability.
Keep a slight bend in your working knee throughout the movement.
Brace your core and maintain a neutral spine.
Drive your heel back and slightly up by squeezing your glute, not by arching your lower back.
Extend your leg until you feel a full glute contraction without rotating your hips.
Pause and squeeze your glute for 1-2 seconds at the top.
Slowly return to the starting position with control, maintaining tension on the glute.
Keep your hips square to the machine and avoid twisting your torso.
Avoid using momentum or swinging the weight.
Think: "Drive through your heel and squeeze your glute hard at the top of every rep."'),
  ('Machine hack squats', '6aeb2865-ddcd-4ac8-a21d-9cfc6c4b9ff7_gen.mp4', 'Set your feet shoulder-width on the platform; higher placement = more glutes, lower = more quads

Keep your back and hips fully pressed into the pad at all times

Brace your core before unlocking the sled

Lower slowly, allowing knees to track over toes

Descend until thighs are at least parallel, or as deep as mobility allows

Drive through the mid-foot to heels to stand back up

Avoid locking out hard at the top, keep tension on the legs

Control the tempo; this is a builder, not a bounce

Cue: "Sit down, knees forward, push the platform away"'),
  ('machine rear delt flys', '110ea5c9-3f29-49f5-adbc-8f43b6016726_gen.mp4', 'Push the bench back so only your chest is touching the pad

Sit tall with core braced, no leaning back or rocking

Handles set at or slightly below shoulder height

Use a lighter load to keep tension strictly on the rear delts

Maintain a soft bend in the elbows and keep it consistent

Initiate by driving the elbows out and slightly back, not the hands

Think "open the arms wide," not "squeeze the shoulder blades"

Stop the rep when arms reach shoulder line, do not overpull

Pause 1 second at the back and squeeze the back of the shoulders

Control the return for 2-3 seconds to maintain constant tension

If upper back or traps take over, the weight is too heavy'),
  ('Machine rows (underhand grip)', '65b10852-8149-4eed-9f34-39544724d8fb_gen.mp4', 'Adjust the seat so the handles are aligned with your lower chest/upper abdomen.
Take an underhand (supinated) grip with palms facing up.
Keep your chest tall, shoulders down and back, and feet firmly planted.
Start with your arms fully extended while maintaining tension through your upper back.
Drive your elbows down and back toward your hips as you pull the handles into your lower ribcage/upper stomach.
Focus on squeezing your shoulder blades together at the end of the movement.
Pause for 1 second in the contracted position.
Slowly return the weight with control until your arms are fully extended.
Avoid shrugging your shoulders, using momentum, or leaning excessively backward.
Think: "Pull with your elbows, squeeze your back, not your biceps."'),
  ('Machine shoulder press', '0d584c50-2594-4d40-a493-67ed05923fb1_gen.mp4', 'Adjust the seat so the handles start at about shoulder height.
Sit with your back firmly against the pad and feet planted flat on the floor.
Grip the handles slightly wider than shoulder-width apart.
Keep your chest up, core braced, and shoulders pulled down away from your ears.
Press the handles overhead until your arms are nearly fully extended.
Squeeze your shoulders at the top without aggressively locking out your elbows.
Lower the weight slowly and with control until the handles return to shoulder level.
Keep your wrists stacked directly over your elbows throughout the movement.
Avoid arching your lower back or using momentum to drive the weight up.
Think: "Push the weight overhead while keeping your ribs down and core tight."'),
  ('Machine tricep extension', 'abd0bd51-17a8-481a-ab25-539441ff1a9b_gen.mp4', 'Adjust the seat so your upper arms are supported and your elbows line up comfortably with the machine''s pivot point.
Keep your chest up, core tight, and back pressed into the pad.
Grip the handles firmly and keep your elbows locked in position throughout the movement.
Press the handles down or forward by extending through the elbows.
Squeeze your triceps hard at the bottom of the rep.
Slowly control the weight back to the starting position without letting the stack slam.
Avoid using your shoulders, leaning forward, or letting your elbows flare out.
Think: keep the upper arm still, move only from the elbow.'),
  ('Machine tricep pushdown', '9076fca1-04a4-4eb3-b99f-ee5cf7f026b7_gen.mp4', 'Maintain a slight forward lean from the torso throughout the movement.
Grip the handles with a neutral grip and keep your elbows pinned to your sides.
Start with your elbows bent and the handles near chest level.
Press the handles down by extending your elbows until your arms are fully straight.
Squeeze your triceps hard at the bottom for 1 second.
Slowly return to the starting position with control, allowing your elbows to bend without losing tension.
Keep your upper arms stationary throughout the exercise.
Avoid using momentum, shrugging your shoulders, or letting your elbows flare out.
Think: "Pin your elbows in place and drive the handles straight down using your triceps."'),
  ('Medicine ball box jump squats', null, 'Start by standing in front of a sturdy box or platform, holding a medicine ball close to your chest with both hands. Feet should be shoulder-width apart, knees slightly bent, and core engaged.

Sit back slightly into a quarter squat and then explode upward, jumping onto the box with both feet landing softly and evenly. Keep chest lifted and land in a controlled squat position.

Step or lightly hop back down to the starting position and repeat, maintaining smooth, controlled movements.

Focus on engaging your glutes and quads during the jump and landing, keeping your core tight to stabilize your body.'),
  ('Medicine ball chest slams', 'cff39be3-6981-4838-9684-ac19991290a3_gen.mp4', 'Start by standing with feet shoulder-width apart, holding a medicine ball at chest height. Engage your core and keep chest tall.

Lift the medicine ball overhead with both hands, fully extending your arms while maintaining a slight bend in your knees.

Explosively slam the ball down toward the floor as hard as you can, using your core, shoulders, and arms. Keep a slight bend in the knees to absorb impact.

Catch or pick up the ball on the bounce (if appropriate) and reset for the next repetition, maintaining controlled form.

Focus on explosive power from your core and upper body while keeping your spine neutral and avoiding rounding your back.'),
  ('Medicine ball chest slams small ball', 'ff2aa1b3-fc1f-4e42-9014-f6eb37a14145_gen.mp4', 'Start by standing with feet shoulder-width apart, holding a small medicine ball at chest height. Engage your core and keep chest tall.

Lift the ball overhead with both hands, fully extending your arms while maintaining a slight bend in the knees.

Explosively slam the ball down toward the floor as hard as you can, using your core, shoulders, and arms. Keep a slight bend in the knees to absorb impact.

Catch or pick up the ball on the bounce (if appropriate) and reset for the next repetition, maintaining controlled form.

Focus on controlled, explosive movement and proper core engagement while keeping your spine neutral.'),
  ('Medicine ball crunches', '7b8b3b12-48f1-4f35-a8d2-f52c16ffa95b_gen.mp4', 'Sit on top of a medium-to-large medicine ball, feet flat and hip-width apart

Walk your feet forward slightly and lean back so your lower back is supported by the ball, keeping core tight

Cross arms over your chest or place hands behind your head

Engage your abs to lift your chest toward the ceiling in a controlled crunch

Keep your chin slightly tucked, avoid pulling on the neck

Exhale as you crunch up, inhale as you return to starting position

The instability of the ball helps activate deep core muscles and challenges balance'),
  ('Medicine ball jump squats', 'aadea94b-fe10-4ad6-9ffc-7837fb86e8ac_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, holding a medicine ball close to your chest. Brace your core and engage your glutes before moving.

Lower With Control: Squat down by pushing your hips back and keeping your chest tall. Make sure your knees track over your toes and weight stays through your heels.

Explode Up: Drive through your heels and jump straight up with power, keeping the medicine ball close to your chest. Focus on a quick, explosive release from the bottom.

Land Softly: Absorb the landing by bending your knees and hips immediately. Stay light and controlled, then flow right into your next rep.'),
  ('Medicine ball pulse squats', '3093d85c-02ca-48bf-8534-95602ff3d808_gen.mp4', 'Stay Low: This is a partial range movement, keep the squat shallow and controlled to maintain constant tension on the glutes and quads.
Pulse With Purpose: Small, controlled bounces. No rushing. Use the pulse to keep the muscle under tension, not just to move fast.
Feet Flat: Keep your heels grounded the entire time. Push through them to stay stable and avoid knee strain.
Med Ball Position: Hold the medicine ball close to your chest. Don''t let it pull you forward, use it to challenge your core and keep your upper body tall.
Core Tight, Chest Up: Engage your core throughout. Think proud chest and long spine.'),
  ('Medicine ball reverse lunges', 'caed3f89-c410-4b9f-b5ce-613574d05957_gen.mp4', 'Step Back with Control: Focus on a slow, steady step back, not a drop. Keep the front foot rooted and knee stacked over the ankle.

90/90 Form: At the bottom of the lunge, both knees should be at 90 degrees. Don''t let the back knee slam the ground, light tap if anything.

Upright Torso: Keep the chest lifted and spine neutral. Avoid leaning forward or arching the lower back.

Med Ball Placement: Hold the medicine ball tight at your chest to stay balanced, or extend it slightly to challenge your core and shoulders.

Drive Through the Front Heel: Power back up using the front leg. This keeps the focus on the glutes and hamstrings.

Control Over Speed: Don''t rush the reps. Prioritize depth and stability over how fast you move.'),
  ('Medicine ball slams', 'c93e4f02-f5ba-4992-928d-c0d23f79923c_gen.mp4', 'Start by standing with feet shoulder-width apart, holding a medicine ball at chest height. Engage your core and keep your chest tall.

Lift the ball overhead with both hands, fully extending your arms while maintaining a slight bend in the knees.

Explosively slam the ball down toward the floor as hard as you can, using your core, shoulders, and arms. Bend your knees slightly to absorb the impact on landing.

Catch or pick up the ball on the bounce (if appropriate) and reset for the next repetition, maintaining control and proper form.

Focus on generating power from your core and upper body while keeping your spine neutral and avoiding rounding your back.'),
  ('Modified High Knees', '2a731a6f-025b-4670-b28c-657414d89bdb_gen.mp4', 'Start by standing tall with feet hip-width apart, knees slightly bent, and core engaged. Keep your chest lifted and shoulders relaxed.

Lift one knee toward your chest, then quickly switch to lift the other knee in a marching or slightly faster motion, mimicking a running motion in place.

Pump your arms naturally in sync with your knees to help drive movement and maintain balance.

Focus on controlled, rhythmic movement rather than speed, keeping your core engaged and landing softly on your feet.'),
  ('Modified push ups', '8dc7e8ac-f56d-4252-8e31-0466025b6153_gen.mp4', 'Start in a high plank position on your knees, with hands slightly wider than shoulder-width

Keep your hips aligned with your shoulders, avoid letting them sag or pike up

Engage your core and lower your chest toward the floor, keeping elbows at about a 45° angle

Inhale as you lower, exhale as you press back up through your palms

Maintain a straight line from your head to your knees throughout the movement

Focus on controlled movement, full range of motion, and proper form'),
  ('Modified shoulder taps', '391f69ae-d2b8-4934-9c8b-91621e7d5ae2_gen.mp4', 'Start in a modified plank position, knees on the floor, hands under shoulders, body in a straight line from head to knees

Brace your core and lift one hand to tap the opposite shoulder, keeping your hips as still as possible

Alternate sides slowly, focusing on control over speed

Widen your knee base slightly for more balance

Avoid letting your torso twist or your hips sway, keep your core tight and glutes lightly engaged

Keep neck neutral, gaze down, and shoulders stacked over wrists'),
  ('Narrow stance belt squats', 'fca019ae-d177-4f11-b959-66a48f8cc8fa_gen.mp4', 'Start With a Strong Base: Stand on the platform or footplate of the belt squat machine with feet close together (narrow stance), toes slightly turned out. Attach the belt snugly around your hips. Brace your core and engage your glutes before you move.

Lower With Control: Bend your knees and hips to slowly descend into a squat. Keep your chest tall, knees tracking over your toes, and weight through your heels. Lower until your thighs are roughly parallel to the platform.

Drive Through Heels: Push through your heels to return to the starting position, keeping the core tight and glutes engaged throughout the movement.

Finish Strong: Stand tall at the top with hips and glutes fully engaged. Reset and repeat for the next rep with smooth, controlled form.'),
  ('Narrow stance leg press', 'bca9e0e6-eef8-4199-853d-b6df92d60be4_gen.mp4', 'Sit in the leg press machine with your back and head flat against the pad.

Place feet hip-width or slightly closer apart in the center of the platform, toes pointing straight ahead.

Grip the handles for support and engage your core.

Unrack the sled by straightening your legs without locking out your knees.

Slowly lower the weight toward your chest, keeping your feet flat and knees tracking straight over your toes.

Push through your heels to press the platform back up to the starting position.

"Keep knees soft at the top, don''t lock out."

"Focus on control during the descent, don''t bounce."

"Drive through your heels to maximize quad activation."

"Keep your lower back glued to the pad."'),
  ('Neutral grip cable tricep pull downs', '7a09929d-d5de-4723-a0be-5d9d170944d8_gen.mp4', 'Start by standing in front of a cable machine with a neutral grip attachment (palms facing each other). Grab the handles with elbows tucked close to your sides and feet shoulder-width apart. Engage your core and keep your chest tall.

Press the handles downward by extending your elbows fully, keeping your upper arms stationary and close to your body. Exhale as you push down.

Slowly return to the starting position with control, feeling the stretch in your triceps while maintaining a neutral wrist position.

Focus on controlled movements and avoid using momentum or leaning forward. Keep your core tight and spine neutral throughout the exercise.'),
  ('OH cable tricep extension', '7d2787c1-c045-41e3-aa81-dd7854383283_gen.mp4', 'Start by standing with feet shoulder-width apart in front of a cable machine, holding a rope or straight bar attachment overhead with both hands. Keep elbows close to your ears and core engaged.

Lower the attachment behind your head by bending your elbows, keeping upper arms stationary. Exhale as you descend, feeling a stretch in your triceps.

Press the attachment back up by extending your elbows fully, maintaining tension in the triceps throughout the movement.

Focus on controlled, smooth movements, keeping your core tight and avoiding excessive arching in your lower back.'),
  ('OH pendlay rows', 'b2d21aac-192c-4c41-9fff-9d047e5152fd_gen.mp4', 'Start by standing with feet hip-width apart, holding a barbell with an overhand grip. Hinge at the hips until your torso is roughly parallel to the floor, keeping a flat back and core engaged. Let the barbell rest on the floor in front of you.

Explosively row the barbell toward your lower chest or upper stomach, driving your elbows back and squeezing your shoulder blades together at the top.

Lower the barbell back to the floor with control, fully resetting each rep before pulling again. Keep chest lifted and core tight throughout the movement.

Focus on maintaining strict form, avoid using momentum or excessive torso rotation. Each rep should start from a dead stop on the floor.'),
  ('Overhand barbell bent over row', '34d25177-7e74-43fb-aa98-61745da0bb60_gen.mp4', 'Set Your Grip: Use an overhand (pronated) grip, just outside shoulder-width. This grip shifts more focus to the upper back and rear delts.

Hinge to Position: Hinge at the hips like an RDL, torso about 45° or lower, knees soft, spine neutral. Don''t round your back.

Brace Your Core: Before you move, lock in your core and glutes. Think about holding a solid plank while bent over.

Row to Upper Abs/Lower Chest: Pull the bar in toward your upper abs or lower chest, not your neck. Keep elbows angled around 45° from your sides.

Squeeze at the Top: Pause for a second at the top of each rep and retract your shoulder blades. This keeps the tension in the back muscles.

Control the Lowering: Don''t just drop the bar, slowly extend your arms back to the start, keeping tension throughout.'),
  ('Overhead cable tricep extension', '3024f780-71f6-43af-86ee-f68a4e933c2e_gen.mp4', 'Attach a rope or straight bar to the low pulley on a cable machine

Stand facing away from the machine and grab the handle with both hands, stepping forward into a staggered stance

Bring the handle over your head, elbows bent and pointing forward, biceps close to your ears

Engage your core and extend your arms upward, straightening the elbows to push the weight overhead

Squeeze the triceps at the top, then slowly lower back to the starting position without flaring the elbows

Keep your chest tall, back neutral, and avoid arching through the lower back

Focus on full range of motion and control, not momentum'),
  ('Plank Walkouts', '504da47d-1752-402a-a96b-5d72ee6e8a3a_gen.mp4', 'Start Standing Tall: Feet hip-width apart, arms by your sides. Engage your core before you even move.

Hinge at the Hips: With a soft bend in your knees, fold forward and reach your hands toward the floor. Keep your back flat and core braced.
Walk Out: Step your hands forward until you reach a solid high plank position, shoulders stacked over wrists, body in a straight line.
Lock In the Plank: Engage your glutes, quads, and core. Don''t let your hips sag or pike up.'),
  ('Plate forward walk up and down', 'bfa206ee-56d6-42f4-8b2f-157f25d31758_gen.mp4', 'Start in a high plank position with the plate on the floor in front of you

Hands should be on the floor, just outside shoulder-width, and feet wider than hip-width to help control hip rotation

One hand at a time, step up onto the plate, then back down, alternate lead hands each rep

Keep your core braced and glutes tight, the goal is to minimize hip sway and torso rotation

Move slow and controlled, this is about stability, not speed

Shoulders stay stacked over wrists, spine neutral, and neck relaxed

Exhale as you press through the hand onto the plate, inhale as you return

If hips start to rock too much, widen your stance and slow the tempo'),
  ('Plate Hops', '974b7fff-4020-4033-9820-50c20f19ce6d_gen.mp4', 'Place a bumper plate on the floor in front of you

Stand tall with feet hip-width apart, core engaged

Hop onto the plate with both feet, landing softly in an athletic stance

Immediately hop back down to the floor, keep your rhythm steady and controlled

Stay light on your feet, land softly on the balls of your feet with bent knees

Keep your chest lifted and core braced throughout'),
  ('Plate hyperextensions', 'f5d95a09-adea-4ab9-9b4a-b6f47cfb100f_gen.mp4', null),
  ('Plate in and out crunches', '14d39a4b-7bf3-40d7-bb7d-2aec6de8fba7_gen.mp4', 'Sit on the floor holding a plate at your chest or with arms extended slightly forward

Lean back slightly, keeping your chest lifted and core tight

Lift your feet off the floor and extend legs outward while simultaneously extending arms holding the plate

Crunch in by pulling your knees toward your chest as you bring the plate back in toward your body

Extend again into a "V" shape, legs out, arms forward, maintain balance on your tailbone

Move slow and controlled, avoid swinging or using momentum'),
  ('Plate overhead alt forward lunges', 'd4c0d419-1dba-49c9-99ca-6395e1e96edb_gen.mp4', 'Hold a weight plate pressed overhead with arms fully extended, biceps by ears, core tight

Step forward into a lunge, front knee stacks over the ankle, back knee lowers toward the floor

Keep your torso upright and plate stable overhead, avoid leaning or letting the arms drift forward

Push through the front heel to return to standing

Alternate legs with each rep, maintaining control and balance

Core stays braced, this is as much about stability as strength'),
  ('Plate Overhead Alt Reverse Lunges', 'ea5af946-da96-4924-99a8-d23beae859b6_gen.mp4', 'Hold a plate directly overhead with arms fully extended, biceps by ears, core tight

Step one leg back into a reverse lunge, back knee lowers toward the floor, front knee stays stacked over the ankle

Keep the plate stable overhead, avoid arching the low back or letting arms drift forward

Push through the front heel to return to standing, then switch legs

Alternate sides with each rep, move with control, not momentum

Maintain a tall posture, hips square, and chest proud'),
  ('Plate overhead squats', '6b410b53-b129-43fc-9a30-aca9bdcca2f4_gen.mp4', 'Hold a plate overhead with both hands, arms fully extended, biceps by ears, core tight

Stand with feet shoulder-width apart, toes slightly turned out

Brace your core and keep the plate stable overhead as you lower into a squat

Hips drop below parallel if mobility allows, knees track over toes, chest stays lifted

Keep your torso upright and arms locked, don''t let the plate drift forward

Drive through your heels to return to standing, squeezing glutes at the top'),
  ('Plate Russian twist', '0ec4d3d3-1951-45fc-9fa1-91af1bd92918_gen.mp4', 'Sit on the floor with knees bent, feet either flat or hovering for more challenge

Hold a plate with both hands close to your torso or extended slightly out for added intensity

Lean back slightly to engage the core, keep spine neutral and chest lifted

Rotate the plate from side to side, tapping it lightly to the floor beside each hip

Twist through your torso, not just your arms, shoulders should follow the plate

Keep feet and knees stable, avoid rocking or using momentum'),
  ('Plate Sit Ups', '7b47d518-d385-4e4c-9af3-fdad07326d30_gen.mp4', 'Lie flat on your back with knees bent and feet firmly planted

Hold a plate with arms fully extended straight out in front of you (toward the ceiling), keep a slight bend in the elbows

Engage your core and sit up in a controlled motion, reaching the plate toward the ceiling (not forward)

Keep arms extended throughout, don''t bend or drop the plate

Slowly lower back down to the floor with control, keeping tension in the core

Exhale as you sit up, inhale as you lower

Avoid using momentum, movement should come from your core, not the swing of the plate

The extended arms increase lever length and time under tension, expect a deep core burn'),
  ('Plate Snatches', '6a6acd5e-58ac-4ceb-827d-21af3bfdad85_gen.mp4', 'Start in a deep squat position, plate on the floor between your feet, both hands gripping the edges

Chest lifted, back flat, core tight, knees tracking over toes

Explosively drive through the legs to stand up, using your hips and legs to power the movement

As you rise, pull the plate close to your body and punch it overhead in one smooth motion

Arms finish locked out overhead, plate stacked over shoulders, don''t arch the lower back

Control the descent, bring the plate back down to the floor and reset in a strong squat

Keep your eyes forward, spine neutral, and movements fluid'),
  ('Plate Toe Touches', '0a0fdbf4-392a-4c77-a477-d939851a19b7_gen.mp4', 'Lie on your back with legs extended straight up toward the ceiling, feet flexed

Hold a plate with both hands, arms fully extended toward your toes

Engage your core and crunch up, reaching the plate toward your toes

Keep your legs as straight as possible and lift your shoulder blades off the floor

Exhale as you lift, inhale as you lower with control

Keep arms extended and plate stable, don''t swing

Focus on small, controlled reps, reach through your abs, not your neck

Keep chin slightly tucked and eyes on the plate or your toes'),
  ('Plate Up and Down Step Ups', 'cf54da94-3b8a-4098-8bb6-4589256fdd3f_gen.mp4', 'Place a weight plate flat on the floor in front of you

Stand tall with knees slightly bent and core engaged

Step one foot onto the plate, then quickly step off and switch feet, alternating legs each rep

Stay light on your feet, movement should be quick, controlled, and rhythmic

Keep your chest lifted, shoulders relaxed, and arms moving naturally for momentum

Focus on tapping the plate, not stomping, step up and off with intention

Maintain a slight bend in your knees the entire time, don''t fully stand upright between steps'),
  ('Plate Walk Up and Down', '9e0e7194-bf93-48e7-8cb1-858219d083d6_gen.mp4', 'Start in a High Plank: Hands on the floor, shoulders stacked over wrists, core tight, body in a straight line from head to heels.

One Hand at a Time: Walk your right hand up onto the plate, then the left, so both hands are now elevated on the plate.

Then Walk Down: Step the right hand down, then the left. Repeat in a steady, controlled rhythm.

Minimize Hip Shift: Keep your hips square to the floor. Avoid rocking or twisting, lock your core in tight like you''re resisting a punch.

Soft Elbows: Keep a slight bend in your arms to reduce joint strain and maintain shoulder control.

Stay Stacked: Don''t let your head dip or your hips rise. Shoulders over wrists, back flat, and glutes engaged.

Breathe Steady: Inhale as you reach up, exhale as you step down. Keep the breath calm to help brace your core.

Switch Lead Hands: Alternate which hand steps up first every few reps or each set to stay balanced.'),
  ('Plyo Bulgarian Split Squats', '1e96e243-6c6e-40e5-bfdc-aabd30f8d13a_gen.mp4', 'Start With a Strong Base: Stand a few feet in front of a bench or platform with one foot resting on it behind you. Plant your front foot firmly on the ground, toes forward, and brace your core.

Lower With Control: Bend your front knee and lower your hips toward the ground. Keep your chest tall, shoulders back, and ensure the front knee tracks over the toes.

Explode Up: Drive through your front heel to jump off the ground, keeping your chest upright. Use your arms for balance and power.

Land Softly: Absorb the landing with your front leg by bending the knee and hip immediately. Reset your balance and flow into the next rep with control.'),
  ('Plyo lunges', 'b8589989-5cbd-4287-8e4f-1d716631719d_gen.mp4', 'Start by standing tall with feet hip-width apart and hands on your hips or by your sides. Engage your core and keep your chest lifted.

Step one foot forward into a lunge position, bending both knees to roughly 90 degrees.

Explosively push through the front heel to jump upward, switching legs mid-air so you land with the opposite leg forward. Land softly in a lunge position, absorbing impact with bent knees.

Repeat the jump-lunge sequence for the desired number of reps, keeping movements controlled, rhythmic, and powerful.

Focus on maintaining core engagement, proper knee tracking over toes, and even weight distribution to protect joints.'),
  ('Pole asst alt leg raises', 'b7cad7c3-0e1c-4171-a138-6a1bd3bb3ffc_gen.mp4', 'Lie flat on your back with legs extended straight on the floor.

Reach arms overhead and wrap hands firmly around the pole for stability.

Press your lower back into the ground and brace your core.

Lift both legs up so they are vertical above your hips.

Keeping one leg extended upward, slowly lower the opposite leg toward the ground.

Stop just before the heel touches the floor, then raise it back to vertical.

Alternate legs, lowering one while the other stays pointing up.

Maintain control, no swinging or arching the lower back.

"Keep one leg locked up while the other lowers, like scissors in slow motion."

"Move with control, don''t drop your legs."

"Exhale as you lift, inhale as you lower."

"Brace your abs to keep your low back pressed into the floor."

"Use the pole to anchor yourself, not to yank."'),
  ('Pong hops', '6f1b5b04-69c8-4ba0-85b5-55d4db4913ec_gen.mp4', 'Stand tall with feet hip-width apart, knees slightly bent.
Hop straight up and down, staying light on the balls of your feet.
Keep your arms at your sides or in a ready position to help with balance.
Focus on quick, small hops, like a ping pong ball bouncing in place.
Land softly and maintain a consistent rhythm.
Keep your core engaged to avoid excessive upper body movement.'),
  ('Post workout stretch', '9e0eaac2-eaba-4a06-9e7a-ccdf299cfee4_gen.mp4', 'Start by standing tall with feet hip-width apart. Take a deep breath in and engage your core.

Slowly reach your arms overhead and extend your spine, stretching through your back and shoulders. Hold for a few seconds.

Next, reach one arm across your chest and use the opposite arm to gently pull it closer, stretching the shoulder and upper back. Switch sides.

Step forward into a gentle lunge to stretch your hip flexors, keeping your chest lifted and core engaged. Hold, then switch legs.

Finish with seated or standing hamstring and calf stretches, reach toward your toes or place one leg forward and hinge at the hips while keeping your back flat.

Focus on deep, controlled breathing, relaxing the muscles, and holding each stretch for 20-30 seconds.'),
  ('Pulsing Jump Squats', '80e6a874-aec5-429f-871e-00c8874f44bd_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, chest tall, and core engaged. Brace your glutes and prepare to move.

Pulse Down: Lower into a partial squat (about halfway down) and pulse 1-3 small controlled bounces, keeping tension in your quads and glutes.

Explosive Jump: From the pulse, drive through your heels and explode upward into a jump. Land softly with knees slightly bent to absorb impact.

Reset and Repeat: Return to the partial squat position and immediately begin the next pulse and jump. Maintain control and good form throughout.'),
  ('Quick Feet', '6530e728-5444-450a-ade1-03313528a03a_gen.mp4', 'Start by standing with feet hip-width apart, knees slightly bent, and core engaged. Keep your chest lifted and arms relaxed at your sides.

Rapidly lift and lower your feet in place, moving them as quickly as possible while staying light on your toes. Maintain a small, controlled range of motion, feet should barely leave the ground.

Pump your arms naturally to help maintain rhythm and speed. Focus on staying quick and controlled rather than high or exaggerated movements.

Keep your head neutral, eyes forward, and breathe steadily throughout the exercise.'),
  ('Rainbow Leg Lifts', '472d6877-1713-4f91-967c-017dcc4773f6_gen.mp4', 'Start by lying on your back with legs extended straight and arms by your sides or under your glutes for support. Engage your core and press your lower back gently into the floor.

Lift both legs off the ground together, keeping them straight, and trace a rainbow shape in the air, starting from one side, up and over, then down to the opposite side. Move in a smooth, controlled motion.

Reverse the motion to bring your legs back to the starting position, maintaining tension in your lower abs and hip flexors throughout.

Focus on controlled, deliberate movements, keeping your lower back pressed into the floor and breathing steadily.'),
  ('Release push ups', '167ca16c-c159-403e-ad07-87f54fdd8d98_gen.mp4', 'Start in a Strong Plank: Hands under shoulders, feet hip-width apart, core and glutes engaged. Body in a straight line from head to heels.

Lower All the Way Down: Control your descent until your chest and thighs fully touch the ground, don''t flop or slam.

Release the Hands Briefly: At the bottom, lift your hands completely off the floor for a split second. This resets the rep and eliminates momentum.

Retract the Scaps: As you release, think about squeezing your shoulder blades together, this activates your upper back and teaches proper pressing mechanics.

Press Back Up Strong: Drive through your palms, keep your elbows at a ~45° angle, and press up until arms are fully extended. Avoid worming or letting your hips sag.

Reset Each Rep: Pause and lock in your body line before the next rep. This isn''t about speed, it''s about quality and control.

Breathe With It: Inhale as you lower, exhale as you power up.'),
  ('Reverse Bent Over Flys with Front Raise', '5f40c564-7bb0-4dba-8122-422fdae5b4d3_gen.mp4', 'Start by standing with feet hip-width apart, holding a dumbbell in each hand with palms facing each other. Hinge at the hips until your torso is nearly parallel to the floor, keeping a flat back, core engaged, and a slight bend in your knees.

Perform a reverse fly by lifting your arms out to the sides until they are in line with your shoulders, squeezing your shoulder blades together. Lower with control.

Next, transition into a front raise by lifting your arms straight in front of you to shoulder height, keeping elbows slightly bent. Lower slowly back to starting position.

Maintain smooth, controlled movements throughout, focusing on shoulder and upper back engagement while keeping your core tight and spine neutral.'),
  ('Reverse Grip Lat Pull Down', 'a137c97a-dcaa-4ad5-a957-2cc4281fa79b_gen.mp4', 'Start by sitting at a lat pulldown machine with feet flat on the floor. Grab the bar with an underhand (supinated) grip, hands shoulder-width apart. Sit tall with chest lifted and core engaged.

Pull the bar down toward your upper chest by driving your elbows down and back, squeezing your lats at the bottom of the movement. Keep shoulders down and back, avoid shrugging.

Slowly return the bar to the starting position with control, fully extending your arms while maintaining tension in your back muscles.

Focus on smooth, controlled reps and avoid using momentum. Keep your core tight and spine neutral throughout the exercise.'),
  ('Reverse hack squats', 'a6a14236-7799-4dba-acff-51e9c8ca17fd_gen.mp4', 'Start With a Strong Base: Stand on the platform of the hack squat machine facing toward the pads (reverse stance). Place shoulders against the pads, feet shoulder-width apart, toes slightly turned out. Brace your core and engage your glutes.

Lower With Control: Bend your knees and hips to slowly lower the sled toward the bottom position. Keep your chest tall, knees tracking over your toes, and weight through your heels.

Drive Through Heels: Push through your heels to return to the starting position. Focus on controlled movement and full engagement of glutes and quads.

Finish Strong: Stand tall at the top with glutes and core engaged. Reset and repeat for the next rep, maintaining proper form and control throughout.'),
  ('Reverse Lunge High Knee', 'ab020b87-79c4-45ef-90a6-3c44e55d9472_gen.mp4', 'Start by standing tall with feet hip-width apart and hands on your hips or at your sides. Engage your core and keep your chest lifted.

Step one foot backward into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and chest tall.

Explosively push through your front heel to return to standing, driving the rear knee up into a high knee position toward your chest. Maintain balance and control.

Repeat on the opposite leg, alternating sides for each rep. Focus on smooth, controlled transitions between the lunge and the high knee.'),
  ('Reverse lunge to curtsey variation', '10e89f8e-5f1b-40f3-ba66-22ed2fc0e171_gen.mp4', 'Setup:
Stand tall with feet hip-width apart, core braced, hands at sides or in front for balance.

Reverse Lunge:
Step one foot straight back into a reverse lunge. Lower until both knees are at ~90°, front knee stacked over ankle.

Curtsey Lunge:
Without returning to standing, sweep the same leg diagonally behind the body into a curtsey lunge. Back knee should land behind and just outside the front foot.

Return:
Push through the front heel to stand tall and repeat or switch sides.'),
  ('Reverse lunge to knee drive', 'b72ed139-caf6-4fda-b41d-35749e8c74dd_gen.mp4', 'Start by standing tall with feet hip-width apart, hands on your hips or at your sides. Engage your core and keep your chest lifted.

Step one foot backward into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and chest tall.

Push through your front heel to return to standing, driving the rear knee forward and up toward your chest in a controlled knee drive. Pause briefly at the top, engaging your core.

Repeat on the opposite leg, alternating sides for each rep. Focus on smooth, controlled movements and proper balance throughout.'),
  ('Reverse Lunge to Shoulder Press', '5002d5fc-2dc0-471a-98f5-8b3d8e21cb00_gen.mp4', 'Start by standing tall with feet hip-width apart, holding a dumbbell in each hand at shoulder height. Engage your core and keep your chest lifted.

Step one foot backward into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and chest tall.

As you push through your front heel to return to standing, press the dumbbells overhead until your arms are fully extended. Lower the dumbbells back to shoulder height with control.

Repeat on the opposite leg, alternating sides for each rep. Focus on smooth, coordinated movements, maintaining balance and core engagement throughout.'),
  ('Reverse Lunge with DB Front Raise', '393bfc5d-4667-4979-a1fe-26c8e7c84153_gen.mp4', 'Hold a light-to-moderate dumbbell in each hand at your sides

Step one leg back into a reverse lunge, keeping your front knee stacked over the ankle

As you lunge, simultaneously raise both dumbbells straight in front of you to shoulder height, arms stay straight but not locked

Lower the dumbbells as you step forward to return to the starting position

Alternate legs with each rep, maintaining balance and control

Keep your core braced and chest tall, avoid leaning forward or arching your back

Move with control, no swinging the weights during the front raise'),
  ('Rope Slams', '911aeea4-f25f-4890-93b0-ef1b4d8e041e_gen.mp4', 'Start by standing with feet shoulder-width apart, holding the ends of a battle rope in each hand. Engage your core, keep your chest tall, and knees slightly bent.

Lift the ropes overhead or to shoulder height, then explosively slam them down toward the ground using your arms, shoulders, and core. Bend your knees slightly as you slam to absorb impact and generate more power.

Immediately reset and repeat in a rhythmic, controlled manner. Focus on maintaining speed and intensity without sacrificing form.'),
  ('Rowing machine', 'd3415b38-946b-4266-8c5c-cdc7a969b5e3_gen.mp4', 'Set Up Right: Strap your feet in snugly, balls of your feet aligned with the strap. Grab the handle with an overhand grip, hands shoulder-width apart.

Focus on Form, Not Speed: Rowing is all about efficiency. Get the movement down before chasing pace.

Drive With the Legs First: Push hard through your heels to extend your legs, this is where most of your power comes from.

Then Lean Back Slightly: After leg drive, hinge back slightly at the hips (about 11 o''clock on a clock face). Keep your spine neutral and chest proud.

Finish With the Arms: Pull the handle into your lower ribs with elbows tracking back, not out. Keep shoulders relaxed.

Reverse the Order to Return: Arms extend first, then hinge forward, then bend the knees to slide back in. It''s: legs → hips → arms, then arms → hips → legs.'),
  ('Seat double handed DB snatches', '01dc76e7-934e-4d94-b83a-7bc8613f0f8b_gen.mp4', 'Start by sitting on the edge of a bench or stability ball with feet flat on the floor, holding a dumbbell in each hand between your legs. Engage your core and keep your chest tall.

Explosively drive through your hips and extend your arms to lift the dumbbells overhead in one smooth motion. Fully extend your arms at the top while keeping your shoulders engaged and spine neutral.

Lower the dumbbells back down between your legs with control, keeping your core tight and chest lifted throughout the movement.

Focus on smooth, coordinated motion, using the hips and legs to generate power rather than relying solely on the arms.'),
  ('Seated abductors', '500f6fb5-6e47-4eeb-a3ce-e7f82fadff11_gen.mp4', 'Adjust the seat so your knees are bent ~90° and the pads sit just outside the knees (not on the shins).

Sit leaning forward, core braced, and feet flat on the platform.

Start with the legs together under control, don''t let the stack slam.

Drive the knees out and lead with the outer glutes, not momentum.

Pause 1-2 seconds at the top and actively squeeze the glutes.

Slowly return to the start position (2-3 second negative).

Keep tension the entire set, avoid fully relaxing at the bottom.

Cue to give clients: "Push the floor apart with your knees."'),
  ('seated adductors', 'a7226c2d-0e9d-443a-85cb-7e8a4eec4b1b_gen.mp4', 'Control the weight through the full range of motion.
Pause and squeeze your inner thighs for 1-2 seconds at peak contraction.
Avoid using momentum, keep the movement slow and controlled.
Focus on feeling the adductors working, not just moving the weight.
Keep your core engaged and maintain proper posture throughout the set.
Prioritize quality reps over heavier weight.'),
  ('Seated barbell military press', '7e410e4a-0eb9-4484-8f94-f405a810746b_gen.mp4', 'Start by sitting on a bench with back support and feet flat on the floor. Grip the barbell slightly wider than shoulder-width apart and hold it at upper chest level. Engage your core and keep your chest lifted.

Press the barbell overhead in a straight line until your arms are fully extended, exhaling as you lift. Avoid overarching your lower back, keep the spine neutral and core tight.

Slowly lower the barbell back down to chest level with control, maintaining tension in your shoulders and arms.

Focus on smooth, controlled movements and maintain a stable seated position throughout the exercise.'),
  ('seated DB military press', '3657c8ef-7730-4cb1-832b-5a709fe1ef9f_gen.mp4', 'Sit tall on a bench with a backrest; feet flat and firmly planted on the floor

Brace your core and keep ribs down, avoid excessive lower-back arching

Start with dumbbells at shoulder height, palms facing forward or slightly in (neutral works well for shoulder comfort)

Elbows should be just in front of the body, not flared straight out

Press the dumbbells straight up until arms are fully extended but not locked out

Keep dumbbells tracking slightly inward at the top without touching'),
  ('Seated hamstring curls', '262050b3-1802-4492-b9c7-10bbcab79b76_gen.mp4', 'Adjust the machine so the back pad supports your spine and the leg pad rests just above your ankles

Sit upright with your feet on top of the foot pad and your knees aligned with the machine''s pivot point

Grip the handles for support and brace your core

Curl your legs down by contracting your hamstrings until the pad is under your seat

Control the movement on the way up, resisting momentum

Keep your hips and upper body locked in place, avoid rocking back and forth

Focus on squeezing the hamstrings at the bottom of each rep'),
  ('Shoulder taps', '35a2189c-9002-4b0d-9120-e5f1df62630e_gen.mp4', 'Start in a high plank position with hands directly under your shoulders, feet hip-width apart (or slightly wider for stability), and core engaged. Keep your back flat and hips level.

Lift one hand off the ground and tap the opposite shoulder while maintaining a stable plank. Avoid rotating your hips or shifting your weight excessively.

Return the hand to the floor and repeat on the other side, alternating taps in a controlled, rhythmic manner.

Focus on keeping your core tight, spine neutral, and movements deliberate rather than fast.'),
  ('Side to side lunge', '1cd93fb6-119c-477d-83d2-297fc8a64e43_gen.mp4', 'Start by standing tall with feet hip-width apart, hands on your hips or in front of your chest. Engage your core and keep your chest lifted.

Step one foot out to the side, bending that knee while keeping the opposite leg straight. Push your hips back and keep your chest upright as you lower into the lunge.

Drive through the bent leg to return to the starting position, then immediately step to the opposite side. Continue alternating sides in a controlled, rhythmic manner.

Focus on proper knee tracking over the toes, maintaining core engagement, and smooth, controlled movements throughout.'),
  ('Side to Side plate Step Ups', '9f544eb6-a9f9-4992-9cee-76ffdfd81aec_gen.mp4', 'Place a weight plate flat on the ground

Stand with knees slightly bent and feet shoulder-width apart, straddling the plate

Quickly step one foot onto the plate, then switch feet, alternating side-to-side

Keep your chest tall, core braced, and arms relaxed or pumping naturally

Focus on light, quick foot contact, stay on the balls of your feet

Maintain a slight forward lean from the hips for athletic positioning

Avoid locking the knees or standing upright between steps, stay low and loaded'),
  ('Single arm Bulgarian split squats', '0cade900-3672-40d0-8062-8b868e535743_gen.mp4', 'Start by standing a few feet in front of a bench or step, holding a dumbbell in one hand at your side. Place the opposite foot on the bench behind you, toes down. Engage your core and keep your chest lifted.

Lower your back knee toward the floor, bending the front knee to roughly 90 degrees. Keep your front knee tracking over your toes and your torso upright.

Push through the front heel to return to standing, keeping the dumbbell stable at your side. Maintain balance and control throughout the movement.

Repeat all reps on one side, then switch to the other arm and leg. Focus on smooth, controlled motion and proper alignment.'),
  ('Single arm Cable rows', 'ae7cf445-ac8f-4578-aac9-56aacd559174_gen.mp4', 'Set Up
Cable Machine: Set the cable at chest height or slightly lower, and attach a single handle.

Grip: Grab the handle with one hand, palm facing in (neutral grip), or slightly rotated depending on preference.

Stance: Stand with your feet shoulder-width apart, a slight bend in your knees, and a neutral spine. You can also stagger your stance for added stability.

Starting Position: Extend your arm fully, with your torso slightly leaning forward (about 10-20 degrees), keeping a straight back and engaging your core.

2. Execution (Row)
Pull the Handle: Begin by pulling the handle towards your torso. Focus on driving your elbow back and keeping your shoulder blade retracted (pull the shoulder blade towards your spine).

Elbow Path: Your elbow should stay close to your body as you row, and the movement should come from your back (not from your arm).

Squeeze the Back: At the peak of the row, squeeze your shoulder blade tightly before slowly controlling the release.

Controlled Return: Slowly extend your arm back to the starting position with control, resisting the weight to maximize muscle engagement.'),
  ('Single arm DB rows', '2e3e7a38-60c6-4b49-9f8e-abf90ecfc243_gen.mp4', 'Set Up On a Bench: Place one knee and hand on a flat bench. Your back should be flat, core engaged, and shoulders square to the ground. The opposite foot is planted firmly on the floor, dumbbell in that same-side hand.

Neutral Spine, No Twisting: Keep your torso still throughout the movement. No rotating or jerking, just smooth, controlled pulls.

Row Low and Tight: Pull the dumbbell toward your hip, not your shoulder. Elbow should stay close to your side and travel slightly back, not out.

Squeeze at the Top: At the peak of the movement, pause and squeeze your lat and shoulder blade before lowering with control.

Don''t Shrug: Keep your shoulder down and away from your ear, avoid using your trap to compensate.

Control the Eccentric: Lower the weight slowly and under control. Don''t let gravity do the work.

Use a Full Range: Let your arm extend fully at the bottom without losing tension in your lat or collapsing in your posture.'),
  ('Single arm DB Snatches', 'e7de6b40-aeda-4818-89e9-4832cf0758a7_gen.mp4', 'Start with a dumbbell on the floor between your feet, feet shoulder-width apart

Hinge at the hips and grip the dumbbell with one hand, keeping your back flat and chest up

Explosively drive through your hips and legs to pull the dumbbell upward in one powerful motion

As the dumbbell rises, shrug your shoulder and punch overhead, locking out your elbow

Finish standing tall with the dumbbell overhead, bicep close to ear and core braced

Lower the dumbbell back to the floor with control or bring it to the shoulder before resetting

Alternate arms or complete all reps on one side before switching

Focus on power from the hips, not muscling the weight up with your arm'),
  ('Single leg DB hip thrust', '73c9eefe-242d-4fa2-adc8-551045f2e2f0_gen.mp4', 'Start by sitting on the floor with your upper back against a bench or elevated surface, knees bent, and feet flat on the ground. Place a dumbbell on your hips for added resistance.

Extend one leg straight out in front of you while keeping the other foot planted. Engage your core and glutes.

Drive through the planted heel to lift your hips toward the ceiling, fully extending the hip of the working leg. Pause at the top, squeezing your glutes.

Lower your hips back down with control, maintaining tension in the glutes and core. Complete all reps on one side, then switch legs.

Focus on smooth, controlled movements, keeping the extended leg stable and spine neutral throughout.'),
  ('Single leg glutebridge', '5a11fce8-32cd-4c48-8ca6-7c2bc1c64c85_gen.mp4', 'Start by lying on your back with knees bent, feet flat on the floor, and arms at your sides for support. Engage your core and glutes.

Extend one leg straight out in front of you while keeping the other foot planted. Press through the heel of the planted foot to lift your hips toward the ceiling, forming a straight line from shoulders to knees.

Pause at the top, squeezing your glutes, then lower your hips back down with control. Complete all reps on one side, then switch legs.

Focus on maintaining a stable pelvis, controlled movement, and keeping your extended leg aligned with your torso throughout the exercise.'),
  ('Single leg glutebridge with hold', 'f51a0451-e8f6-4e6f-9bf2-7049102f5d54_gen.mp4', 'Start Position:

Lie on your back with knees bent, feet flat on the floor.

Arms by your sides, palms down.

Lift one foot off the ground and extend that leg straight or keep the knee bent at 90° (whichever is more comfortable).

Keep the other foot planted, this will be your working leg.

Movement:

Drive through the heel of the grounded foot.

Squeeze your glutes to lift your hips off the ground until your torso forms a straight line from shoulders to knees.

Hold the top position for 5-30 seconds, depending on your strength level.

Keep your hips level, don''t let them drop or twist.

Lower:

Slowly lower back down with control.

Repeat on the same leg or alternate.'),
  ('Single leg leg press', '2a304bdb-5980-499d-957a-5a96797aacdd_gen.mp4', 'Sit comfortably in the leg press machine and place one foot high on the platform, slightly above center

Your toes can point slightly outward if that feels natural, other leg stays off the platform

Keep your hips and lower back firmly pressed into the seat pad

Lower the platform slowly by bending the working leg, allowing the knee to move toward your chest

Press through your heel, extending the leg without locking out the knee at the top

Focus on driving through the glute and hamstring on the working side

Inhale on the way down, exhale as you press

This stance shifts more of the load to the posterior chain, making it great for glute-focused training or posterior chain isolation

Maintain full control and avoid bouncing or shifting your hips'),
  ('Single-Arm Cable Tricep Pulldown (No Handle)', '8c498389-1ac8-4c5a-b6e7-96f33a5e81ec_gen.mp4', 'Grip the cable end directly (no attachment) with a neutral grip (thumb pointing forward).

Stand upright or lean slightly forward; feet staggered for stability if needed.

Keep your elbow close to your side and fixed, all movement should come from the forearm.

Extend your arm straight down, squeezing the tricep at the bottom.

Control the negative, resist the weight on the way up.

Avoid letting your shoulder elevate or rotate, keep it stable and down'),
  ('Single-Arm Dumbbell Row (Incline Bench Support)', '7bf9736b-2dc2-4d17-b0bb-dd46b17cb8df_gen.mp4', 'Set a bench at an incline (about 30-45°).

Place your non-working hand and same-side knee on the bench for support, torso angled parallel to the bench.

Keep your spine neutral and your core braced.

The working arm holds a dumbbell, fully extended beneath the shoulder.

Pull the dumbbell toward your hip by driving your elbow up and back.

Keep your shoulder away from your ear and avoid shrugging.

Squeeze your lat at the top of the movement.

Slowly lower the dumbbell to full extension with control.

"Drive the elbow, not the hand."

"Keep your torso still, no twisting."

"Think: back pocket, not shoulder."

"Brace your core to avoid rotating."'),
  ('Sit up to Dumbbell Press', '6c64ebd9-8fcf-4905-9ec5-15600798c8c1_gen.mp4', 'Lie flat on your back with knees bent, holding a dumbbell in each hand at your chest

Perform a full sit-up, keeping your feet planted and core engaged throughout

At the top of the sit-up, press the dumbbells overhead, arms fully extended, biceps by ears

Lower the dumbbells back to your chest, then lower back down to the floor with control

Exhale as you sit up and press, inhale as you return down

Avoid using momentum, keep the movement core-driven and controlled'),
  ('Sit ups', 'b1532c48-cdec-4fbf-b58f-db2bd41647c8_gen.mp4', 'Start by lying on your back with knees bent, feet flat on the floor, and hands either behind your head, across your chest, or reaching forward. Engage your core and keep your lower back pressed lightly into the floor.

Curl your torso up toward your knees by contracting your abdominal muscles, lifting your shoulder blades off the ground. Exhale as you rise.

Lower yourself back down with control, keeping your core engaged and avoiding pulling on your neck if hands are behind your head.

Focus on smooth, controlled movements and maintain tension in your abs throughout the exercise.'),
  ('SkiErg', 'de15fd2d-6380-4a42-a995-072146f36190_gen.mp4', 'Start by standing with feet hip-width apart, knees slightly bent, and core engaged. Grab the handles of the SkiErg with an overhand grip, arms extended in front of you at shoulder height.

Pull the handles down toward your torso in a controlled motion, driving your elbows straight back and engaging your lats, shoulders, and core. Simultaneously, slightly bend your knees and hinge at the hips to generate power from your lower body.

Return the handles to the starting position with control, keeping tension in your upper back and core throughout. Repeat in a smooth, rhythmic manner.

Focus on coordinated movement between upper and lower body, maintaining posture and avoiding excessive leaning or rounding of the back.'),
  ('Skiers', 'cbbf2e51-2f0c-4cb0-9355-22659a3c39ac_gen.mp4', 'Start by standing with feet hip-width apart, knees slightly bent, and core engaged. Hold a light dumbbell or no weight at all, with arms bent at your sides.

Jump laterally from side to side, driving your arms in a skiing motion, swinging them forward and back in coordination with your legs. Land softly on the balls of your feet, keeping knees slightly bent to absorb impact.

Maintain a quick, rhythmic pace, keeping your torso upright and core tight throughout. Focus on controlled landings and smooth side-to-side movement.'),
  ('SL Dumbbell Deadlift', 'f9abdf8f-ab26-4e1a-9575-ad355f9f06bc_gen.mp4', 'Start by standing tall with feet hip-width apart, holding a dumbbell in each hand in front of your thighs. Engage your core and keep your chest lifted.

Shift your weight onto one leg and hinge at the hips, lowering the dumbbells toward the floor while extending the opposite leg straight back for balance. Keep a slight bend in the standing knee and maintain a neutral spine throughout the movement.

Drive through the heel of the standing leg to return to the starting position, bringing the extended leg forward to meet the other. Repeat on the same side, then switch legs.

Focus on controlled movement, balance, and proper hip hinge mechanics, keeping your core tight and back flat throughout.'),
  ('Sleds', '4eaa3ad4-72cd-422b-835c-be87c5413666_gen.mp4', 'Start by standing behind the sled with feet shoulder-width apart. Grip the sled handles or push pad, keeping your arms extended but relaxed. Engage your core, brace your glutes, and maintain a slight forward lean from your ankles.

Drive through your legs, pushing the sled forward with powerful, controlled steps. Keep your chest tall and back flat, maintaining steady breathing.

For sled pulls, attach the harness or rope, lean slightly back, and walk or run backward or forward, pulling the sled with consistent tension. Focus on smooth, controlled movements without jerking the sled.'),
  ('Smith machine Alt reverse lunges', '3a0f89f2-f3fa-4af7-9180-223989ce941f_gen.mp4', 'Start by positioning yourself under the Smith machine bar, resting it across your upper back. Stand tall with feet hip-width apart, core engaged, and chest lifted.

Step one foot back into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and your back knee hovering just above the floor.

Drive through the front heel to return to standing, then immediately step the opposite foot back into the next reverse lunge. Continue alternating legs in a controlled, rhythmic manner.

Focus on maintaining balance, upright posture, and smooth, controlled movements throughout.'),
  ('Smith machine alt reverse lunges into a squat', '88614960-b8d2-43c5-801c-8fbf556c0f89_gen.mp4', 'Start by positioning yourself under the Smith machine bar, resting it across your upper back. Stand tall with feet hip-width apart, core engaged, and chest lifted.

Step one foot back into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and your back knee hovering just above the floor.

Drive through the front heel to return to standing, then immediately step the opposite foot back into the next reverse lunge. After completing one rep per leg, perform a standard squat by bending both knees, pushing your hips back, and lowering until your thighs are roughly parallel to the floor.

Return to standing, then repeat the sequence: alternating reverse lunges followed by a squat. Focus on smooth, controlled transitions between movements, keeping your core tight and chest lifted.'),
  ('Smith machine back squats', 'b7da5cf5-9314-4241-9660-929296a845bc_gen.mp4', 'Position the bar across your upper traps, not your neck

Stand with feet slightly in front of the bar (not directly underneath like a free barbell squat)

Unrack the bar by rotating it out of the hooks and set your stance shoulder-width apart

Lower into a squat by pushing your hips back and bending at the knees, keeping your chest tall

Go to at least parallel (or deeper if mobility allows), then drive through your heels to return to standing

Keep your core braced, back neutral, and knees tracking over toesAvoid locking out your knees at the top, keep tension'),
  ('Smith machine Curtsey Lunges', '517411f3-63bf-4b7f-9e57-9eca50977ee0_gen.mp4', 'Start by positioning yourself under the Smith machine bar, resting it across your upper back. Stand tall with feet hip-width apart, core engaged, and chest lifted.

Step one leg diagonally behind you and across your body, lowering into a curtsey lunge. Keep your front knee tracking over your toes and your torso upright.

Drive through the front heel to return to standing, then repeat on the opposite leg. Continue alternating sides in a controlled, rhythmic manner.

Focus on maintaining balance, proper knee alignment, and smooth, controlled movements throughout.'),
  ('Smith machine hack squats', 'be41fad3-2d92-4f3f-8ddf-2390e782d438_gen.mp4', 'Start With a Strong Base: Stand on the platform of the Smith machine with feet shoulder-width apart, toes slightly turned out. Position the bar across your shoulders behind your neck, brace your core, and engage your glutes.

Lower With Control: Bend your knees and hips to slowly lower yourself into a squat. Keep your chest tall, knees tracking over your toes, and weight through your heels. Go down until thighs are at least parallel to the platform.

Drive Through Heels: Push through your heels to return to the starting position. Maintain controlled movement, keeping glutes and quads engaged throughout.

Finish Strong: Stand tall at the top with glutes and core engaged. Reset and repeat for the next rep with proper form.'),
  ('Smith Machine Reverse Lunges', 'b27e649f-0bda-47e3-8f04-12d3b58d1de3_gen.mp4', 'Start by positioning yourself under the Smith machine bar, resting it across your upper back. Stand tall with feet hip-width apart, core engaged, and chest lifted.

Step one foot back into a reverse lunge, bending both knees to roughly 90 degrees. Keep your front knee tracking over your toes and your back knee hovering just above the floor.

Drive through the front heel to return to standing, then step the opposite foot back into the next reverse lunge. Continue alternating legs in a controlled, rhythmic manner.

Focus on smooth, controlled movements, maintaining balance, upright posture, and tight core engagement throughout.'),
  ('Smith machine split squats', '53e72af1-94d0-44fd-ad45-e5c0f4a98ae1_gen.mp4', 'Set the bar just below shoulder height and step under to unrack

Stand tall, then take a big step back with one foot into a lunge stance, front foot should be about 2-3 feet ahead of the bar''s vertical path

Keep your torso upright and core engaged throughout

Lower down until your back knee is just above the floor, keeping your front knee stacked over your ankle

Drive through the front heel to return to standing without locking the knee at the top

Maintain light tension through the bar and avoid pushing through your back leg

Perform all reps on one side before switching'),
  ('Smith machine Sumo back squats', 'f834f6d9-f1e5-421e-b9ab-9b5345fe3737_gen.mp4', 'Take a wider-than-shoulder-width stance with toes slightly turned out.
Keep your chest tall, core braced, and maintain a neutral spine throughout the movement.
Sit your hips back and down, driving your knees out in line with your toes.
Lower until your thighs are at least parallel to the floor while maintaining tension in your glutes and inner thighs.
Drive through your heels and midfoot to stand, squeezing your glutes at the top.
Avoid letting your knees cave inward or shifting onto your toes.
Control the tempo, don''t bounce out of the bottom position.'),
  ('Sprints', '292cee09-1f6a-4f57-89a3-a0aa62660b22_gen.mp4', 'Start With a Strong Base: Stand tall with feet hip-width apart, knees slightly bent, and core engaged. Arms should be relaxed but ready to pump naturally.

Explode Forward: Push through your toes and drive your knees up as you sprint forward. Focus on a quick, powerful stride while keeping your chest upright.

Arm Drive: Pump your arms aggressively in sync with your legs, elbows bent at roughly 90 degrees, driving back and forth to help propel your speed.

Maintain Form: Keep your head neutral, eyes forward, and core tight. Avoid leaning excessively or overstriding.

Finish Strong: Sprint through the finish line or target distance, maintaining maximum effort until you decelerate safely.'),
  ('Squat to toe tap', 'a402b097-aabd-422e-b280-6d0d59a11751_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, toes slightly turned out. Brace your core and engage your glutes before you move.

Drop With Control: Squat down by pushing your hips back and keeping your chest tall. Lower until your thighs are at least parallel to the ground, knees tracking over toes.

Reach Up and Tap: Stand back up through your heels, then lift one leg straight in front of you and tap your toes lightly on the ground, engaging your core for balance.

Alternate and Repeat: Return the foot to the ground and repeat on the other side. Focus on control and balance with each squat and toe tap.'),
  ('Stairmaster', '546fc2d5-9aee-442e-872d-bd72ec1dd682_gen.mp4', 'Start With a Strong Base: Stand tall on the StairMaster with feet shoulder-width apart. Keep your core engaged, shoulders relaxed, and chest lifted.

Step With Control: Place one foot on the next step, then follow with the other foot, maintaining a smooth, continuous rhythm. Focus on driving through the heels and midfoot to engage glutes and legs effectively.

Arm Drive: Move your arms naturally in coordination with your legs, keeping them relaxed but active to help maintain balance and momentum.

Maintain Form: Keep your torso upright and avoid leaning excessively on the handrails. Keep knees slightly bent to absorb impact and reduce strain.

Finish Strong: Continue at a consistent pace, adjusting speed or resistance to challenge yourself safely while maintaining proper form.'),
  ('Standing abductors', 'fc3216af-3ed9-4140-96db-09ca0c6da8ab_gen.mp4', 'Stand tall holding onto a support (machine, pole, or wall) for balance

Keep hips square and torso upright, no leaning to the side

Working leg moves straight out to the side with a soft bend in the knee

Lead with the heel and think about pushing the floor away

Pause briefly at the top and squeeze the side glute before returning slowly

Control the negative, don''t let the weight pull you back

Exhale as you abduct, brace your core throughout'),
  ('Standing Arnold press', 'af854a00-a3fa-4704-9c49-45f1acc13401_gen.mp4', 'Start Position:

Stand tall with feet shoulder-width apart, core engaged.

Hold a dumbbell in each hand in front of your shoulders:

Palms facing you, elbows bent (like the top of a bicep curl).

Dumbbells close together in front of your chest.

Pressing Motion:

As you press the dumbbells overhead, rotate your palms outward so that they end up facing forward at the top.

Arms should be fully extended at the top, with biceps near your ears.

Return:

Reverse the motion: lower the dumbbells while rotating the palms back toward you, ending in the same front rack position.

Repeat for desired reps.'),
  ('Standing banded rows', '0314249d-1d16-4241-a760-9b50c380f33d_gen.mp4', 'Start With a Strong Base: Stand on the center of a resistance band with feet shoulder-width apart. Hold the band handles or ends with both hands, palms facing each other. Engage your core and keep a slight bend in your knees.

Pull With Control: Drive your elbows back and squeeze your shoulder blades together, pulling the band toward your torso. Keep your chest tall and shoulders down, avoiding shrugging.

Return Slowly: Extend your arms forward in a controlled manner, keeping tension on the band throughout the movement.

Finish Strong: Maintain a tight core and upright posture for the entire set. Focus on slow, controlled reps rather than speed.'),
  ('Standing cable Front Raise', 'b91fae91-d5bc-4259-ba79-deb1edc88f11_gen.mp4', 'Start With a Strong Base: Stand tall with feet shoulder-width apart, holding the cable handle with an overhand grip. Keep a slight bend in your knees, core engaged, and chest lifted.

Raise With Control: Lift the cable handle straight in front of you to shoulder height, keeping arms extended but not locked. Focus on using your shoulder muscles rather than momentum.

Lower Slowly: Slowly return the handle to the starting position, maintaining tension on the cable throughout the movement. Avoid letting the weight drop quickly.

Finish Strong: Keep your shoulders down and back, core tight, and torso stable for the entire set. Focus on controlled, smooth repetitions.'),
  ('Standing DB military press', '1dba6892-baf1-4428-a164-0440d0c4d8d6_gen.mp4', 'Stand tall with feet hip-width apart, knees soft, and core fully engaged

Hold a dumbbell in each hand at shoulder height, palms facing forward, elbows slightly in front of your torso

Press the dumbbells straight overhead, keeping your wrists stacked over your elbows

At the top, biceps should frame your ears, avoid letting the dumbbells drift forward

Slowly lower back to the start with control, don''t let the weights drop

Keep your ribs tucked and avoid arching your back, glutes and core should stay tight'),
  ('Standing marches ( 1 DB overhead other at side)', 'c61ba6ed-2bae-45c9-9ed2-9734bc39e202_gen.mp4', 'Hold one dumbbell overhead with your arm fully extended, the other dumbbell hangs at your side.
Keep your ribs tucked and core braced, avoid leaning or arching your back.
March in place by driving one knee up to hip height, then alternate legs.
Move slow and controlled, focus on balance and maintaining upright posture.
Keep the dumbbell overhead stable, don''t let your arm sway or drop.'),
  ('Stationary Side-to-Side Lunges', 'a140d88f-aca3-4906-a60e-c72d70e3fa75_gen.mp4', 'Stand in a wide stance, feet flat, toes slightly turned out.
Hold a single dumbbell vertically in front of you with both hands (neutral grip, arms extended down like a hammer hold).
Shift your weight to one side, bending one knee while keeping the other leg straight.
Sit your hips back and down into the lunge, keeping your chest up and core braced.
Push through your heel to return to center, then shift to the opposite side.
Keep both feet planted and your spine neutral throughout the movement.'),
  ('Step board side to side squats', '49073248-7c13-457d-9d6b-7a5855667ba1_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, next to a low step or board. Brace your core and engage your glutes before you move.

Step and Squat: Step one foot onto the board, then squat down by pushing your hips back and keeping your chest tall. Lower until your thigh is roughly parallel to the ground, letting your knee track over your toes.

Return and Alternate: Step back down with the same foot and immediately step to the other side, repeating the squat. Keep the movement controlled and continuous.

Finish Strong: Stand tall at the top with glutes and core engaged after each step. Focus on smooth transitions and maintaining balance throughout.'),
  ('Step board up & down', '20e38a02-099a-43ca-bc66-20394b837ffc_gen.mp4', 'Start With a Strong Base: Stand tall in front of a stepboard or platform with feet hip-width apart. Engage your core, keep chest lifted, and arms relaxed by your sides.

Step Up: Place one foot onto the board, pressing through the heel to lift your body upward. Follow with the other foot, standing fully on the board.

Step Down: Lead with the same foot to step back down, followed by the opposite foot, returning to the starting position. Repeat for the desired number of repetitions, alternating the leading foot if preferred.

Maintain Form: Keep movements controlled and deliberate, focusing on balance, core engagement, and upright posture throughout. Avoid rushing or letting your knees cave inward.'),
  ('Stepboard lateral step ups', '0a287726-12bf-4d90-a521-2ebf29e7096b_gen.mp4', 'Start With a Strong Base: Stand beside a stepboard or low platform with feet hip-width apart. Engage your core and keep chest lifted, arms relaxed at your sides.

Step Up: Place the foot closest to the stepboard onto it, pressing through the heel to lift your body upward. Bring the opposite foot to meet the stepping foot at the top if desired, or keep it hovering for added balance challenge.

Step Down: Lower back down with control, leading with the same foot, and repeat for the desired number of reps. Switch sides to work the opposite leg.

Finish Strong: Maintain an upright posture, core engaged, and controlled movements throughout. Focus on light, deliberate steps rather than rushing through the motion.'),
  ('Stretch Regimen', '2fa678ea-b6a1-4c1d-8716-8d7d2e709f23_gen.mp4', 'Start With a Strong Base: Begin standing or seated in a comfortable position with feet hip-width apart. Engage your core lightly and focus on steady, calm breathing.

Move Through Stretches: Perform each stretch slowly and deliberately, holding for 20-30 seconds. Include stretches for major muscle groups:

Neck and shoulders (neck tilts, shoulder rolls)

Chest and back (chest opener, cat-cow stretch)

Arms (triceps stretch, biceps stretch)

Hips and glutes (figure-four, seated hip stretch)

Hamstrings and quadriceps (standing or seated hamstring stretch, quad stretch)

Calves (wall calf stretch, downward dog variation)

Focus on Form: Keep movements controlled and avoid bouncing. Stretch to a point of mild discomfort, not pain, and maintain proper posture throughout.

Finish Strong: End the session with deep, slow breaths and gentle full-body movements to reset posture and relax the muscles.'),
  ('Sumo deadlifts', '3e0768dc-1c20-45b3-bede-431b4a918f5c_gen.mp4', 'Start With a Strong Base: Stand with feet wider than shoulder-width apart and toes slightly turned out. Position a barbell over the middle of your feet. Engage your core, keep your chest lifted, and hinge at the hips to grip the bar with hands inside your knees.

Set Your Position: Pull your shoulders back and down, bracing your lats. Ensure your back is flat and spine neutral, with eyes looking forward or slightly down.

Lift With Power: Drive through your heels and extend your hips and knees simultaneously to lift the barbell. Keep the bar close to your body as you rise to standing, squeezing your glutes at the top.

Lower With Control: Hinge at the hips to slowly lower the barbell back to the ground, maintaining a flat back and tight core throughout. Reset your stance and repeat.'),
  ('Sumo Squat into Knee To Elbow', 'fc058bd5-3568-47c2-b067-6b0844ce46a2_gen.mp4', 'Start With a Strong Base: Stand with feet wider than shoulder-width apart, toes pointing slightly outward. Brace your core and engage your glutes before you move.

Drop Into a Sumo Squat: Push your hips back and squat down, keeping your chest tall and knees tracking over your toes. Lower until your thighs are at least parallel to the ground.

Drive Up and Twist: Push through your heels to stand and lift one knee toward the opposite elbow, rotating your torso slightly to engage your obliques. Keep core tight and maintain balance.

Alternate and Repeat: Return to the starting position and perform the knee-to-elbow movement on the other side after the next sumo squat. Focus on control, rotation, and proper squat mechanics throughout.'),
  ('Superman', '4ac967bd-7c2b-460d-bb80-6775dbf785a9_gen.mp4', 'Start With a Strong Base: Lie face down on a mat with legs extended straight and arms reaching forward. Keep your neck neutral and gaze toward the floor. Engage your core and glutes.

Lift With Control: Simultaneously raise your arms, chest, and legs off the ground, squeezing your glutes and upper back. Focus on lifting with your muscles, not momentum.

Hold Briefly: Pause at the top for 1-2 seconds, maintaining tight core and glute engagement.

Lower Slowly: Lower arms, chest, and legs back to the mat in a controlled manner without letting them drop. Reset and repeat for the desired number of repetitions.'),
  ('Superman’s with DB press', 'a6f80a47-854a-4c7c-8135-d1844a1c6480_gen.mp4', 'Start With a Strong Base: Lie face down on a mat with legs extended straight and arms holding light dumbbells, reaching forward. Keep your neck neutral and gaze toward the floor. Engage your core and glutes.

Lift With Control: Simultaneously raise your arms, chest, and legs off the ground, squeezing your glutes and upper back. Keep the dumbbells controlled, not swinging.

Press: At the top of the lift, perform a small dumbbell press by extending your arms slightly forward and up, then bring them back in line with your shoulders while maintaining the lift.

Lower Slowly: Lower your arms, chest, and legs back to the mat in a controlled manner, keeping core engaged throughout. Reset and repeat for the desired repetitions.'),
  ('T-flys', '9003e4f8-2877-445a-b299-a6765074c1a2_gen.mp4', 'Set-Up:
Grab light dumbbells (5-10 lbs, focus is on control, not weight).

Stand with feet hip-width apart, hinge forward at the hips (torso ~45° or parallel to the floor).

Keep a flat back, soft knees, and neutral neck (eyes down).

Let your arms hang below you, palms facing each other, elbows slightly bent.

Execution:
Raise both arms out to the sides in a wide arc (like making a "T" with your body), keeping a soft elbow bend.

At the top, your arms should be in line with your shoulders or slightly behind.

Pause and squeeze your shoulder blades together for 1 second.

Slowly lower back down to the start.'),
  ('Tempo banded back squats', '246135be-d39d-420b-b370-12cdcb05dd97_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, toes slightly turned out. Place a resistance band just above your knees. Position a barbell across your upper back (not your neck), brace your core, and engage your glutes.

Drop With Control: Squat down slowly, taking 3-5 seconds to reach the bottom. Keep your chest tall, hips back, and knees tracking over toes while pushing outward against the band to activate glutes and hip abductors.

Drive Through Heels: Push through your heels to stand, maintaining tension on the band and keeping the barbell stable. Focus on controlled movement and glute and quad engagement.

Finish Strong: Stand tall at the top with hips and glutes fully engaged. Reset and repeat for the next rep, maintaining slow, controlled tempo throughout.'),
  ('Tempo Banded Goblet Squats', 'f63c624f-0755-40e1-842b-19e2e9014fce_gen.mp4', 'Start With a Strong Base: Stand with feet shoulder-width apart, toes slightly turned out. Place a resistance band just above your knees and hold a dumbbell or kettlebell at chest level. Brace your core and engage your glutes before you move.

Drop With Control: Squat down slowly, taking 3-4 seconds to reach the bottom. Keep your chest tall, hips back, and knees tracking over toes. Push your knees slightly outward against the band for extra glute activation.

Drive Through Heels: Push through your heels to rise, maintaining tension on the band and keeping the chest upright. Focus on controlled movement rather than speed.

Finish Strong: Stand tall at the top, fully engaging glutes and core. Reset and repeat for the next rep, maintaining slow, controlled tempo throughout.'),
  ('Toe elevated calf raises', '46454f9e-3a65-49c9-b0c0-f4ca17465e77_gen.mp4', 'Set-Up:
Use a slant board, wedge, weight plate, or calf raise block to elevate just your toes and ball of the foot.

Stand tall with your heels on the ground and toes elevated.

Feet should be about hip-width apart, pointing straight ahead (or slightly turned out depending on comfort).

Engage your core and keep a soft bend in your knees for balance.

Execution:
Raise your heels off the ground as high as possible, contracting your calves at the top.

Hold the top position for 1-2 seconds, squeezing your calves hard.

Slowly lower your heels back to the ground, allowing your calves to stretch fully at the bottom.'),
  ('Toe tap’s', 'fb2dc5d6-e797-4b6c-9c25-d075c65a0c47_gen.mp4', 'Start in 90/90: Lie on your back, knees bent at 90 degrees, and hips stacked over your knees. Keep your lower back pressed gently into the mat.

Brace the Core: Before you move, take a deep breath in through the nose and exhale through the mouth while drawing the belly button toward the spine. Lock that brace in.

Controlled Lowering: Slowly lower one foot toward the ground, tap the toe lightly, then return to starting position. Alternate sides.

Keep Low Back Anchored: Your spine should stay neutral and connected to the floor. If your back arches off the mat, reduce the range of motion.

Slow & Intentional: No swinging or rushing, this movement is all about control, not speed. Focus on maintaining tension in the deep core.

Neutral Neck & Shoulders: Keep your head resting on the ground, shoulders relaxed. No straining or shrugging.

Regress or Progress: Beginners can tap higher (closer to the glutes); advanced can tap lower or add a mini band over the knees for tension.'),
  ('Treadmill jog', '209fa1fc-8ab5-4434-bde6-3a548daa30ed_gen.mp4', 'Posture: Keep your head up, chest proud, and shoulders relaxed. Avoid looking down at your feet.

Arm Swing: Let arms swing naturally, elbows bent at 70-90°. Don''t grip the handrails.

Stride: Land softly on the midfoot, not the heel, and keep your stride relaxed and consistent.

Breathing: Breathe in through your nose and out through your mouth (deep, rhythmic).'),
  ('UH Pendlay Rows', '888ab694-7f24-41b5-a08f-24c924cbd40d_gen.mp4', 'Set-Up:
Load a barbell on the floor and stand with feet about hip-width apart, bar over mid-foot.

Grip the bar with a shoulder-width underhand (supinated) grip.

Hinge at the hips until your torso is parallel to the floor (or close to it). Your back should be flat, knees slightly bent, chest over the bar.

Brace your core hard, set your lats, and keep your spine neutral.

Execution:
Explosively pull the bar from the floor up to your lower ribs/upper abs.

Elbows should stay tight to your body, not flare out.

Pause briefly at the top, squeezing your lats and scapulae together.

Lower the bar back to the ground under control, reset completely between reps (no bouncing or touch-and-go).'),
  ('Under hand Barbell Bent Over Rows', '7cb386e9-33b5-4efe-958b-de23a4907318_gen.mp4', 'Stand with your feet hip-width apart, barbell over your mid-foot.

Grab the bar with a shoulder-width underhand grip (palms facing up).

Hinge at your hips, pushing your butt back with a slight bend in the knees.

Keep your torso at roughly 45° (or more horizontal) with your back flat and neutral, chest up, and core braced.

Execution:
Pull the bar toward your lower abs or belly button, keeping elbows close to your sides.

Squeeze your shoulder blades together at the top of the lift, pausing briefly.

Lower the bar slowly under control to the start position, fully extending the arms without letting your shoulders round forward.'),
  ('V-Ups', '5e2fa527-6fcf-481d-a6bc-ff6e3f0af0b8_gen.mp4', 'Lie flat on your back on a mat with your legs extended and arms stretched straight overhead.

Keep your feet together and toes pointed; arms should be aligned with your ears.

Execution:
Brace your core and simultaneously lift your legs and upper body toward each other.

Reach your hands toward your toes to form a "V" shape at the top.

Pause briefly at the top, keeping your abs tight and balancing on your sit bones.

Lower under control, keeping your arms and legs straight, and return to the starting position without letting your heels or shoulders touch the floor (if possible).'),
  ('Wall Sit with Alt Leg Raises', '74326a52-3c3a-409d-9aa9-138f9b637fa5_gen.mp4', 'Stand with your back against a wall, feet shoulder-width apart, and step your feet about 2 feet out from the wall.

Slide down the wall until your knees are bent at 90 degrees, thighs parallel to the floor, back flat against the wall.

Engage your core, press your entire back into the wall, and keep your head neutral (not tilting forward or back).

Keep arms either at your sides, crossed over your chest, or extended forward for counterbalance (do not push off thighs).

Execution (Leg Raises):
While holding the wall sit, lift one foot 3-6 inches off the floor by extending your knee and flexing at the hip.

Hold for 1-3 seconds, keeping your pelvis level (don''t shift weight excessively).

Lower the foot back down under control.

Repeat on the other leg.'),
  ('Wallsit', 'ca10f28e-c0d2-4d86-a499-e0478e91e26c_gen.mp4', 'Stand with your back flat against a wall, feet shoulder-width apart.

Step your feet forward about 18-24 inches from the wall. Your back and hips should stay in contact with the wall throughout.

Execution:
Slide down the wall until your knees are bent to 90 degrees, thighs parallel to the ground. Your shins should be vertical (knees directly above ankles).

Keep your core engaged, lower back pressed firmly into the wall, and shoulders relaxed.

Hold this position for the prescribed time (usually 30-60 seconds to start).

Breathe steadily, keeping your body still and avoiding fidgeting or shifting weight.'),
  ('Weighted Alt Leg Raises', '2bcb6a64-55d3-4499-96eb-0f0846e18108_gen.mp4', 'Starting Position:

Lie flat on your back on a mat.

Place your arms down by your sides with palms facing down, or underneath your glutes for lower back support.

Extend both legs straight out in front of you.

Hold a light dumbbell or ankle weights (2-10 lbs to start) on your feet, or wear ankle weights securely strapped.

Engage Your Core:

Press your lower back into the floor.

Brace your core like you''re about to get punched in the stomach.

Avoid arching your back, this is critical for spine safety.

Execution:
Lift the Legs:

Slowly lift one leg about 12-18 inches off the ground while keeping the other leg a few inches off the floor.

Keep both legs straight with toes pointed or neutral.

Pause at the top for 1-2 seconds to engage your lower abs and hip flexors.

Alternate:

Lower the raised leg slowly back to a few inches off the ground while simultaneously lifting the opposite leg.

Continue alternating legs in a slow, controlled "flutter" or "scissor" motion.'),
  ('Weighted bird dog', '148cee2c-9768-4aa5-9851-638d6a7ba2e2_gen.mp4', 'Set Up Neutral: Start in a tabletop position, shoulders over wrists, hips over knees, spine neutral. Keep a flat back and brace your core before moving.

Light Weight, Big Focus: Use a light dumbbell or ankle/wrist weight, this move is about control, not load.

Extend Opposite Arm & Leg: Slowly extend one arm and the opposite leg simultaneously. Keep both limbs in line with your torso, no arching or twisting.

Hold & Squeeze: Pause at the top of the extension. Squeeze your glutes, engage your core, and keep your hips square.

Controlled Return: Slowly bring your arm and leg back under your body without losing balance or sagging in the lower back.

No Rocking or Rushing: Keep everything tight and steady, this move is about stability, not speed.

Focus on Breathing: Inhale as you extend, exhale as you return. Keep the breath controlled to support your core stability.'),
  ('Weighted box step ups', 'bd632b4b-a56e-41a9-bd0a-607cf40987ef_gen.mp4', 'Set Up the Box/Platform:

Choose a box or platform that is sturdy and around knee height or slightly below (about 12-24 inches high, depending on your fitness level). The height of the box will determine the range of motion and muscle activation, with a higher step engaging more glutes and hamstrings.

Place the box in front of you with enough space for a stable step-up.

Grab Weights:

Hold a pair of dumbbells or kettlebells by your sides with a neutral grip (palms facing inward) or use a barbell across your shoulders if you''re looking for more resistance.

Ensure your posture is upright and your core is engaged throughout the exercise.

Start Position:

Stand in front of the box with your feet shoulder-width apart, keeping a slight bend in your knees. Your torso should be upright, and your chest should be proud (not rounded).

Place your foot firmly on the box, making sure your full foot is in contact with the platform (avoid having your toes hang off the edge).

Step Up:

Push through the heel of the foot that is on the box, engaging the glutes and quads to lift your body up. Your torso should remain as upright as possible; avoid leaning forward.

As you step up, bring your other leg (the one that is still on the ground) up to the box without letting it touch the surface. Your standing leg should do most of the work.

Keep your core tight and control the movement as you rise up.

Step Down:

Slowly reverse the movement, keeping your balance as you lower one leg back down. Make sure to step down with control (don''t just drop your foot). The focus should be on the eccentric portion of the movement.

Fully extend your standing leg at the bottom to reset and prepare for the next rep.'),
  ('weighted side plank twist', 'd01c6644-aa02-4098-bf5f-6baf6a7e7f5f_gen.mp4', 'Set up in a side plank with elbow stacked directly under the shoulder.

Feet stacked or staggered for stability; body forms a straight line head to heels.

Hold a dumbbell or plate in the top hand, arm extended toward the ceiling.

Brace the core and rotate the weight down and under the torso, keeping hips lifted.

Control the twist, this is slow and deliberate, not fast.

Rotate back to the start position, squeezing the obliques at the top.

Keep shoulders stacked and avoid collapsing into the supporting shoulder.

Maintain neutral head and neck alignment.'),
  ('Wide grip cable tricep pull down', 'a4f4e61c-f4d9-4e91-b3a4-5660dd310665_gen.mp4', 'Set Up the Cable Machine:

Attach a wide bar or rope handle to the high pulley on a cable machine.

Adjust the weight to your current strength level, making sure it''s challenging but allows you to maintain good form throughout the set.

Grip and Stance:

Stand facing the machine, feet shoulder-width apart, and take a step back so there''s slight tension on the cable.

Grab the wide bar with an overhand grip (palms facing down) at a distance that''s wider than shoulder-width, but not so wide that it feels uncomfortable. Your arms should be fully extended in front of you at shoulder height.

Keep your elbows close to your body throughout the movement. Avoid flaring the elbows outward, as this can reduce tricep activation.

Start Position:

Begin with your elbows bent at about 90 degrees and your forearms parallel to the ground.

Engage your core and pull your shoulder blades back slightly to maintain a neutral spine.

Keep your chest up and your torso stable.

Push the Bar Down:

Exhale and push the bar down by extending your arms at the elbows, keeping your elbows locked in place at your sides.

Focus on driving through the triceps, not the forearms. The movement should come from your elbow joint rather than your wrists or shoulders.

As you press the bar down, keep your chest lifted, and avoid leaning forward or using excessive body momentum to finish the movement.

Squeeze and Hold:

At the bottom of the movement, fully extend your arms, but avoid locking your elbows.

Squeeze your triceps hard at the bottom for a brief moment to maximize muscle activation.

Controlled Return:

Slowly allow the bar to return to the starting position by controlling the weight. Don''t let it snap back quickly, as this reduces the effectiveness of the exercise and can strain the elbow joint.

Keep your elbows in the same position as you return to the starting point, don''t let them flare out.'),
  ('Wide grip lat pull down', '9e064fb4-b038-4919-9d14-a9a5b1339f92_gen.mp4', 'Grip Wide, But Not Maxed Out: Hands should be wider than shoulder-width, but not so wide you lose control. Use a slight bend in the elbows from the start.

Sit Tall & Lock In: Sit down with thighs secured under the pad. Keep your chest tall, core engaged, and spine neutral throughout the movement.

Slight Lean Back: Lean just slightly, 10-15°, to allow the bar to clear your face. Don''t swing or rock your torso.

Pull to Upper Chest: Draw the bar down to your upper chest/collarbone, not behind the neck. Focus on pulling your elbows down and back.

Squeeze at the Bottom: Pause and squeeze your lats for a beat at the bottom before returning. Think about tucking your shoulder blades into your back pockets.

Control the Return: Let the bar rise slowly, don''t let it jerk upward. You should feel the lats lengthen under tension.'),
  ('Wide grip T-bar rows', '6b4f75e3-3779-471e-89d4-3e2082bb7c69_gen.mp4', 'Set Up the Machine:

If you''re using a T-bar row machine, adjust the chest pad (if applicable) to make sure you''re in a comfortable position to row the weight.

Load the desired weight onto the barbell. If you''re using a landmine or T-bar attachment, set the barbell in the attachment and load the weight at the end.

Attach a wide-grip handle to the bar or use a wide barbell grip if you''re using just the bar.

Grip and Stance:

Stand over the bar with your feet about hip-width apart. You can adjust your stance depending on comfort, but usually, a slightly wider stance than your hips works best for balance and control.

Grab the handles with a wider-than-shoulder-width grip (about 1.5x the width of your shoulders). Your palms should be facing inward or slightly down, depending on your handle setup. The wider grip will activate the outer lats more effectively.

Engage your core and set your hips back, keeping a neutral spine.

Positioning Your Chest:

Hinge at the hips and bend your knees slightly. Keep your chest high, and avoid rounding your back.

Maintain a neutral spine throughout the movement to prevent injury. Your torso should be at about a 45-degree angle from the floor, but adjust based on your comfort and mobility.

Rowing the Weight:

Begin the movement by pulling the handles toward your chest, leading with your elbows. Focus on keeping your elbows wide to ensure maximum engagement of the outer lats.

As you row, squeeze your shoulder blades together at the top of the movement. This helps engage the rhomboids and traps.

Avoid using your biceps too much; the focus should be on driving the elbows back and bringing the weight toward your torso.

Controlled Descent:

Lower the weight slowly under control, resisting gravity. Do not let the weight drop quickly, as this reduces muscle engagement.

Allow your arms to fully extend, but do not lock your elbows completely. Keep the tension on your lats and back throughout the entire movement.'),
  ('Wide stance belt squats', '056d3d34-753c-467e-9a6c-f27dc3d8a3f5_gen.mp4', 'Set Up the Belt Squat Machine:

Belt Placement: Attach a squat belt or harness to the belt squat machine (or a similar apparatus) and adjust it to fit securely around your waist/hips.

Weight Loading: Set the desired weight on the machine or attach the appropriate resistance to the machine, ensuring the load is manageable and within your strength level.

Foot Placement:

Stand on the platform with your feet wide apart (wider than shoulder-width, with toes slightly pointed outward). The wider your stance, the more emphasis you place on the inner thighs (adductors) and glutes.

Ensure your feet are flat and stable on the platform to provide a solid base for the squat.

Set Your Hips:

Stand tall, ensuring the belt is secured around your waist and that there is no slack.

Engage your core and keep your chest lifted throughout the movement. The belt will pull you downward as you squat.

Lower the Weight:

Initiate the squat by pushing your hips back slightly (a hip-hinge motion), and then bend your knees to lower yourself into a squat.

As you lower, focus on keeping the knees tracking over your toes and your back straight. Keep your chest up and maintain core engagement.

Lower down until your thighs are parallel to the ground (or lower if mobility allows) without letting your knees cave inward.

Press Back Up:

To return to the starting position, push through your heels and the outer parts of your feet, driving your hips forward and extending your knees.

Keep the tension in your glutes and quads as you rise back up, avoiding any jerking motions.'),
  ('Wide stance leg press', 'd4ab0b55-ae48-4bad-bce1-7a23282b95c9_gen.mp4', 'Set Up the Machine:

Start by adjusting the seat on the leg press machine to ensure your knees form a 90-degree angle when your feet are on the platform.

Ensure the weight is set according to your current strength level.

Foot Placement:

Place your feet wider than shoulder-width apart on the platform. You can angle your feet slightly outward (toes pointed slightly outward at about 45 degrees). The wider your stance, the more you''ll engage your inner thighs.

Ensure that your feet are flat on the platform and that your heels are not lifted.

Unlock the Safety Handles:

Hold the safety handles on the machine (if present) and disengage the safety mechanism to begin the movement.

Lower the Weight:

Slowly lower the weight by bending your knees and allowing your hips to bend as well.

Keep your back flat against the seat, and your core engaged throughout the movement.

Lower until your thighs are parallel to the platform, or until you feel a deep stretch in your inner thighs and glutes.

Make sure your knees are tracking over your toes and not caving in toward the center.

Press the Weight Up:

Press through your heels and the outer part of your feet, extending your knees and hips to return the weight to the starting position.

Don''t lock out your knees completely at the top of the movement to maintain tension in the muscles.'),
  ('Zercher Good Mornings', 'c1858917-8cf3-455d-80b0-ff6078485c10_gen.mp4', 'Setup:

Position the Barbell: Start by placing the barbell on a squat rack at about chest height. Step up to the bar so that it''s positioned in the crooks of your elbows (just like in a Zercher squat). The bar should rest in the soft part of your upper arms, not on the bones.

Grip: There''s no need to use your hands, but make sure your elbows are pulled back to keep the bar in place.

Feet: Set your feet about hip-width apart, toes slightly turned out, and make sure you have a solid base to move from.

Lift the Bar: Stand up with the barbell, keeping your chest high and elbows tucked back to prevent the bar from rolling forward.

Hinge at the Hips:

Begin the movement by pushing your hips back while maintaining a neutral spine.

Keep your chest tall and your back straight (avoid rounding).

The movement should be initiated by pushing your hips backward, as opposed to bending at the waist.

Lower the Torso: Continue to hinge forward until your torso is about parallel to the ground (or as far as your mobility allows). You should feel a strong stretch in your hamstrings.

Return to Standing: Reverse the motion by driving your hips forward, squeezing your glutes, and straightening your back. Ensure that your chest remains high as you rise, avoiding the urge to round your back.')
),
-- Normalise once: trim, casefold, collapse internal whitespace. Deliberately nothing cleverer.
-- 0106's cluster normaliser strips equipment words, which would fold "DB bent over rows" into
-- "Bent Over Barbell Row" and silently overwrite a different movement's cues.
dedup as (
  select btrim(regexp_replace(lower(name_en), '\s+', ' ', 'g')) as norm, name_en, lenus_video_key, cues_en
  from src
),
-- One target row per name. Preference order is what makes a re-run land on the same row: a row this
-- migration already claimed wins, then an active row over an archived one (public.exercises has one
-- real collision today, two "Goblet Squat" rows, one of each), then oldest, then id.
match as (
  select distinct on (d.norm) d.norm, e.id
  from dedup d
  join public.exercises e
    on btrim(regexp_replace(lower(e.name_en), '\s+', ' ', 'g')) = d.norm
  order by d.norm, e.is_coach_authored desc, (e.archived_at is null) desc, e.created_at, e.id
),
upd as (
  update public.exercises e set
    -- Her cues replace the scraped ones. coalesce guards the two rows whose note is empty.
    cues_en           = coalesce(d.cues_en, e.cues_en),
    lenus_video_key   = coalesce(d.lenus_video_key, e.lenus_video_key),
    is_coach_authored = true,
    -- She programs this movement, so it is not out of scope. Un-archiving is the point of matching
    -- rather than inserting: 4 of the rows she uses were archived by the 0105 curation pass.
    archived_at       = null,
    archive_reason    = null,
    archived_by       = null
  from dedup d
  join match m on m.norm = d.norm
  where e.id = m.id
  returning e.id
)
insert into public.exercises (company_id, name_en, cues_en, lenus_video_key, is_coach_authored, equipment)
select
  -- company_id NULL = shared system seed, matching all 899 existing rows and 0108. Every read path
  -- is `company_id is null or company_id = <tenant>`, so a tenant-scoped row here would be correct
  -- for white-label and invisible to nothing today. Revisit when tenant 2 exists.
  null,
  d.name_en,
  d.cues_en,
  d.lenus_video_key,
  true,
  -- Equipment is READ OUT OF HER OWN NAME, not guessed: "DB bent over rows" is a dumbbell movement
  -- because she wrote DB. A name that mentions two kinds of equipment ("Banded Bodyweight Squats")
  -- gets NULL rather than a coin flip. 195 of the 360 new rows land a tag this way. muscle_group is
  -- left NULL on purpose: her export does not carry one, and inferring it from a name is guessing
  -- rather than reading. That is the one real gap this migration leaves; see the report.
  (select case when count(*) = 1 then min(k) end
   from (values
     ('barbell',     lower(d.name_en) ~ '\y(barbell|bb)\y'),
     ('dumbbell',    lower(d.name_en) ~ '\y(dumbbell|dumbell|db|dbs)\y'),
     ('cable',       lower(d.name_en) ~ '\ycables?\y'),
     ('machine',     lower(d.name_en) ~ '\y(machine|smith)\y'),
     ('kettlebells', lower(d.name_en) ~ '\y(kettlebell|kb)\y'),
     ('bands',       lower(d.name_en) ~ '\yband(s|ed)?\y'),
     ('body only',   lower(d.name_en) ~ '\y(bodyweight|body weight)\y')
   ) as t(k, hit) where hit)
from dedup d
where not exists (select 1 from match m where m.norm = d.norm);

-- ---------------------------------------------------------------------------------------------
-- 3. Make the collapse structural
-- ---------------------------------------------------------------------------------------------
-- Her export had four duplicate names and the next export will too. A partial unique index means a
-- second insert of the same movement fails loudly instead of quietly doubling her library. Partial,
-- because the imported catalog already contains one duplicate pair this cannot retroactively fix.
create unique index if not exists uidx_exercises_coach_authored_name
  on public.exercises ((btrim(regexp_replace(lower(name_en), '\s+', ' ', 'g'))))
  where is_coach_authored;
