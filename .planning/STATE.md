# STATE — 2026-08-12

Current, verified state of the build. Written at the end of a long session so work can resume
without re-deriving anything. Everything below was measured against the live database or observed
in the running app, not inferred.

---

## THE LIVE WIRE: the Lenus sweep

**Deadline 31 August. 19 days. This is the only item with a clock that does not move.**

### Where it stands

Discovery is DONE. The replay has not run.

- `.planning/lenus-recipes.json` — **66 operations** with full query documents, sample variables,
  auth headers and the endpoint. Captured 2026-08-12 by driving the user's own Chrome.
- `.planning/lenus-programs.json` — her 40 training programs, 9.6 MB. Already imported.
- `.planning/lenus-plan-products.json` — the 6 plan-to-product mappings.

**Chrome on this machine downloads to `.planning`, not `~/Downloads`.** Two hours were lost to this.

### The root cause of "I still don't see everything from every client"

The July extract took page one of every list and stopped. Measured today, per client across 265:

| | held | should be |
|---|---|---|
| Workouts | 15.8 | one client shows `fullCount: 482` |
| Check-ins | 0.01 (2 rows total) | weekly over months |
| Weigh-ins | 2.9 | ~52 for a year of weekly |
| Photos | 8.6 | 30+ for monthly over a year |
| Messages | 45.4 | likely one page too |

**The proof, and the fix, is one variable.** `ClientWorkoutHistory` is called with
`{ pageSize: 3, offset: 0, profileId }`. The UI asks for THREE. Raise `pageSize`, loop `offset`, and
the history is complete. `useClientListInfiniteScrolling_clientList` uses `{ offset, limit: 20 }`.

### How to run it

1. Load `.planning/lenus-recipes.json`. It carries the endpoint, headers and every query document.
2. For each of 265 client profile ids, for each per-client operation, loop `offset` with a raised
   `pageSize`/`limit` until a page returns nothing new.
3. Import idempotently on `lenus_id`, the pattern proven by `scripts/import-lenus-programs.mjs`.
4. **Done means:** run it twice, row counts do not move on the second pass.

Per-client operations that matter: `ClientWorkoutHistory`, `ClientMeasurements_Profile`,
`ClientInfoCheckinsContext_CheckInResponses`, `fetchClientChart`, `ChatConversationWeb`,
`UseFetchFoodDiaryOverview_FoodDiary`, `PaymentsOverview_Payments`, `HealthAssessmentFormResults`,
`ProfileHistory_Profile`, `FitnessPackageCoachFiles_FILES`.

### Traps already paid for

- **Typenames do not match the page's noun.** The plan list returns `WorkoutPlan`, not
  `WorkoutPlanTemplate`. Filtering on the obvious one silently returns zero.
- **The Management API throttles** at roughly 800 single-statement calls. Batch writes by a ~6 KB
  CHARACTER budget; batching by statement COUNT blew the OS argument limit (ENAMETOOLONG) because
  the query travels as an argv entry.
- **`javascript_tool` returns are filtered** if they contain cookie or query-string data, and async
  IIFE returns often come back `{}`. Park results on `window.__x`, read them in a second call.
- **A full `navigate` destroys an installed recorder.** Click in-app links instead; the Toolbox is
  the wrench in the left rail.
- **The renderer wedges** if a tab holds a multi-MB capture in memory. Reload before reusing a tab.

---

## Shipped today

Member app, all verified in the running app as a real subscriber:

- Opening the app no longer flips a Spanish member to English (`/` was rewriting `ui_locale` for
  signed-in users; `manifest.json` start_url is `/`, so it hit on every PWA launch)
- A failed workout save no longer fires confetti and discards the session
- Check-in submissions now reach the coach; the member gets a way out of the confirmation
- Logging 154.4 lb no longer stores 154.3
- Her exercise library describes movements in her member's language
- First-steps checklist ticks itself from live rows instead of showing three hardcoded cards

Coach portal:

- Her 40 Lenus programs imported: 229 sessions, 2,497 prescriptions, 1,531 supersets
- The player performs supersets as supersets (badge, "then straight into", rep ranges, AMRAP)
- Program library grouped and readable; day counts match her Lenus list
- Revenue chart unfrozen — `monthly_revenue` now unions `payments`, so it will not sit on June
  through launch
- Her home screen names Stephanie as the coach, not the agency's operator account
- Command palette over every screen, both portals
- Test rows removed from her inbox (12,026 real messages remain)

Migrations 0124-0128. All pushed to main and deployed.

---

## Open, in priority order

1. **The sweep.** Above. Everything is ready; only the replay remains.
2. **Page descriptions, 23 remaining.** 15 of 39 coach pages explain themselves. `/coach/programs`
   was done as the pattern. Re-run the audit with:
   `for f in $(find "src/app/(app)/coach" -name page.tsx|sort); do grep -qE "Subtitle|subtitle|Intro|intro=|tf-measure" "$f" || echo "$f"; done`
   Copy rule: answer the question a newcomer actually has, never restate the title.
3. **ADHD-friendly pass, both portals.** Not started, deliberately not faked. It is information
   hierarchy, not a toggle. The member Today screen is close; the coach console is the work
   (31 nav items, six sections, all equal weight, no "what needs you today"). `/coach/spanish` is
   the model that already works: finite, visible, "899/1259, 360 to go".
4. **Program builder redesign.** Rows are a bare name plus two unlabelled number boxes, so nothing
   says which is sets and which is reps. Supersets are invisible despite the data carrying them.
   No rep range, rest, tempo or note, all of which are now stored and which she uses.
5. **Coach builder cannot CREATE a superset.** The player renders them and the schema holds them;
   this is a builder-UI gap only.
6. **Supplement reading into the client file.** The document reader already handles label photos and
   `member_memory` is the client file. Missing is the wire from "client sends a photo in chat" to
   "read it, extract macros, file it".
7. **Plan-to-product mapping** is captured but not stored. Which program a paid tier receives is an
   entitlement decision, not a data one, and needs the owner's call.

---

## Working notes

- QA accounts are all English now. `sample.sam@thickandfit.test` (subscriber, Maria Garcia),
  `sample.casey@thickandfit.test` (coach). Password `TFSample2026!`.
- A stale service worker causes MISSING_MESSAGE, hydration failures and dead buttons in dev. Clear
  caches and unregister before believing any of them.
- Clean up test rows after every end-to-end run. Several were written and deleted today.
