# GHL waitlist workflow, build sheet

Written 2026-07-30 from the shipped code, not from the plan doc. Every tag below is one this app
actually emits today, verified in `src/lib/funnel/service.ts`, `src/lib/ghl/client.ts` and
`src/app/api/onboarding/submit/route.ts`.

**Why this is a build sheet and not a script:** GoHighLevel's v2 API cannot create workflows. It can
create/update contacts, add tags, start conversations, and enroll an existing contact into an
existing workflow, and that is all. Workflows are built in GHL's visual builder. So the workflow
itself has to be assembled by a human in the UI; this document is the exact spec to build it from.

---

## The recommendation: trigger on TAGS, not on API enrollment

There are two ways to start a lead in the drip. **Use the tag trigger.**

| | Tag trigger (recommended) | API enrollment |
|---|---|---|
| Setup | build workflow, done | build workflow, copy its id, set `GHL_WAITLIST_WORKFLOW_ID` in Vercel prod, redeploy |
| Fires on | every lifecycle event, not just signup | signup only |
| If the API call fails | contact still tagged, still enters | lead silently never enters the drip |

`enrollInDrip()` creates the contact with tags `waitlist` + `lang:en|es` **and then** tries the
workflow enrollment only if `GHL_WAITLIST_WORKFLOW_ID` is set. It skips that step cleanly when unset,
so **the contact and its tags arrive either way**. That means a tag-triggered workflow works today
with zero env changes and zero redeploy, and it is the more robust of the two because it does not
depend on a second API call succeeding.

Set the env var only if you also want belt-and-braces enrollment. It is not required.

---

## Tag vocabulary the app emits

### Lifecycle (these drive the drip)

| Tag | Emitted when | Use it for |
|---|---|---|
| `waitlist` | the moment she submits the join form | **START TRIGGER** |
| `confirmed` | she clicks the confirmation link in her email | stop the "confirm your email" nudge |
| `quiz-done` | she completes the 60-second quiz | stop the "take the quiz" nudge |
| `referred:1` / `referred:5` / `referred:20` | her 1st, 5th and 20th successful referral | milestone congratulations |
| `converted` + `member` | she subscribes when doors open | **EXIT / SUPPRESS.** Never send waitlist copy to a paying member. |
| `app-member` + `tier:self\|team\|steph` | she finishes onboarding in the app | member track, not waitlist |

### Segmentation (set once, from the quiz)

| Tag | Values |
|---|---|
| `lang:` | `en`, `es` — **branch the whole drip on this**, the tracks are separately authored |
| `goal:` | `lose_fat`, `build_muscle`, `recomp`, `strength`, `feel_better`, `nutrition` (multi) |
| `where:` | `home`, `gym`, `both` |
| `days:` | `2`–`6` |
| `eats:` | `macros`, `meal_plan`, `intuitive`, `not_sure` |

---

## Workflow structure

**Trigger:** Contact Tag Added → `waitlist`

**First branch, immediately:** split on `lang:es` vs everything else. Two authored tracks, not one
track with translated sends. Roughly half this audience is Spanish-speaking and a machine-translated
drip reads like it.

**Behavior branches** (the reason the tags above exist — these are what makes it a drip rather than a
broadcast):

1. **Not confirmed after 24h** → does NOT have `confirmed` → one nudge. Entries are gated on
   confirmation, so an unconfirmed lead is worth nothing to the giveaway and everything to fix.
2. **No quiz after 48h** → does NOT have `quiz-done` → "+2 entries for 60 seconds."
3. **No referral after 4 days** → does NOT have `referred:1` → share-link reminder. This is the
   viral loop; it is the highest-leverage message in the sequence.
4. **Milestone** → `referred:1`, `referred:5`, `referred:20` → congratulate and re-share.

**HARD EXIT on `converted` or `member`.** A member who just paid receiving "join the waitlist" is the
single worst message the system can send. Put this as a global exit condition on the workflow, not
just as a step.

**Cadence:** the copy is Shakira's deliverable (~14 emails + 8 texts, EN and ES, Stephanie approves
each). Do not start SMS steps until 10DLC is approved.

---

## Verification once built

1. Join at `/join` with a fresh address. Confirm the contact appears in GHL within seconds with
   `waitlist` and `lang:*`.
2. Confirm the workflow shows her enrolled.
3. Take the quiz. Confirm `quiz-done` plus the `goal:*` / `where:*` / `days:*` / `eats:*` tags land
   and the quiz nudge branch stops.
4. Refer someone with the share link. Confirm `referred:1` on the referrer.
5. Most important: tag a test contact `converted` and confirm they **leave** the workflow.

Steps 1, 3 and 4 were already verified end to end on prod 2026-07-30 (entry ledger
`signup:1, quiz:2, referral:3`); what is unverified is only the GHL-side reaction to those tags.
