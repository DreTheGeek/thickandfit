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

**CORRECTED 2026-08-12, later the same day. The first answer in this file was wrong and is kept
below so nobody re-derives it.** The claim was that the July extract took page one of every list and
stopped, and that `pageSize: 3` on `ClientWorkoutHistory` was the proof. Measured against the live
DB before starting the sweep, it does not hold: the July run paginated to completion. Shelise's 482
workouts are all present. `ProfileHistory_Profile` is complete too, 1,543 of 1,543, `hasMore` false
everywhere. The 15.8 workouts per client average is not a truncation artifact, it is the real
average across 265 people, most of whom are not Shelise.

Two different things are actually wrong:

1. **The extract is 40 days stale, not 9.** It is from 3 July. Lenus messages stop dead at
   2026-07-03 14:59 and transactions at 13 June. This is a re-sync, not a repair.
2. **Check-ins were captured as IDs and the bodies were never fetched.**
   `raw_client_extract` holds 765 check-in response IDs; `form_responses` holds 2 rows for 1 person.
   The list operation returns only `{id, submittedAt}`; the answers need a second call per ID to
   `ClientCheckinDashboardView_checkInResponse`. Nobody made it. **This is the biggest hole in her
   portal and it is the thing she reviews weekly.**

**Why the bodies were never fetched, found in our own code.** `scripts/lenus-export.js` did list
that operation. It resolved its variable against one flat list of id-ish names that included `id`,
so it sent the PROFILE id where a CHECK-IN RESPONSE id was expected. Lenus errored, `gql()` turned
the error into `null`, and `if (d)` dropped it without a word, 265 times. Fixed, with the fan-out
now driven off the harvested IDs.

**`pageSize: 3` still matters, in the opposite direction to the one first claimed.** It is not why
data is missing. It is why the RE-RUN was dangerous: the ingest upserts on
`(profile_id, operation)`, so replaying the recorded variables verbatim would have overwritten the
482 complete workouts with 3. The extractor paginates at 200 now, and `/api/internal/lenus-ingest`
refuses a write that shrinks a stored payload unless `allowShrink` is set. Verified by
`.qa-visual/lenus-export-test.mjs`, 22 assertions against a mock Lenus, which fails if either bug is
reintroduced.

Roster note: Lenus lists **256** clients today against **265** on file. The extra 9 are ours to
keep, the upsert never deletes; but the roster loader reads from Lenus, not from us, so a client who
joined after 3 July is picked up.

### How to run it

The pipeline already exists end to end and does not need rebuilding: the extractor runs in her
logged-in tab, `postMessage`s each client to `/lenus-bridge` on our origin, which POSTs to
`/api/internal/lenus-ingest`, which upserts into `lenus.raw_client_extract`. Lenus's CSP is why it
is shaped that way; see the comments in those three files before changing any of it.

1. `node .qa-visual/lenus-export-test.mjs` first. 22 assertions, no network. If it does not pass, do
   not paste anything into her browser.
2. `node scripts/lenus-verify.mjs --snapshot` to record the before state.
3. Log into `us.lenus.io`, open ANY client (that page load teaches the script every query it needs),
   paste `scripts/lenus-export.js` into the console, run `lenusExport.start()`, paste
   `LENUS_INGEST_TOKEN`. Leave the tab open and awake. Watch for any `ids, 0 bodies` warning.
4. `node scripts/lenus-verify.mjs --checkins` to confirm bodies actually landed, and
   `--diff <snapshot>` for the run-twice proof.
5. Then map raw to app tables, idempotent on `lenus_id`, the pattern proven by
   `scripts/import-lenus-programs.mjs`.

**Done means:** run it twice, row counts do not move on the second pass, and no operation shrank.

**The check-in mapper cannot be written until step 3 has run once.** Its payload shape has never
been observed, because the call was never successfully made. `node scripts/lenus-verify.mjs --shape
ClientCheckinDashboardView_checkInResponse` prints keys and types with no values, which is what to
design `form_responses` promotion against without pasting her members' answers into a chat.

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
