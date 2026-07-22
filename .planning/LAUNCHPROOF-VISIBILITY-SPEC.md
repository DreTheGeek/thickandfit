# Launchproof Visibility Lens: spec and backlog

Everything learned making Thick & Fit visible, written as work items for `launchproof`.
Source of truth for the five-layer model, the bugs found in the current `lib/aeo.cjs`, and the
checks that do not exist yet in either `launchproof` or `beacon`.

**Provenance.** Sections marked **[verified]** were run against a live app in this repo and the
result observed. Sections marked **[reported]** come from a read of `DreTheGeek/beacon` and were not
independently executed. Do not ship a **[reported]** threshold without confirming it against
beacon's source first.

---

## 1. The five layers, and why one lens is not enough

`aeo.cjs` today mixes three of these together and has no opinion on the other two. Splitting them
matters because they fail independently and get fixed by different people.

| Layer | Optimizes for | The question it answers | Who fixes it |
|---|---|---|---|
| **SEO** | Classic ranking | Can a crawler reach, parse, and index this? | Engineer |
| **AEO** | Answer engines | If asked, can the engine find a direct answer here? | Content + engineer |
| **GEO** | Generative citation | When it writes an answer, does it cite THIS page? | Writer |
| **AIO** | Entity resolution | Does the model know who this brand and person ARE? | Brand owner |
| **SXO** | Post-click experience | Does the human who arrives convert or bounce? | Designer |

The distinction that keeps getting collapsed: **AEO is about being findable, GEO is about being
quotable, AIO is about being identifiable.** A page can pass all schema checks (AEO) and still never
be cited (GEO) because it contains no concrete numbers, and still be attributed to the wrong person
(AIO) because `sameAs` is missing.

**SXO belongs in this lens, not a separate one.** Google's post-click signals and the bounce
behavior of answer-engine referrals both feed back into visibility. A page that ranks and gets
cited but has 3.7:1 body text is a visibility failure with a delayed fee.

---

## 2. Bugs in the current `lib/aeo.cjs`

### 2.1 `classifyGeoSignals` misses abbreviated statistics **[verified]**

Current:

```js
const hasStats = /\b\d+(\.\d+)?\s?%|\b\d{1,3}(,\d{3})+\b|\b\d+(\.\d+)?\s?(million|billion|thousand|percent|users|customers|companies)\b/i.test(text);
```

A page reading **"562K women following along"** and **"256 clients coached"** scored as having NO
statistics. That is the single most common way real marketing copy writes a number, and it produced
a false P2 on a page that was already stat-rich.

Fix: add the abbreviated form and widen the noun list.

```js
const hasStats =
  /\b\d+(\.\d+)?\s?%/i.test(text) ||
  /\b\d{1,3}(,\d{3})+\b/.test(text) ||
  /\b\d+(\.\d+)?\s?[KkMmBb]\b/.test(text) ||                    // 562K, 1.2M, 3B
  /\b\d+(\.\d+)?\s?(million|billion|thousand|percent|users|customers|companies|clients|members|subscribers|students|patients|hours|days)\b/i.test(text);
```

Regression test: `"562K women following along"` must return `hasStats === true`.

### 2.2 The stats/quote/citation signals are collapsed into one finding **[verified]**

`classifyGeoSignals` returns P2 when 2+ are missing and P3 when 1 is missing. In practice these
have completely different owners and costs:

- statistics: a writer edits a sentence, 5 minutes
- quotations: needs a real customer quote, days to weeks
- outbound citations: needs verified URLs, often blocked on the client

Collapsing them means the finding cannot be actioned or suppressed independently. On Thick & Fit
the stats fix was free and the citation fix was blocked on the owner supplying real social URLs, but
they were one finding, so the whole thing stayed open.

Fix: emit up to three findings with distinct `kind` values (`geo-no-statistics`,
`geo-no-quotations`, `geo-no-citations`) so each can be dismissed and tracked on its own.

### 2.3 `classifyFaq` passes on the literal string "FAQ" **[verified]**

```js
if (/frequently asked questions|\bf\.?a\.?q\b/i.test(String(html || ""))) return null;
```

A nav link reading "FAQ" satisfies this. The page needs no Q&A content at all. Tighten it to require
the marker inside a heading, or require 2+ question-shaped headings:

```js
const qHeadings = (html.match(/<h[23][^>]*>[^<]*\?[^<]*<\/h[23]>/gi) || []).length;
const faqHeading = /<h[1-3][^>]*>[^<]*(frequently asked|preguntas frecuentes|f\.?a\.?q)[^<]*<\/h[1-3]>/i.test(html);
if (qHeadings >= 2 || faqHeading) return null; // has real FAQ content
```

### 2.4 The SSRF guard makes the lens unusable pre-deploy **[verified]**

`getResource` runs every URL through `checkFetchUrl`, which blocks loopback. Correct for a scanner
pointed at a production URL, wrong for the moment you actually want this feedback, which is before
you ship. Running the lens against `http://127.0.0.1:3000` prints
`base URL unreachable (0); skipped.` and exits 0, which reads as a pass.

Two problems: no local mode, and **a skipped lens exits 0 and is invisible in the verdict.**

Fix:
- Add `--allow-local` / `LAUNCHPROOF_ALLOW_LOCAL=1` that permits loopback and RFC1918 only when
  explicitly passed. Keep the guard on by default.
- A skipped lens must surface in the report as `coverage-gap`, never as a silent pass. A scan that
  could not run is not a scan that found nothing. (The 1.0.29 notes suggest coverage honesty work
  already landed elsewhere; this path still slips through.)

Workaround in the meantime, which is what was used here: `require()` the module and call the
exported `classify*` functions directly on locally-fetched HTML. Worth shipping as
`lib/aeo-local.cjs` so it is a supported path rather than a trick.

---

## 3. New checks: the "declared capability must actually work" class

**This class does not exist in launchproof or beacon, and it is the most valuable thing in this
document.** It is also uniquely suited to launchproof, because launchproof already has a browser
and a route map. A pure SEO tool cannot do this. Launchproof can.

Structured data is a set of *promises to a machine*. Every other tool validates the promise's
syntax. Nobody checks whether the promise is true.

### 3.1 `schema-action-unreachable` (P1) **[verified: caught a real one]**

`WebSite.potentialAction.target.urlTemplate` was authored as
`https://site/exercises?q={search_term_string}`. The route exists and returns 200 to a browser.
It also **307s to `/auth/sign-in`** for anyone not logged in. The declared search endpoint was a
login wall.

Detection:

```
for each potentialAction/EntryPoint urlTemplate in JSON-LD:
  substitute a benign value for {placeholders}
  fetch WITHOUT credentials, do not follow redirects
  FAIL if: status is 3xx to an auth path, or 401/403, or the final page is an auth form
```

Rationale: the site is telling an answer engine "you can search me here." If that lands on a login
wall, the engine burns trust on a dead end. The completeness point is not worth it. **The correct
resolution is usually to delete the declaration, not to fix the route**, so the finding text must
say so, otherwise an auto-fixer will happily build a public search page nobody asked for.

### 3.2 `schema-url-unreachable` (P2)

Same idea, broader. Every absolute URL in JSON-LD (`logo`, `image`, `url`, `sameAs`, `Offer.url`,
`contactPoint`) gets a HEAD request. Any non-2xx is a finding. A `logo` pointing at a renamed file
is invisible to a human reviewer and silently degrades entity resolution.

Caught in this repo previously: a landing page still loading deleted Webflow scripts. Same failure
mode, different surface.

### 3.3 `schema-content-mismatch` (P2)

The rule already documented in this repo's `src/lib/seo/schema.ts`: **schema must match visible
content.** Concretely checkable:

- `Offer.price` must appear as a string in the rendered text of the page that declares it.
- `AggregateRating` requires visible reviews on the same page. This one is also a Google policy
  violation and a manual-action risk, not just a quality issue.
- `FAQPage` question text must appear in the DOM.
- `SoftwareApplication.featureList` entries should be findable in page text.

Rationale: this is the difference between structured data and lying to a crawler in a way that is
machine-detectable. It is also the check most likely to catch a page where the copy was updated and
the schema was not.

### 3.4 `schema-sameas-unverified` (P3, informational)

`sameAs` is the AIO primitive: it is how an engine resolves a name to one real entity. But an
invented `sameAs` URL attaches the brand to an account it may not own, which is worse than omitting
it.

Check: each `sameAs` resolves 2xx, and the destination page links back to the site or contains the
brand or person name. Report unverified entries rather than failing the build. Never auto-fix.
Never guess a handle.

---

## 4. New checks: content shape (port from beacon, then extend)

### 4.1 `atomic-answer-too-long` (P2) **[reported threshold, verified as measurable]**

Beacon's rule: the concatenated `<p>` text following each `h2`/`h3` must be **80 words or fewer**,
or the block is not snippet-eligible. This is the highest-signal content check available and
`aeo.cjs` does not have it.

Measured on the Thick & Fit home page: **17 of 18 headings pass, 1 fails at 141 words.**

Two implementation notes that matter:

1. **Report per heading, not per page.** "1 of 18 headings fails, here is which one" is actionable.
   A page-level score is not.
2. **A narrative section legitimately fails this and should stay failing.** The founder story on
   this page runs 141 words under one heading on purpose. Chopping it into 80-word blocks under SEO
   subheadings would damage the page. The finding must be dismissible per heading, and the
   dismissal must persist, or every future run re-raises it and eventually someone "fixes" it.

### 4.2 `no-definitional-sentence` (P2) **[verified: caught a real gap]**

Beacon states this in prose but does not enforce it: the first ~200 words should name the business,
the category, and the differentiator.

This caught a genuine problem. The hero read "Helping women fall in love with the journey" and the
subhead sold the outcome. Beautiful, on-brand, and it never said what the product was. A cold
visitor and an answer engine both got nothing factual. Fixed by adding one quiet sentence; the word
"bilingual" moved to position 51.

Detection heuristic (report as advisory, keep it cheap):

```
words = first 200 words of visible text
FLAG if none of: the Organization name from JSON-LD appears
                 AND a category noun appears (app, platform, service, coaching, agency, tool...)
```

This is the check most likely to catch a well-designed page. Design-led marketing pages fail it
constantly, because "sell the vision, not the product" and "state what you are" pull in opposite
directions. Both are right. The resolution is a quiet factual line, not a rewritten headline, and
the finding text should say that so nobody rewrites their hero over it.

### 4.3 `thin-content` (P2) **[reported]**

Beacon's phase-3 floor: under 600 words fails, 1000+ scores 85, 1500+ scores 100. Worth porting,
with one caveat: a pure funnel page is short by design and should be dismissible. Measured here:
1,402 words after the marketing sections were restored, versus roughly half that before.

### 4.4 `low-extractability` already exists, but should count, not just detect

Current check passes if ANY `ul`/`ol`/`table` or a Q&A phrase exists. One stray `<ul>` in a footer
passes it. Prefer a count of answer-shaped blocks in `main`, and weight tables highest, since
comparison tables are the single most-lifted structure in generative answers.

---

## 5. The bilingual gap: neither tool has an opinion **[verified as absent]**

Beacon hardcodes `lang="en"` and only presence-checks hreflang. `aeo.cjs` does not look at
i18n at all. For any bilingual product this is the largest blind spot in both tools, and it is
Kaldr's differentiator on at least one live build.

Checks to add:

### 5.1 `hreflang-not-reciprocal` (P2)

If `/` declares `hreflang="es"` pointing at `/es`, then `/es` must declare `hreflang="en"` pointing
back. Non-reciprocal hreflang is ignored wholesale by Google, so a half-configured setup buys
nothing while looking configured.

### 5.2 `hreflang-no-x-default` (P3)

Absent `x-default` means the engine guesses which locale to show an unmatched user.

### 5.3 `locale-claim-drift` (P1) **[reported: a real, live instance]**

The highest-value check in this section, and the one nobody has.

A live example in `myreceptionistnet`: the English hero dropped an unprovable "2,000+ businesses"
claim, but `es.json` still ships it, and the urgency banner still claims "500+ businesses" in both.
One locale was corrected and the other was not.

This is not an SEO problem. It is a **truth-in-advertising problem that only exists in i18n
codebases**, it is invisible to every reviewer who does not read both languages, and it is trivially
machine-detectable:

```
extract every numeric claim (\d+[KkMm+,]* followed by a noun) from each locale file
group by message key
FAIL if a key contains a numeric claim in one locale and a different or absent one in another
```

Rationale: an unprovable number must die in every locale simultaneously. Ship this as a lens check
AND recommend it as a CI rule, because it regresses every time someone edits one locale.

### 5.4 `atomic-answer-too-long` must run per locale

Spanish runs roughly 20 to 25 percent longer word for word than English. A 70-word English paragraph
becomes an 85-word Spanish one and fails the 80-word limit. Running the check only against the
default locale gives a false pass on every translated page.

### 5.5 `schema-not-localized` (P3)

`inLanguage`, and localized `name`/`description`, should reflect the served locale. A Spanish page
serving English-only schema tells the engine the Spanish content does not exist.

---

## 6. New checks: SXO **[verified: caught two real bugs]**

Post-click experience. These are cheap, deterministic, and launchproof already has the browser.

### 6.1 `contrast-fails-on-non-white-ground` (P2)

**Caught twice on this build.** The design system's `--c-faint: #757575` was tuned to clear 4.5:1
**on white**, documented in a code comment. The marketing page grounds sections in warm cream
`#e7e5df`, where the same token measures **3.71:1** and fails for any text under 18px.

This is a whole bug class: a token verified against one background, used on another. Do not check
tokens. Check computed style against computed background, per rendered element:

```
for each text node in main:
  fg = computed color, bg = nearest non-transparent ancestor background
  required = 3.0 if (>=24px, or >=18.66px and bold) else 4.5
  FAIL if ratio < required
```

Report the element, both hex values, the measured ratio, and the required one. Measured, never
eyeballed.

### 6.2 `theme-leak-on-public-page` (P1)

**Caught on this build.** `next-themes` writes `data-theme="dark"` on `<html>`. Marketing pages
hardcoded `bg-white` but used a themed `text-ink` token. Any visitor who had ever toggled dark mode
inside the app got **near-white body text on a white background** on the public landing page.

Detection: load each public route twice, once with the dark-theme attribute or `prefers-color-scheme:
dark` forced, and run the contrast check both times. Any element that passes in one mode and fails in
the other is a theme leak.

Generalizes to any app with a theme toggle and hardcoded marketing surfaces, which is most of them.

### 6.3 `cta-below-mobile-fold` (P2)

Primary CTA must be within roughly 650px at 375px wide. Verified at 570px here after adding the
definitional sentence, which is exactly the kind of change that silently pushes a CTA out of reach.

### 6.4 `horizontal-overflow` (P2)

`document.scrollWidth > clientWidth` at 375px. **Must ignore intentionally clipped children**: a
marquee track is legitimately 2865px wide inside an `overflow-hidden` parent. Test the document, not
the elements, or the check drowns in false positives.

### 6.5 `render-blocked-asset` (P2)

Every `<img>` in the served HTML gets a HEAD request. A 404 hero renders as an empty box and nobody
notices until a client does. Note that `loading="lazy"` images report `naturalWidth === 0` until
scrolled into view, so **fetch the `src` attribute, do not read `naturalWidth`**, or you will report
every below-fold image as broken.

### 6.6 `display-font-fallback` (P2)

Check `document.fonts` for the intended display face in `loaded` state, and confirm the rendered
`font-family` resolves to it rather than the fallback. A page silently rendering Impact instead of
the brand face looks broken and no build step catches it.

---

## 7. What "done" looked like on Thick & Fit, as a reference implementation

Point the docs at these. They are the artifacts a passing app produces.

| Concern | File | What it does |
|---|---|---|
| AI crawler posture | `src/app/robots.ts` | Names **14** agents explicitly with a shared DISALLOW list, rather than relying on `*`. Beacon scores explicit allow blocks higher than implicit. Full list below. |
| Schema builders | `src/lib/seo/schema.ts` | Pure node builders plus a `graph()` combiner. Stable `@id` constants (`#organization`, `#person`, `#website`) reused across every page, which is what lets an engine merge the entity instead of seeing three brands. |
| Entity / AIO | `personNode()` | The founder as a first-class citable `Person` with `sameAs`, `worksFor`, `knowsLanguage`. This is the AIO play: engines resolve and cite people. |
| CSP-safe injection | `src/components/seo/json-ld.tsx` | Async server component reading the `x-nonce` header. |
| GEO grounding | `public/llms.txt` | Who it is for, differentiators, pricing, direct answers, founder as entity. |
| Answer surface | `src/app/faq/page.tsx` | Real Q&A with `FAQPage` schema. Kept plainly factual on purpose, per the voice rules, because a direct answer IS the job there. |

The 14 agents: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-Web`, `anthropic-ai`,
`PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `cohere-ai`,
`meta-externalagent`, `Bytespider`.

`Bytespider` was the gap beacon caught. Worth calling out in launchproof's docs because ByteDance
reach is disproportionately large in LATAM, so an English-market default list quietly costs you a
region.

---

## 8. Suppression design: the part that decides whether anyone keeps using this

Three of the findings above are **correct detections that should stay unfixed on a good page**:

- the 141-word founder story
- the absent `SearchAction` (no public search exists, so declaring one would lie)
- a short funnel page under the word floor

If a lens cannot express "known, deliberate, here is why," a team either fixes things that should
not be fixed or stops running the lens. Requirements:

1. Dismissal is **per finding instance** (route plus heading), not per `kind`. Dismissing the
   atomic-answer finding globally would suppress it for every future heading.
2. The dismissal record stores **the reason**, and the report prints it. Six months later the reason
   is the only thing that stops someone re-litigating it.
3. **The auto-fixer must never touch a finding whose correct resolution is deletion.** Mark these
   `resolution: "remove-or-dismiss"`. An auto-fixer that reads `schema-action-unreachable` and
   builds a public search page is worse than the finding.
4. Dismissed findings still print in the report as a dismissed count. Invisible suppression rots.

---

## 9. Priority order

1. **`schema-action-unreachable` and the declared-capability class.** Genuinely novel, uniquely
   suited to launchproof's browser, and it caught a real defect within minutes of being conceived.
2. **`locale-claim-drift`.** Nobody has it, it is a truth problem rather than a ranking problem, and
   there is a live instance in another Kaldr repo right now.
3. **`theme-leak-on-public-page` and the contrast rewrite.** Two real bugs on one page, both
   invisible to every existing check.
4. **`atomic-answer-too-long`, per heading, per locale.** Port from beacon.
5. **Fix `classifyGeoSignals`.** The `562K` false negative is producing bad findings today.
6. **`--allow-local` plus coverage-gap reporting.** A silently skipped lens is worse than no lens.
7. **`no-definitional-sentence`.** Cheap, and it catches the failure mode good designers have.
