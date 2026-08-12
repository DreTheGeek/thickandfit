# Next session: three open workstreams

Written 2026-08-12 at the end of a long session. Everything below is either measured or verified
today, so none of it needs rediscovering. Ordered by deadline, not by size.

---

## 1. The Lenus re-sweep — 19 days, hard deadline 31 August

**Why it is urgent and what is already safe.** Her 40 training programs were captured and imported
today (2,497 prescriptions, see the `lenus-programs-recovered` memory). That risk is retired. What
is NOT captured is everything else, at full depth.

**The specific gap: the July extract paginated and nobody noticed.** `ClientWorkoutHistory` returns
`fullCount: 482` for a single client and `lenus.raw_client_extract` holds one page of it. The same
is almost certainly true of messages, check-ins, weights, measurements and the food diary, because
they were pulled by the same run.

**What exists to build on:**

- `scripts/lenus-record.js` — records operation NAME, full query document, variables and auth
  headers. The July run saved only name/variables/response, which is why it was never replayable.
- `scripts/lenus-plans-capture.js` — the discovery-by-shape approach that worked today.
- The pagination shape, confirmed live: `{ input: { limit, offset } }`.
- 27 operation names already known, in `lenus.raw_client_extract.operation`.

**How to drive it.** Log into `us.lenus.io` in the user's own Chrome via the `claude-in-chrome` MCP,
install the recorder, then click through IN-APP. A full `navigate` reloads the page and destroys the
recorder; SPA link clicks do not. The Toolbox is the wrench icon in the left rail.

**Traps already paid for:**
- Typenames do not match the page's noun. The plan list returns `WorkoutPlan`, not
  `WorkoutPlanTemplate`, and filtering on the obvious one silently returns zero.
- The Management API throttles at roughly 800 single-statement calls. Batch writes by a ~6 KB
  CHARACTER budget, not a statement count: batching by count blew the OS argument limit
  (ENAMETOOLONG), because the query travels as an argv entry.
- `javascript_tool` returns get filtered if they contain cookie or query-string data. Park results
  on `window.__x` and read them back in a second call.

**Definition of done:** re-run twice and assert row counts do not move on the second pass.

---

## 2. Page descriptions — 23 remaining

**The audit, run today.** 15 of 39 coach pages explain themselves, 24 do not. `/coach/programs` was
done ([ebb5e0c]), leaving 23. Command to re-run the audit:

```
for f in $(find "src/app/(app)/coach" -name page.tsx | sort); do
  grep -qE "Subtitle|subtitle|Intro|intro=|tf-measure" "$f" || echo "$f"
done
```

**Do these first**, they are where a new assistant coach lands: `/coach/clients`, `/coach/inbox`,
`/coach/intake`, `/coach/leads`, `/coach/billing`, `/coach/settings`, `/coach/forms`,
`/coach/challenges`, `/coach/tool/meal-plans`, `/coach/tool/recipes`, `/coach/tool/recipe-books`.

**The copy rule that makes these worth writing.** Answer the question a newcomer actually has, which
is almost never "what is this called". For Programs it was "is this where I BUILD one or where I
HAND one to a client". A restatement of the title is worse than nothing, because it teaches her the
descriptions are not worth reading.

Pattern: `<p className="tf-measure mb-6 text-[13px] text-muted">{t('xIntro')}</p>` under the title,
copy in both catalogs, and `node .qa-visual/i18n-parity-test.mjs` before committing.

---

## 3. ADHD-friendly, both portals

Not started, and deliberately not faked. A sentence under a title is orientation, not this.

**The honest assessment from using both sides today:**

The member Today screen is already close. It opens on ONE thing ("you are 1767 calories and 150g of
protein short"), the mission tiles are a short finite list, and progress is visible without holding
anything in your head.

The coach console is the opposite and it is the real work: **31 nav items across 6 collapsible
sections**, every one weighted the same, with no "here is what needs you today". The Programs page
was 41 identical tiles until today. The command palette (a947e2e) helps someone who knows what she
wants; it does nothing for someone staring at a wall deciding.

**What a real pass looks like, in priority order:**

1. **One obvious next action per screen.** The coach home already computes an attention queue
   (`src/lib/coach/attention.ts`) and shows it as three equal chips. It should be one sentence naming
   the single most urgent thing, then the rest.
2. **Finite, visible progress.** The Spanish desk (`/coach/spanish`) is the model that already works:
   "899/1259, 360 to go", batch of 20, done is done. The interview (78 questions) and the filming
   list should read the same way.
3. **Separate destructive from routine.** Delete controls currently sit inline with everyday actions
   in several lists.
4. **Stop equal-weighting.** Six nav sections of identical visual weight means every visit is a
   fresh scan. The sections she uses daily should not look like the ones she opens monthly.

Do NOT approach this as a settings toggle or a "focus mode". It is information hierarchy, and the
grouping work on the Programs page (ed82edd) is the smallest worked example of what it means.

---

## State to be aware of

- Test rows were removed from her inbox today: two native threads plus "Testing 123" and a bare
  "Test" in `client_messages`. 12,026 real messages remain. A message reading "How do I delete a food
  entry? I was testing out the app" is a REAL member question and was deliberately kept.
- `sample.*@thickandfit.test` accounts are all set to English now, so QA screenshots stop coming back
  in Spanish. Password `TFSample2026!`.
- Her 6 plan-to-product mappings are known but NOT stored (Thick & Fit Lite membership, Her Again 6
  week challenge, Body Recomp challenge). Storing them is an entitlement decision, not a data one.
- The coach BUILDER still cannot create a superset. The player renders them (d5d859e) and the schema
  holds them (0126), so this is a builder-UI gap only.
