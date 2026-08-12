# STATE — 2026-08-12

Current, verified state of the build. Everything below was measured against the live database or
observed in the running app, not inferred.

---

## THE LIVE WIRE: the Lenus sweep

**Deadline 31 August. 19 days.**

### Where it stands

Captured and importing. The three payloads are on disk in `.capture/sweep/` (gitignored):

| file | size | contents |
|---|---|---|
| `lenus-checkins.json` | 13.0 MB | 859 check-ins across 247 clients, 2024-03 to 2026-08-10 |
| `lenus-threads.json` | 9.3 MB | 19,862 chat events, of which 13,338 messages |
| `lenus-detail.json` | 2.8 MB | 272 profiles with email, 4,678 workouts, 1,654 history events |

Zero errors on every operation across 272 clients.

### CORRECTION: `pageSize: 3` was NOT the problem

An earlier note in this file blamed the missing data on the July run taking page one of every list.
That is **wrong**, and it was measured rather than argued:

```
ClientWorkoutHistory   held 4,182   sum(fullCount) 4,182   truncated clients 0
ProfileHistory         held 1,543   sum(totalCount) 1,543  hasMore anywhere: no
```

The July extract paginated to completion. 15.8 workouts per client is simply the real average.
`pageSize: 3` is only the UI's own chunk size, and raising it to 500 is a speed fix, not a
completeness fix.

### What was ACTUALLY wrong: two different things

**1. Everything stopped on 3 July 2026.** Not 5 August as previously assumed. Lenus messages ended
at `2026-07-03 14:59`; transactions at 13 June. The extract was 40 days stale, and six clients who
joined after it ran did not exist in our database at all.

**2. Check-ins were captured as IDs and the bodies were never fetched.** `raw_client_extract` held
765 check-in response IDs. `form_responses` held **two rows, both belonging to the sample QA
account.** `ClientInfoCheckinsContext_CheckInResponses` returns only `{id, submittedAt}`; the
answers need a second call per ID that nobody made. Every check-in she has ever read in Lenus was
absent from her own app.

### The bigger find: our check-in form was not her check-in form

Her real weekly check-in, read off 859 submissions, asks **19 questions**. The app shipped **6**,
and only three resembled anything of hers. Hers:

Weight · Circumference (chest, upper arm, waist, hip, thigh) · Progress pictures (front/back/side) ·
Status · Wins · Opportunities · Non scale wins · Steps (goal hit? + how many) · Water (goal hit? +
how much) · Sleep · Sleep quality (0-10) · Alcohol · Energy level · Mood · Workout plan use ·
Meal plan use · Macros

Migration `0129` rebuilds the form to hers, in her order, with `config.lenus` on each field
recording the block it came from so the import joins on data rather than on a mapping in a script.

### How to re-run it

The whole thing is scripted and idempotent. Before the cutoff:

1. Start the receiver: `node <scratch>/receiver.mjs .capture/sweep 8877`
2. Seed the ids: navigate to `http://localhost:8877/inject?file=pids.json`, then to Lenus, then read
   `window.name` into `window.__SEED`.
3. Run the phases (see the js in the session transcript, or rebuild from `.planning/lenus-recipes.json`).
4. Ship each phase: `window.name = JSON.stringify(payload)`, then navigate to
   `http://localhost:8877/?name=<file>.json`.
5. `node scripts/import-lenus-sweep.mjs --apply` then `node scripts/import-lenus-checkins.mjs --apply`.
6. **Done means:** run both twice and confirm row counts do not move. Already proven for check-ins
   (853 / 863 / 588 / 49 identical on the second pass).

### Transport, and why it is this strange

Getting bytes off her Lenus tab is the hard part. Both obvious routes fail:

- **Downloads:** the FIRST anchor-click download lands, as `~/Downloads/<uuid>.tmp`, never renamed
  to the requested filename. Every one after that is silently dropped: Chrome's "automatic multiple
  downloads" permission is denied for the origin. A reload does not restore it, and neither does a
  real click, so it is one payload per origin. `.download` returns a byte count either way, which is
  what makes this look like it worked.
- **fetch to localhost:** Lenus sends `default-src https://us.lenus.io`, a `connect-src` allowlist
  and `upgrade-insecure-requests`. The receiver answers curl fine and is invisible to the page. It
  fails as an opaque `TypeError: Failed to fetch`, with no CORS message to explain it.

**What works: `window.name`.** Park the JSON on it, then have the EXTENSION navigate the tab to
`http://localhost:8877/` (a browser-level navigation, which no page CSP governs). The collector page
posts it back same-origin. Verified at 9.3 MB. `/inject` runs it in reverse to get the id list in.

### Other traps already paid for

- **`Message.type` and `TrackingActivityLog.type` collide** in one selection set: same response key,
  different types, and GraphQL rejects the merge. Lenus's own query aliases it
  `trackingActivityType: type`. Without the alias, all 272 clients return nothing and the error is
  just "Invalid query" with a column number.
- **Typenames do not match the page's noun.** The plan list returns `WorkoutPlan`, not
  `WorkoutPlanTemplate`.
- **`$locale` on `FitnessPackageCoachFiles_FILES` is `Locale!`, not `String`.**
- **The Management API throttles** around 800 single-statement calls. Batch by a ~6 KB CHARACTER
  budget; batching by statement COUNT blows the OS argument limit (ENAMETOOLONG), since the query
  travels as an argv entry.
- **`javascript_tool` returns come back `{}`** for async IIFEs and anything resembling cookie or
  query-string data. Park on `window.__x`, read it in a second call.
- **A full `navigate` destroys the injected engine.** Budget for re-injecting it.

---

## Shipped today

Lenus recovery:

- Her 40 Lenus programs imported earlier: 229 sessions, 2,497 prescriptions, 1,531 supersets
- 859 check-ins recovered and imported. `form_responses` went from 2 rows to 853
- The weekly check-in form rebuilt to her real 19 questions (`0129`)
- 852 weights and 586 circumference sets routed to their own tables so the trend charts have points
- 49 clients' "why" written to `client_intake.client_why`, a column that was empty for all 267 rows
- Six clients who joined after 3 July created as contacts, with real emails
- Messages and workouts re-synced past the 3 July cliff

Member app, verified as a real subscriber:

- Opening the app no longer flips a Spanish member to English
- A failed workout save no longer fires confetti and discards the session
- Check-in submissions reach the coach; the member gets a way out of the confirmation
- Logging 154.4 lb no longer stores 154.3
- First-steps checklist ticks itself from live rows

Coach portal:

- The player performs supersets as supersets
- Program library grouped and readable; day counts match her Lenus list
- Revenue chart unfrozen (`monthly_revenue` unions `payments`)
- Her home screen names Stephanie as the coach, not the agency's operator account
- Command palette over every screen, both portals

Migrations 0124-0132.

---

## Open, in priority order

1. **Read the recovered check-ins on screen.** 853 responses now exist and
   `getLatestCheckin`/`getClientCheckin` still query `profile_id` only, so migrated rows are
   invisible to the coach page. The data landed; the reader has not been widened. This is the next
   thing to do and it is small.
2. **Two Jasmine Mannings.** `jmanning@alignedpeds.com` (67 messages) and `jasminemannin@gmail.com`
   (0 messages) are separate Lenus profiles. Probably one person who signed up twice. `contacts`
   has `is_duplicate`; needs her call, not a guess.
3. **Page descriptions, 23 remaining.** 15 of 39 coach pages explain themselves.
   Copy rule: answer the question a newcomer actually has, never restate the title.
4. **ADHD-friendly pass, both portals.** Not started, deliberately not faked. It is information
   hierarchy, not a toggle. `/coach/spanish` is the model that already works: finite, visible,
   "899/1259, 360 to go".
5. **Program builder redesign.** Rows are a bare name plus two unlabelled number boxes. Supersets
   are invisible despite the data carrying them. No rep range, rest, tempo or note.
6. **Coach builder cannot CREATE a superset.** Player renders them, schema holds them: a UI gap.
7. **Supplement reading into the client file.** The document reader handles label photos and
   `member_memory` is the client file. Missing is the wire from "client sends a photo in chat" to
   "read it, extract macros, file it".
8. **Plan-to-product mapping** is captured but not stored. An entitlement decision, needs her call.
9. **Glutes and stomach circumference** have no column (1 row each across 859 check-ins). Reported
   by the importer rather than dropped silently. Not worth a migration yet.

---

## Working notes

- QA accounts are all English. `sample.sam@thickandfit.test` (subscriber),
  `sample.casey@thickandfit.test` (coach). Password `TFSample2026!`.
- A stale service worker causes MISSING_MESSAGE, hydration failures and dead buttons in dev.
- Migrated rows key on `contact_id`; `profile_id` is only set once a member claims an app account.
  Any reader that queries one key sees half the history. This is the single most repeated bug in
  this codebase.
