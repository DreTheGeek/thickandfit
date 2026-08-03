# Questions for Stephanie

Decisions only Stephanie can make, because they are coaching calls or content she has to create.
Engineering questions do not belong here; if we can decide it ourselves, we decide it ourselves.

**How to use this:** work top down. Each item says what we need, why it is blocked, what we recommend,
and what happens if it goes unanswered. When she answers, move the item to **Decided** at the bottom
with the date, so the reasoning survives and nobody reopens it six weeks later.

Last updated: 2026-08-03

---

## 1. A member who picks "lose fat" AND "build muscle" is given maintenance calories

**Status:** open · **Blocks:** correct calorie targets for a large share of launch members

### What is happening

Rodney signed up on 2026-08-03 and entered:

| he told the app | |
|---|---|
| current weight | 194 lb |
| goal weight | 174 lb |
| goals | lose fat, build muscle |

The app gave him **2701 calories, which is exactly his maintenance**, and stored a plan that projects
**no weight change at all**. He asked to lose 20 lb. The app agreed to the goal, built a plan that
will never reach it, and said nothing about the contradiction.

This is not a coding mistake. It is deliberate: picking both goals is read as **body recomposition**,
and eating at maintenance for recomp is a real, defensible method. The problem is that nothing
reconciles that decision with the goal weight he just typed in.

### Why this is not a one-person problem

"I want to lose fat and tone up" is plausibly the most common way a woman describes her goal. That
exact combination is what triggers this. A large share of the launch cohort would get a calorie
number that cannot move them toward the target they set, follow it for eight weeks, not lose weight,
and conclude the app does not work.

### The question for Stephanie

**When a client says she wants to lose fat AND build muscle, and she also gives you a goal weight
20 lb below where she is now, what do you actually do?**

- **A. Put her in a deficit.** The goal weight is the real instruction. "Build muscle" means keep her
  protein high and keep her lifting so she holds her muscle while the fat comes off.
- **B. Keep her at maintenance.** Recomposition is the right call, her weight may barely move, and
  the goal weight is the wrong thing to be measuring her against.

### What we recommend: A

Four reasons.

1. **A typed goal weight is a specific promise. A checkbox is a mood.** When the two disagree, the
   specific one should win. She thought about "174." She tapped two goal buttons in three seconds.
2. **For this audience, "build muscle" usually means "look toned," not "gain mass."** Very few of her
   clients are asking to weigh the same and add muscle.
3. **The app puts the scale in her face.** Weigh-ins, charts, progress. If the number does not move
   she sees failure every week, whatever her body composition is doing.
4. **A moderate deficit with high protein and resistance training IS recomposition for most people,**
   and it moves the scale too. True eat-at-maintenance recomp is a niche protocol for people who are
   already lean and experienced.

**Whichever she picks, one thing changes regardless:** the app must stop silently storing a goal it
has no plan to reach. If we are not going to chase her goal weight, onboarding has to say so in her
words. This repo already took that exact position for target dates, in `goal-pace.ts`: *"an app that
silently accepts it has agreed to something it cannot deliver."*

### Also worth asking while we are here

- If someone picks "build muscle" and gives a goal weight **higher** than current, is that a
  straightforward gain plan, or does she still want a cap on how fast?
- Is there a client she would genuinely coach at true maintenance? If so, what does that person look
  like, so we can detect her rather than guess?

**Cost of no answer:** we ship whatever the code does today, which is option B without telling anyone.

---

## 2. 873 exercises, 2 demo videos, none of them hers

**Status:** open · **Blocks:** the single thing the product is supposed to be

### Where it stands

```
exercises in the library      873
with any video at all           2
filmed by Stephanie             0
```

The pitch for this whole app is *her* workouts with *her* filmed demos, in her voice. Right now a
member opening almost any exercise gets a name and text cues and nothing to watch. Every competitor
has video. This is the gap that makes the app feel like a spreadsheet.

### The question

**Which exercises does she film first, and by when?**

873 is not a realistic ask before launch. But the exercises that actually appear in her programs are
a much smaller set.

### What we recommend

Pick the **top 40 to 60 by how often they appear in her real programs**, and film those. We can pull
that list from the program data and hand her a shot list in priority order, so it is one or two
filming days rather than an open-ended project. Everything else keeps text cues until later.

Second question, once she is filming anyway: **does she want them in Spanish too**, or English demos
with Spanish text cues? The exercise names and cues are already fully bilingual (0 missing Spanish),
so the only gap would be her voice.

**Cost of no answer:** we launch with a library that looks unfinished next to any competitor, and the
"her workouts, her demos" promise is not true yet.

---

## 3. 10 to 15 labeled food photos, to unlock automatic meal logging

**Status:** open · **Blocks:** the auto-accept flip described in CLAUDE.md

### What this unlocks

Today, every photo scan makes the member confirm the result before it logs. We built a mode where a
scan the engine is confident about just logs itself with an Undo, which is a real speed advantage
nobody else in the category offers. It is built and shipped **off**.

It stays off until we can prove the engine is not systematically underestimating fat. The July 2026
NIH finding is that photo estimates miss roughly 250 to 345 calories per meal, largely invisible
cooking oil. We measure that with a labeled test set, and we do not have one yet, so the eval
correctly reports the fat number as "unknown" rather than inventing a passing grade.

### The question

**Can she take 10 to 15 photos of real meals and write down what was actually in them?**

Specifically the high-fat cases where photos lie:

- pan-fried protein (how much oil went in the pan)
- a dressed salad
- restaurant plates
- avocado or nuts
- a visible-oil stir fry

For each: the photo, the total fat in grams, and how much oil was used. Her own meals are perfect.

**Cost of no answer:** the feature stays off. Not broken, just unavailable, and it is one of the few
places where this app can be plainly better than Cal AI.

---

## Decided

Nothing yet. Move items here with the date and the reasoning when she answers.

<!--
Format:
### <question> — decided YYYY-MM-DD
**Answer:** what she said.
**Why:** her reasoning, in her words where possible.
**What changed:** the commit or file.
-->
