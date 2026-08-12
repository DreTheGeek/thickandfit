# PRD-C: Post-Scan Coach Moment (Intra-Day Pace)
**Branch:** main | **Risk:** MEDIUM (touches log flow + UI) | **Migration:** none
**AI time:** ~3-5h | **Depends on:** nothing | **Unlocks:** the screenshot moment

## Problem
The scan returns macros. It does not return coaching. K7 (`src/lib/prediction/engine.ts`)
projects goal dates and 30-day pace, but nothing answers the intra-day question at the moment
that matters: "I just logged dinner — where am I against today's targets, and what's the one
move left?" This is Stage 13-14 of the FitnessOS pitch, the piece it called the secret sauce,
and it's the only piece actually missing. The line users screenshot is:
> "That puts you at 132g protein. One more palm of lean meat hits your 180g."

## Design
**Deterministic first, zero AI calls, zero added latency budget.** One new pure-ish server
module computes a typed `CoachMoment` from data already in Postgres. Stephanie-voice LLM
polish is a later PRD (it would ride `AI_MODELS.chat`); do NOT add a model call here — the
confirm action must stay instant, and a wrong-but-confident LLM line at log time costs trust
(same principle as K8's "silence beats a weak suggestion").

Where it fires: at CONFIRM time (`logPhotoFoodAction` / `logFoodAction` in
`src/lib/nutrition/diary-actions.ts`), not at scan time — because only after the insert do
today's totals include this meal, and because text/search/barcode logs deserve the same
moment (source-agnostic by construction).

## Delta
ADDED: `src/lib/nutrition/coach-moment.ts`, message keys in `src/messages/en.json` + `es.json`
MODIFIED: `src/lib/nutrition/diary-actions.ts` (LogResult + both log actions),
`src/components/nutrition/photo-scan.tsx` + `src/components/nutrition/diary-screen.tsx`
(render the moment)
REMOVED: nothing.

## Tasks

### C1. `src/lib/nutrition/coach-moment.ts` (server-only)
```ts
export type CoachMoment = {
  kind: 'protein_push' | 'protein_hit' | 'kcal_watch' | 'on_track' | 'none';
  proteinG: number; targetProteinG: number | null; remainingProteinG: number | null;
  kcal: number; targetKcal: number | null; remainingKcal: number | null;
  mealSlot: string;
};
export async function buildCoachMoment(profileId, companyId, mealSlot): Promise<CoachMoment>
```
Reads (two parallel service-client queries, ~10ms):
1. `user_state` → `target_protein_g`, `target_kcal` (K3 nightly snapshot; both null for a
   fresh member → return `kind:'none'`, render nothing — silence over weak advice).
2. Today's `food_log` day totals for the member's LOCAL day — reuse the existing local-day
   helper + the same day-totals read the diary uses (`src/lib/nutrition/diary.ts`); do not
   write a new totals query if one exists.

Decision ladder (deterministic, tight):
- protein >= target → `protein_hit` (celebrate; the existing `protein_goal_hit`
  domain_event already fires elsewhere — do NOT emit a duplicate here).
- remaining protein > 0 AND mealSlot is 'dinner' or 'snack' (the day is nearly spent) →
  `protein_push` with remaining grams. Include a food-shaped hint ONLY from the member's own
  top habit foods (reuse `buildScanContext`'s habit aggregation or read
  `user_state.favorite_foods`) — never a generic food she may not eat.
- kcal over target by >10% → `kcal_watch` (state fact, no shame language — brand voice).
- else → `on_track`.

### C2. Bilingual copy
next-intl keys under `nutrition.coachMoment.*` in `en.json` + `es.json`, one template per
kind, with `{remaining}`, `{target}`, `{food}` params. Match the existing app voice (pure
black/olive brand, direct, warm; see STEPHANIE-VOICE-BIBLE.md in .planning for register).
Numbers rounded to whole grams. No exclamation stacking.

### C3. Wire into the log actions
Extend `LogResult` with `coachMoment?: CoachMoment`. In `logPhotoFoodAction` AND
`logFoodAction`: after the successful insert + emitEvent block, `await buildCoachMoment(...)`
and return it. It runs AFTER the insert so totals include the meal, and it is allowed to
fail silently (wrap: any throw → return result without coachMoment; a coaching line must
never fail a log — same telemetry contract as everything else).

### C4. Render
In `photo-scan.tsx` (and the diary's log confirmation path in `diary-screen.tsx`): when the
action result carries a `coachMoment` with `kind !== 'none'`, render a dismissible card/toast
under the confirmation UI: the localized line + a small macro-ring or remaining-grams figure
(reuse `src/components/coach/macro-ring.tsx` if it fits; don't build a new viz). Client
component rules apply (`"use client"` first line — both files already are).

### C5. (Seam only, no build) LLM polish hook
Leave a single commented seam in coach-moment.ts:
`// Voice polish seam: pipe CoachMoment through AI_MODELS.chat with Stephanie's RAG voice
// (coach-ai/chat.ts pattern) in a later PRD. Deterministic templates stay the fallback.`

## Acceptance criteria
- AC-1: Member with targets (180g/2100kcal), logs dinner reaching 132g → card renders
  "48g remaining" push line in their locale, with one of THEIR habit foods when available.
- AC-2: Member with no user_state row (fresh signup) → no card, log flow unchanged.
- AC-3: Photo, text, search, and barcode logs all produce the moment (source-agnostic).
- AC-4: Killing the user_state read (rename the table locally) does not break logging —
  result returns without coachMoment, zero errors surfaced to the member.
- AC-5: ES locale renders the ES template with correctly formatted numbers.

## Verify
```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
# manual: seed sample.sam (already comped + health-acked, tz America/New_York per STATE.md)
# with targets in user_state, log a meal via photo AND via search; verify both cards, both locales.
```

## Out of scope
LLM-polished voice (seam only), push notifications for the moment, coach-side visibility of
moments, streak/gamification hooks, any change to K7's daily/goal-date engine.
