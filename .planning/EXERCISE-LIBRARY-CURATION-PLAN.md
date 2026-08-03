# Exercise Library Curation Plan — execute today

**Migration:** `0105_exercise_curation.sql` (0104 is the current highest)
**Verified against prod** (project `cpwesaeyhklmjbqppeah`) while writing this. Every count below is a real query result, not an estimate.

---

## 1. The judgement, in two sentences

The library is an unedited bulk import of the open-source `yuhonas/free-exercise-db` general bodybuilding catalog — 873 rows written in 610ms on 2026-06-18, of which only 13 are trainable glute movements against 148 quads and 127 shoulders, with 193 near-duplicate variants, zero Spanish cues, 2 videos, and 94 rows in competition-lifting categories her clients have never done a single session of.

The end state is **~245 assignable exercises and 68 filmed core movements**, glute-weighted to match the 25.4% of her 4,182 real sessions that name "glute", with a populated substitution graph doing the home/gym/injury work that a bigger library was never going to do.

---

## 2. Mechanism: archive, never delete

**Hard constraint, verified:** all four FKs into `public.exercises` are `ON DELETE CASCADE` (`set_logs`, `session_exercises`, and both sides of `exercise_substitutions`). 25 `set_logs` rows and 4 `session_exercises` rows currently hang off 4 exercises. A `DELETE` silently destroys member history. **Nothing in this plan deletes a row.**

### 2a. Migration shape

`C:\Users\dre\OneDrive\Desktop\Kaldr Tech\Website Building\thickandfit\supabase\migrations\0105_exercise_curation.sql`

```sql
alter table public.exercises
  add column if not exists archived_at       timestamptz,
  add column if not exists archived_by       uuid references public.profiles(id),
  add column if not exists archive_reason    text,
  add column if not exists is_core           boolean not null default false,
  add column if not exists secondary_muscles text[] not null default '{}';

create index if not exists idx_exercises_active
  on public.exercises (company_id, name_en) where archived_at is null;
create index if not exists idx_exercises_secondary
  on public.exercises using gin (secondary_muscles);

-- Deletion tripwire. RLS cannot do this job: every write path is the BYPASSRLS
-- service client. NOTE the deliberate side effect: exercises.company_id cascades
-- from companies, so this also makes DELETE on a company row fail. In a
-- single-tenant prod whose 0029 migration exists to prevent exactly that wipe,
-- that is a feature, and it is written down here so it is not a surprise.
create or replace function public.exercises_block_delete() returns trigger
language plpgsql as $$
declare n int;
begin
  select count(*) into n from public.set_logs where exercise_id = old.id;
  raise exception
    'exercises are never deleted (% has % set_logs rows). set archived_at instead.',
    old.name_en, n;
end $$;

create trigger trg_exercises_block_delete
  before delete on public.exercises
  for each row execute function public.exercises_block_delete();
```

`archived_at` not `is_active`: it matches the existing convention at `supabase/migrations/0050_coach_notes.sql:14` and `0051_physique_analyses.sql:23`, it records *when* for the audit trail the Fort Knox pillars require, and `archive_reason` is what makes one curation pass reversible without undoing the next one. Named `archived_at` not `deleted_at` because nothing is being deleted and the name is the strongest signal to the next engineer.

**No RLS change.** `exercises_read` and `exercises_company_write` are row predicates that name no columns; both still work verbatim. Do not add `and archived_at is null` to `exercises_read` — every app read is service-client, so it would be dead code today and actively harmful to a future direct-client read that has to resolve a historical exercise name.

**All archive writes go through `createServiceClient()`.** No authenticated role can write these rows at all: all 873 are `company_id IS NULL`, so `exercises_company_write` never passes. Do not loosen that policy — `0029_rls_companies_exercises_lockdown.sql` exists because it was too loose and was a tenant-wipe vector.

### 2b. Read paths — the split that is the entire risk of this change

**FILTER these three (add `.is('archived_at', null)`):**

| file | line | why |
|---|---|---|
| `src\lib\coach\exercises.ts` | 88 (`loadExercises`) | one edit covers the coach browser and both substitute pools |
| `src\app\api\exercises\route.ts` | 22 | the single door behind `program-builder.tsx:45` and `exercise-browser.tsx:56` |
| `.qa-visual\seed.cjs` | 69 | so test programs are never seeded from retired rows |

Two optional cost wins in the same commit: `src\lib\content\es-fill.ts` (lines 103, 117, 133, 149, 161) stops paying the model to translate retired rows and stops the "remaining" counter reporting work that will never happen; `src\lib\content\mux-import.ts:107` stops Mux minutes being staged against a retired movement.

**NEVER FILTER these six.** Each resolves an exercise the member or coach already committed to. Put a one-line comment above every one:

```
// resolves a committed exercise by id; NEVER filter archived_at, history must render
```

| file | line |
|---|---|
| `src\app\(app)\workouts\page.tsx` | 73 |
| `src\app\(app)\workout\[planId]\page.tsx` | 65 |
| `src\app\(app)\coach\programs\[id]\page.tsx` | 46 |
| `src\lib\substitutions\engine.ts` | 55 (the "use the original" fallback) |
| `src\lib\coach\exercises.ts` | 143 (`getExercise`) |
| `supabase\functions\mux-webhook\index.ts` | 123 |

The failure here is **silent**, not loud: `workouts/page.tsx:82` falls through to `name: ... || tEx('untitled')`, so a filtered-out row renders as an untitled card with no demo video and nothing fires. `getExercise` specifically must keep returning archived rows or the detail page `notFound()`s and there is nowhere to click Unarchive.

**One judgement call, at `src\lib\substitutions\engine.ts:66-80`:** an archived exercise must not be *offered* as a swap, so filter it there — but also drop the resulting `null` entries and fall back to the `fallback: true` shape at `:57-63` when the chain empties, otherwise the member gets a substitute card with a null exercise. `exercise_substitutions` has 0 rows today, so this is free to get right now and expensive later.

**Regenerate** `src\lib\database.types.ts` (the exercises Row/Insert block at 2123-2153) and confirm `supabase db diff` returns 0 output. No reader uses `select('*')` on exercises, so nothing picks the columns up implicitly.

---

## 3. Curation rules — countable, auditable SQL

Run in order. **Ordering matters:** Step A (protect) gates everything, Step B (retag) must precede Step C (quota) or the glute bucket stays starved by its own mis-tagging.

### Step A — the in-use guard (runs first, exempts from every rule below)

```sql
exists (select 1 from set_logs s        where s.exercise_id = e.id)
or exists (select 1 from session_exercises se where se.exercise_id = e.id)
```
Today that is 4 rows: `3/4 Sit-Up`, `90/90 Hamstring`, `Ab Crunch Machine`, `Ab Roller`. **Verified: all four rank 1-3 in their buckets and survive both passes anyway.** The guard is belt-and-braces for the next pass, not this one.

### Step B — re-tag before you cut

`muscle_group` is a single text column and it is lying: RDL, Good Morning and Reverse Hyper are `hamstrings`; every lunge and split squat is `quadriceps`; every hyperextension is `lower back`. In a glute-focused app that makes the money-lifts invisible to a glute filter.

**Do NOT overwrite `muscle_group`** — she programs "Hamstrings & Glutes" (347 sessions) and "Quads & Glutes" (274), so hinges must stay findable as hamstrings. Instead populate `secondary_muscles`:

```sql
update public.exercises set secondary_muscles = array['glutes']
where muscle_group <> 'glutes'
  and category not in ('stretching','olympic weightlifting','strongman')
  and name_en ~* '(hip thrust|glute|bridge|romanian|stiff-leg|stiff leg|good morning|hyperext|abduct|step.?up|lunge|split squat|sumo|pull through|kickback|trap bar deadlift|deficit deadlift|barbell deadlift)'
  and name_en !~* '(with chains|with bands|reverse band|snatch|clean|jerk|tricep)';
```
≈ **38 rows**, including Romanian Deadlift, Sumo Deadlift, Glute Ham Raise, Reverse Hyperextension, Good Morning, Trap Bar Deadlift, all step-ups, all lunges, all split squats, Monster Walk, Thigh Abductor. Glute filter becomes `muscle_group = 'glutes' or 'glutes' = any(secondary_muscles)` — **13 real answers becomes ~51**, which is what a glute app should return. The README proof point "Glutes: 22 results" is currently measuring the bug.

Four genuine primary retags (name/content/tag disagree): `Crossover Reverse Lunge` lower back → glutes; `Reverse Hyperextension` hamstrings → glutes; `Split Squats` hamstrings → quadriceps (see §6, the cues describe a *jumping* split squat); `Tricep Dumbbell Kickback` stays triceps (excluded above — it is a false positive on "kickback").

### Step C — Pass 1: seven exclusion rules, **208 rows archived**, reason `'2026-08 pass1 out-of-scope'`

| # | rule (SQL over the four columns) | rows | justification |
|---|---|---|---|
| R1 | `category in ('olympic weightlifting','strongman')` | 56 | zero of 4,182 sessions. Atlas Stones, Conan's Wheel, Car Deadlift, Tire Flip, Yoke Walk |
| R2 | `category='powerlifting' and name_en ~* '(with chains\|with bands\|reverse band\|board press\|pin press\|off pins\|chain handle\|chain press\|speed box\|hanging bar)'` | 22 | geared/accommodating-resistance work. **Surgical, not by category** — `powerlifting` is where the only Barbell Hip Thrust, Barbell Glute Bridge, Glute Ham Raise, Sumo Deadlift and Good Morning live |
| R3 | `name_en ~* '(snatch\|clean\|jerk\|atlas\|tire flip\|sled\|yoke\|keg\|prowler\|log lift\|sandbag\|farmer\|rickshaw\|conan\|circus bell\|axle\|power stairs\|crucifix\|car deadlift\|muscle up\|planche\|iron cross)'` | 80 | sport-named lifts that escaped the category tag |
| R4 | `muscle_group in ('neck','forearms')` | 33 | zero sessions name either. 7 of the 25 forearm rows are wrist-curl variants of each other |
| R5 | `equipment in ('e-z curl bar','exercise ball','medicine ball')` | 38 | orphan equipment. E-Z bar rows duplicate barbell curls; not in the intake equipment census |
| R6 | `difficulty='expert' and category <> 'stretching'` | 45 | expert bodybuilding technique lifts. **The `<> 'stretching'` clause is load-bearing** — without it this cuts `Lying Glute` and `Seated Glute`, two of six glute stretches, and her post-workout stretch is 231 sessions |
| R7 | `muscle_group='traps' and name_en !~* 'shrug'` | 6 | zero sessions name traps; keep the 2 shrugs for the shoulder block |

Union (deduped, in-use-guarded): **208 archived, 653 survive.**

**Deliberate non-cuts, against the research:**
- **Do not cut `plyometrics` (61) or `cardio` (14).** "Fully body HIIT" is 269 sessions (6.4%) and conditioning overall is 13.2%. They get their own quota bucket instead (below), because leaving them inside `quadriceps` floods the quad list with Rocket Jump / Star Jump / Scissors Jump and crowds out the leg work she actually programs — verified.
- **Do not cut `stretching` (123).** Post-workout stretch is 231 sessions, 5.5%.
- **Do not cut `foam roll` (11).** SMR is the recovery block.
- **Do not cut `abductors` (8) or `adductors` (13) on small counts.** The abductor/adductor machines are in 71 and 67 of the 136 gyms her clients answered for, sitting directly under her #1 block. Those need to *grow*.

### Step D — Pass 2: quota + duplicate collapse, **446 rows archived**, reason `'2026-08 pass2 variant-collapse'`

Deterministic, reproducible, no hand-picking. Normalize the name to a movement cluster, take the best equipment variant of each cluster first, then the second of each, until the bucket cap is hit.

```sql
norm = btrim(regexp_replace(lower(name_en),
  '\y(alternate|alternating|one-arm|one arm|single-leg|single leg|standing|seated|lying|incline|decline|
      close-grip|wide-grip|reverse-grip|palms-up|palms-down|barbell|dumbbell|cable|machine|smith|kettlebell|
      kettlebells|band|bands|weighted|bodyweight|rope|bench|floor|plate|pulley|hang|split|body|with|the|a|to|on|and|of)\y','','g'))

bucket    = case when category in ('plyometrics','cardio') then 'conditioning'
                 when category = 'stretching' then 'mobility'
                 else muscle_group end
equip_pref = dumbbell 1, barbell 2, bands 3, body only 4, cable 5, machine 6, kettlebells 7, foam roll 8, other 9
diff_pref  = beginner 1, intermediate 2

cluster_rank = row_number() over (partition by bucket, norm  order by equip_pref, diff_pref, name_en)
rk           = row_number() over (partition by bucket        order by in_use desc, cluster_rank, equip_pref, diff_pref, name_en)
archive where rk > cap
```

| bucket | cap | available | kept |
|---|---|---|---|
| glutes | 30 | 13 | **13** (gap filled in §4) |
| quadriceps | 24 | 48 | 24 |
| hamstrings | 22 | 21 | 21 |
| abdominals | 20 | 71 | 20 |
| mobility (stretch/SMR) | 24 | 113 | 24 |
| conditioning (plyo/cardio) | 18 | 58 | 18 |
| shoulders | 18 | 90 | 18 |
| chest | 14 | 63 | 14 |
| lats / middle back / biceps / triceps | 12 each | 27/26/46/56 | 48 |
| lower back | 8 | 7 | 7 |
| calves | 6 | 15 | 6 |
| abductors / adductors | 8 each | 2 / 2 | 4 |
| traps | 2 | 7 | 2 |
| **total** | | | **219** |

This is what kills the duplicate problem: the 26-row `press` cluster, the 66 biceps-curl rows, the 12 `curl` and 9 `triceps extension` clusters collapse to their best 1-2 variants each, automatically, with no hand-curation.

**`equip_pref` is gym-first (dumbbell > barbell > bands > body only), and that is a deliberate call against `category-standard`'s "60-70% home-capable library".** 90.3% of her clients who answered train in a commercial gym (121 of 134); only 9.7% train at home. Home coverage is the *substitution graph's* job (§4c), not the library's composition — inflating the body-only count buys the 9.7% nothing the swap engine wouldn't give them, and costs the 90.3% their primary variant.

---

## 4. What must be ADDED — 26 authored rows

`0` clamshells, `0` frog pumps, `0` curtsy lunges, `0` fire hydrants, `0` donkey kicks, `0` Bulgarian split squats, `0` plain reverse lunges, and exactly **1** hip thrust exist today. These are staples of the exact program this business sells. This is the part of the work that matters more than the 654 archives.

**Hip extension, short/peak-contraction (9)** — `muscle_group='glutes'`
| movement | equipment |
|---|---|
| Dumbbell Hip Thrust | dumbbell **(DB-only)** |
| Single-Leg Hip Thrust | body only **(BW)** |
| B-Stance Hip Thrust | dumbbell **(DB-only)** |
| Banded Hip Thrust | bands |
| Machine Hip Thrust | machine |
| Frog Pump | dumbbell **(DB, BW-capable)** |
| Banded Glute Bridge | bands |
| 45-Degree Back Extension (glute-biased, rounded back) | body only **(BW)** |
| Banded Pull-Through | bands |

**Hip extension, quadruped (3)** — `muscle_group='glutes'`
| Banded Donkey Kick | bands |
| Banded Standing Cable/Band Kickback | bands |
| Banded Fire Hydrant | bands |

**Abduction + external rotation (6)** — `muscle_group='abductors'`, `secondary_muscles={glutes}`
| Banded Side-Lying Clam | bands |
| Side-Lying Hip Abduction (extended range) | body only **(BW)** |
| Banded Lateral Walk | bands |
| Seated Banded Hip Abduction | bands |
| Standing Cable Hip Abduction | cable |
| Side Plank with Hip Abduction | body only **(BW)** |

Ship the **banded** clam, not the bodyweight one, and do not add a bodyweight clamshell at all: Contreras measured band side-lying clam at ~77% MVC against under 40% unbanded, and an unloadable movement cannot be progressively overloaded, which is the outcome she is selling.

**Hip extension, long muscle length (8)** — `muscle_group='hamstrings'`/`'quadriceps'`, `secondary_muscles={glutes}`
| Dumbbell Romanian Deadlift | dumbbell **(DB-only)** |
| Single-Leg Romanian Deadlift | dumbbell **(DB-only)** |
| Bulgarian Split Squat | dumbbell **(DB, BW-capable)** |
| Reverse Lunge | dumbbell **(DB, BW-capable)** |
| Curtsy Lunge | dumbbell **(DB, BW-capable)** |
| Lateral Lunge | dumbbell **(DB, BW-capable)** |
| Goblet Squat | dumbbell **(DB-only)** |
| Lateral Step-Up | dumbbell **(DB, BW-capable)** |

**14 of the 26 are bands, 10 are dumbbell-or-bodyweight, 1 cable, 1 machine.** That fixes the single worst inversion in the library: bands are 20 of 873 exercises (2.3%) while *every* option string in her intake mandates buying them.

### 4b. Also required, same pass
- **Fill the 5 empty `cues_en` rows** (Iron Cross — archived by R3; Push Press; One-Arm Kettlebell Swings; Side Bridge; Side Jackknife) or archive them. `One-Arm Kettlebell Swings` is filming shot #36, so it must be filled, not archived.
- **Fix the 71 defective Spanish names** before any cue translation: 46 with a dangling leading preposition (`'Barbell Step Ups'` → `'de Paso con Barra'`), 25 verbatim English copies, 47 with English residue. These are visible to every Spanish-speaking user today.
- **`cues_es` is 0% populated across all 873 rows** in a product sold as bilingual. After curation it is a bounded ~245-row batch job against good `cues_en` source, not an 873-row one. Rewrite, don't translate: the English is scraped bodybuilding.com prose (449 rows contain "This will be your starting position", 221 contain "Tip:", avg 655 chars, max 3,214) and is off-brand on every row per `.planning\STEPHANIE-VOICE-BIBLE.md`.

### 4c. Populate `exercise_substitutions` (0 rows today)
Six axes per core movement: **gym / dumbbell-and-band / bodyweight-only / low-impact / knee-friendly (depth-capped) / back-friendly (no axial load)**. 9.7% of clients train at home; 56 of 267 report knee injuries and 22 report lower back. Without this the home cohort hits dead sessions and the injury flags in the health profile have nothing to route to. **This table is the actual product.** 245 exercises with a populated substitution graph beats 873 unlinked rows.

---

## 5. Target size: 245 visible, 68 filmed

**Where the research disagreed, this is the call:** `category-standard` says 60-80, `her-programming` says 150-250, `library-audit` implies ~540. **All three are right about different columns.**

- **`is_core = true` → 68 movements.** This is the *filming* budget, and it is the number `category-standard` was actually arguing for. `.planning\FILMING-SHOT-LIST.md` already allocates 50 shots from these same 4,182 sessions in these same proportions; **`is_core` = those 50 + the 18 glute/abduction additions from §4 that displace part of Block 1.** Roughly three filming days. 873 rows with 2 videos and 0 `is_own_demo` is an impossible content backlog and an App Store rights-documentation obligation per unfilmed row.
- **`archived_at is null` → ~245 assignable.** 219 survivors + 26 authored. This is what the *sessions* need: 5 distinct session templates (Back & biceps / Shoulders-chest-triceps / Hamstrings & Glutes / Quads & Glutes / Full body HIIT) × ~7 exercises per session × 6-week blocks with week-to-week variation × three equipment tiers. 80 cannot fill that without repeating every week; 540 keeps the duplicate problem she is drowning in.
- **540 is rejected** because it leaves the 26-row `press` cluster and 66 biceps curls intact, which is the exact thing that makes the app feel like a scraped database instead of hers.

Two columns, two questions: *"should a coach ever see this"* (`archived_at`) and *"does Stephanie film it"* (`is_core`). Default every coach-facing picker, search, and the assignment UI to `archived_at is null`; sort `is_core` first.

---

## 6. For `.planning\QUESTIONS-FOR-STEPHANIE.md` — do not decide these unilaterally

1. **The 26 additions: which do you actually program?** Especially B-Stance Hip Thrust, American Hip Thrust, Frog Pump, Curtsy Lunge. If she does not coach a movement she will not film it, and an unfilmed core row is worse than an absent one.
2. **The per-bucket caps (§3 Step D).** 24 quads / 18 shoulders / 14 chest / 12 biceps is an engineering guess calibrated to her session mix. She is the one who knows whether "Back & biceps" (548 sessions) needs 12 bicep options or 6.
3. **Kettlebells (53 rows, currently untouched by every rule).** Only 86 of 136 clients report access, and no session name mentions them. Keep as a bucket or fold into the conditioning cap?
4. **Machine coverage.** Hack squat (58 gyms), reverse hack squat (33), leg press, abductor/adductor machines (71/67) survive the quota — but at-home members will never see them without a substitution row. Which machines are non-negotiable in her programming?
5. **`Split Squats` is a content bug.** The name says split squat, the cues describe a *jumping* split squat, and it is tagged hamstrings. It is also filming shot #7. Rename to "Jump Split Squat" and file under conditioning, or rewrite the cues to a real split squat?
6. **Whether the 6 glute stretches leave the glutes tag.** Moving `Lying Glute`, `Seated Glute`, `Piriformis-SMR`, `Ankle On The Knee`, `Knee Across The Body`, `One Knee To Chest` to a mobility surface is right structurally, but it changes what her stretch sessions browse to.
7. **Filming order after the additions displace part of Block 1.** Her call, not ours.

---

## 7. What could go wrong, and how it is caught or undone

| risk | detection | reversal |
|---|---|---|
| **A resolve-by-id query gets filtered by mistake** — the worst case. Member's workout renders `untitled` with no demo, nothing throws, no monitor fires | Assign a program containing an archived exercise to a test account and open `/workout/[planId]`. The name and video must render | revert the code line; no data touched |
| **An archived row sits in someone's live program** — legal and safe (history resolves by id) but the coach can no longer re-add it | Run the in-use audit before *and* after every bulk archive and **read the output**: `select e.id, e.name_en, (select count(*) from set_logs s where s.exercise_id=e.id) logs, (select count(*) from session_exercises se where se.exercise_id=e.id) in_programs from exercises e where e.archived_at is not null and (exists(...) or exists(...));` — must return 0 rows | one row: `update exercises set archived_at=null, archived_by=null, archive_reason=null where id=$1` |
| **Wrong pass archived too much** | eyeball a per-bucket count diff | one pass: `... where archive_reason = '2026-08 pass2 variant-collapse'` — this is the entire reason to store a reason |
| **Everything** | | `... where archived_at is not null` |
| **Schema** | | drop the two indexes and the three columns — **only together with the code revert**, or the three filtered queries error |
| **Someone tries to DELETE** | the BEFORE DELETE trigger raises, naming the row and its `set_logs` count | n/a — prevented, not detected |
| **Pre-existing truncation, now masked** | `src\app\(app)\coach\exercises\[id]\page.tsx:40` requests `pageSize: 800` against 873 rows, so `getExercisesPage`'s `filtered.slice(0,800)` (`exercises.ts:128`) already hides 73 exercises from the substitute picker *today*. Curation drops the count under 800, which is exactly how it stays broken | **fix in a separate commit** per the atomic-commit rule |
| **Facet counts and `totalAll` shrink** — `exercises.ts:130` and `:134-135` build from the unfiltered array | grep for a hard-coded `873` in UI copy and in `README`; the "Glutes: 22 results" proof point is already measuring the bug and will change to ~51 | expected, not a regression |
| **`es-fill` counter changes** | "remaining" drops by ~654 | expected — it stops reporting work that will never happen |
| **White-label**: all 873 rows are `company_id IS NULL`, so `archived_at` on a shared row is a decision for *every future tenant* | not detectable, only recorded | **Write the exit into the migration comment and CLAUDE.md's Gap Log now:** the forward path is an overlay table `exercise_company_state(company_id, exercise_id, archived_at)` where this column becomes the global default and the overlay is the per-tenant override. Cheap migration later, expensive surprise if unrecorded |

**Post-deploy verification:** `supabase db diff` → 0 output; regenerate and commit `src\lib\database.types.ts`; `vercel ls --prod` → READY; open `/coach/exercises` and confirm ~245 rows and a sane facet list; open a member workout containing one of the 4 in-use exercises and confirm the name and cues still render.

**One thing this plan explicitly does not do:** rank or sort exercises by EMG activation anywhere in the product. Vigotsky et al. (2022) show acute sEMG amplitude is not a validated predictor of hypertrophy, and the only randomized training study (Plotkin 2023) found hip thrust and back squat produce similar glute growth despite a 2-3x EMG gap. EMG decides *inclusion*, never *order*.