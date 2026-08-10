# Getting her data out of Lenus before 31 August

Written 2026-08-09 after proving what does and does not work. 22 days left on the account.

## The finding that decides the architecture

**You cannot replay Lenus GraphQL from Node, curl, or any script outside the browser.** Not with the
headers, not with the visible cookies.

Tested directly against `us.lenus.io/graphql`, same query, same headers, one difference:

| request | result |
|---|---|
| from the page, `credentials: 'include'` | `200`, full data |
| identical headers, `credentials: 'omit'` | `400 "Not allowed to access private schema fields"` |

`document.cookie` exposes `coach-id` and `authenticatedDashboard` (a timestamp), and neither is the
session. The real one is httpOnly, so JavaScript cannot read it and no external process can present
it. `x-lenus-df-key`, `x-lenus-coach-id`, `x-lenus-product` and `x-client-version` are all required
but none of them authenticate.

**Consequence: every extraction must execute inside a logged-in browser tab on the Lenus origin.**
The July 3 run worked this way too; nobody wrote down why.

## The second constraint: nothing can leave the page directly

Lenus sends a restrictive `connect-src`. From the page, both of these fail with `Failed to fetch`:

- `http://localhost:3000/api/v1/ping`
- `https://www.teamthickandfit.com/api/v1/ping`

So the page can talk to `us.lenus.io` and nowhere else. Two ways out, both proven or available:

1. **Read it out of the DOM.** Render the payload into a `<pre>` and pull it with the browser tool's
   page-text read. This is how the 371 exercises came out (235 KB). Slow and context-expensive, but
   it needs nothing built.
2. **A `postMessage` bridge.** `window.open()` and `postMessage` are not subject to `connect-src`.
   Open a tab on our own origin from the Lenus page, post each client's payload to it, and let THAT
   page (same-origin with us) POST to our API. This is the one that scales to 265 clients.

## What one client costs

Measured on a real profile, 44 per-client operations, 43 returning data:

- **170 KB raw per client.** 265 clients is roughly 45 MB.
- `LoadMealPlanMeals` (69 KB) and `FetchMealPlan` (19 KB) are half of it.
- Only `trackingGoalLogsCoach` fails, with "Not allowed to fetch trackingGoals". Her account does not
  have that feature; it is not an auth problem.

Project down to mapped fields in the browser before shipping anything out. Raw is roughly 10x what
we actually store.

## Recording the queries

`lenus.raw_client_extract` from 3 July holds 27 operations x 265 clients but saved only the operation
NAME, the variables and the response. **Not the query document.** That is precisely why the sync
could never be re-run and the data has been frozen since.

`scripts/lenus-record.js` fixes that: paste it into the console, and it records every GraphQL query
document, its variables and the auth headers as the app issues them. Loading a single client page
captures **64 operations**, well past the 27 the July run knew about. New and valuable since then:

- `UseCheckInCycleTracker_menstrualCycle` — the cycle tracker, which we are about to build
- `FetchMealPlan`, `LoadMealPlanMeals`, `FetchMacroSplits`, `MealPlanPdf` — her actual meal plans
- `TrainingBuilderPanelContext_WorkoutPlans`, `CoachWorkoutPlanTemplates`, `WorkoutPlanPdf_Query`
- `ClientCheckinDashboardView_checkInResponse`, `clientPeriodWeeksQuery`
- `NutritionInformation_IngredientPreferences`

Do not persist the recipe book. It is only useful inside the browser, where re-recording it takes
about thirty seconds, and it carries auth headers, so a saved copy is a credential sitting on disk.

## Order of work, given the deadline

Raw capture first, mapping second. The network pass against an account we are about to lose is the
part that cannot be repeated; turning JSON into rows can be redone any evening. Write responses
verbatim into `lenus.raw_client_extract` (its primary key is already UNIQUE on
`(profile_id, operation)`, so re-runs upsert rather than duplicate), then map offline.

## Traps already hit

- **`contacts` has a PARTIAL unique index** on `(company_id, lenus_id) WHERE type='client' AND
  lenus_id IS NOT NULL`. A bare `ON CONFLICT (company_id, lenus_id)` errors with 42P10. Spell the
  predicate out. This is the same shape as the iOS push-token bug from 0113.
- **Full page navigation kills the recorder.** Install it once, then move around by clicking, or
  re-install after every `navigate`.
- `.capture/` is now gitignored: it holds session material and 400 MB of her video.

## State as of 2026-08-09

| source | freshest row | age |
|---|---|---|
| contacts | 7 Aug | current |
| client_messages | 3 Aug | 6 days |
| client_intake | 3 Aug | 6 days |
| weight_entries | 18 Jul | 22 days |
| client_workout_history | 3 Jul | 37 days |
| progress_photos | 2 Jul | 38 days |

`client_workout_history` and `progress_photos` have not moved since the July extract, because that
is the run that created them.

**Shanya Bulgin** (`e6c6bce0-8bc2-11f1-946f-7bdb61bf3575`, bulginshanya@gmail.com) signed up 4 Aug,
filled her questionnaire 5 Aug, and was absent from our database entirely. She is now in `contacts`.
She was the proof that the export had gone stale, and she is the reason to finish this before the
account closes.
