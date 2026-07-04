# Thick & Fit — Design Handoff for Claude Code

## What this is
A complete, bilingual (EN/ES) visual design package for the **Thick & Fit** fitness coaching app, covering all three surfaces and every contracted feature across Phases 1–3. This bundle is the **visual source of truth** that pairs with the PRDs already in the repo (`Build/02-prds/` and `.planning/`).

**Build all of it exactly as it looks now.** These are the current, final designs — recreate every screen pixel-for-pixel in the real stack. The most recent, highest-priority interactive surfaces to build are:
- **`Thick & Fit - Onboarding.dc.html`** — the new-member sign-up flow (start here for the user journey).
- **`Thick & Fit - Client Portal.dc.html`** — the responsive subscriber dashboard (desktop / tablet / mobile in one), the primary logged-in web experience.
- **`Thick & Fit - Workout Player.dc.html`** — the in-session training screen (progressive-overload logging, rest timer, muscle heatmap).
- **`Thick & Fit - Food Log.dc.html`** — the AI food-logging flow (snap → analyze → result → log).
- **`Thick & Fit - AI Nutrition Engine Brief.dc.html`** — the engineering spec for the nutrition data layer (real APIs, schema, pipeline). **Read this before building any food/macro feature.**

## How to use this with Claude Code
These `.dc.html` files are **design references** — interactive HTML prototypes showing the intended look, copy, and behavior. They are **not** production code to copy verbatim. Your job:

1. **Read the PRDs first** (`Build/01-foundation-docs/` for the blueprint, `Build/02-prds/` for the 48 feature PRDs). The PRDs define *what* to build and the data model; these designs define *how it looks and feels*.
2. **Recreate each screen** in the repo's real stack (Next.js / React + Supabase + Stripe, per the agreement) using its existing patterns — not by embedding the HTML.
3. **Match the visual system pixel-for-pixel** using the Design Tokens below. This is **high-fidelity** — final colors, type, spacing, and interactions are intentional.

## How to view the prototypes
Open any `.dc.html` file directly in a browser (they load `support.js` — and, for the Nutrition Brief, `doc-page.js` — from this folder). Start with **`Thick & Fit - Design Hub.dc.html`** — it links to every other surface (the two new lead cards are Onboarding and Client Portal) and explains the system. **`Thick & Fit - Scope Audit.dc.html`** maps every contracted feature to its design.

**Note on interactivity:** the interactive prototypes hold state in-memory and, in two cases, `localStorage`. Onboarding writes the completed plan to `localStorage['tf_plan']`; the Client Portal reads it on load and personalizes itself (see "Onboarding → Portal handoff" below). Build these as real client state/data — the `localStorage` keys are a prototype stand-in for the backend.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0f0f0f` | Primary text, buttons, dark surfaces, sidebar |
| `--surface` | `#ffffff` | Cards |
| `--bg` | `#fafafa` | App background |
| `--bg-warm` | `#f0f0f0` | Secondary surfaces, inset cards, segmented tracks |
| `--line` | `#e4e4e4` / `#ececec` | Hairlines, borders |
| `--muted` | `#767676` | Secondary text, captions |
| `--text-soft` | `#5c5c5c` | Body copy on light |
| `--accent` | `#5EBE62` | Positive/active ONLY (completion, streaks, live data, success). Never decorative. |
| `--accent-ink` | `#053b07` | Text on green |
| Status: pending `#FBE6A2`/`#6b5200` · alert `#F3C0C0`/`#7a1f1f` · warning `#c89a2b` |

**Rule:** The product is monochrome. Green is functional only (a completed set, a positive trend, a live indicator). No gradients as decoration, no green buttons in the coach console.

### Typography
| Role | Font | Notes |
|---|---|---|
| Display / headings | **Gulams Condensed** (`assets/fonts/gulams.woff2`, weight 600) | UPPERCASE, line-height ~0.85, tracking +0.5px. Her real brand font. |
| Body / UI | **Inter** (400/500/600/700) | All running copy, labels, inputs |
| Eyebrows / labels | Inter 600, UPPERCASE, letter-spacing 1–3px |

Fallback for Gulams: `Impact, sans-serif`.

### Shape & spacing
- **Buttons:** pill (`border-radius: 100vw`), often paired with a circular arrow badge (see landing/nav). Uppercase Inter 600, letter-spacing 1px.
- **Cards:** `border-radius: 14–16px` (app/admin), `2px` only for the gallery frames. Subtle shadow `0 1px 3px rgba(0,0,0,.08)`; dark hero cards use photo + black gradient overlay.
- **Avatars:** monochrome monogram circles (initials on `#0f0f0f`) until real member photos exist.
- **Exercise thumbnails:** movement still + small play badge (tap → demo video). Muscle map on the exercise detail screen.
- **Icons:** thin line icons, `stroke-width: 1.6–1.8`, `currentColor`. No emoji anywhere.

### Motion
- Macro/goal rings animate-fill on load (`stroke-dashoffset`).
- Milestone confetti on workout-complete / streak / goal hit.
- Press feedback: `transform: scale(.97); opacity:.85` on `:active` for any `cursor:pointer`.

---

## Surfaces & screens

### 1. Marketing site — `Thick & Fit - Landing Page.dc.html`
Mirrors her live site. Hero ("Helping women *fall in love* with the journey"), client-success gallery, coaching cards, about, dark testimonials, accordion FAQ, footer. Real logo + photography. **Do not redesign** — this matches what exists today.

### 2. Subscriber app — `Thick & Fit - Mobile App.dc.html` (interactive)
Bottom nav: **Today · Chat · Activities · Nutrition · You** (matches her current app so migrated clients don't relearn). 12+ tap-through screens: Today/home, Workouts (photo hero), Exercise player (reps + weight steppers, set tracker, video), Nutrition (animated macro ring), Add Food (Search/Scan/AI Photo), Community feed, Challenges, Habits, Messages hub → Coach chat (voice notes + file attachments), You (goal + weight tracker), Check-in, Progress. EN/ES toggle, bezel/bare toggle.

### 3. Coach dashboard — `Thick & Fit - Coach Dashboard.dc.html` (interactive)
Sidebar IA mirroring Lenus. Overview (KPIs + live activity + charts), Subscribers (segment-tag filters: Spanish/GLP-1/PCOS/Bride/Workout-only/Churned + win-back), Subscriber Profile (8 tabs: Overview/Nutrition/Workouts/Community/Progress/Messages/Billing/Notes), Program Builder, Create Broadcast, App Health, Billing & Renewals.

### 4. Client Portal (responsive web) — `Thick & Fit - Client Portal.dc.html` (interactive) — **PRIMARY**
The logged-in subscriber experience on the web, in **one responsive layout** with a built-in Desktop / Tablet / Mobile switcher (top-right; for review only — ship true responsive breakpoints, not a manual toggle).
- **Chrome:** left sidebar (script logo + "Kiara · [tier]" label + nav: Today / Workouts / Nutrition / Progress / Community / Messages / Account) on desktop, collapsing to a bottom tab bar on mobile. Top bar with page title, food/workout search, notifications bell, avatar. A camera FAB (mobile) and a search-bar entry both deep-link into the Food Log flow.
- **Background is warm cream** `#E7E5DF` (page) with `#F3F3F1`/`#FAFAF7` insets — this is the current app-surface direction (warmer than the `#fafafa` used in the older library files; when they conflict, **the Portal is canonical for the logged-in app**). Cards stay white, radius 14–18px.
- **Pages:** Today (dark photo hero + streak, "Today at a glance" stats, macro rings, today's workout with photo hero, habits checklist, weight/goal progress, coach card), Workouts (session card + "Your progression" card showing last-session weights with +5 lb suggestions), Nutrition (targets + macro rings + meal log), Progress (weight chart + before/after photo grid), Community (feed with photos + reactions), Messages (inbox + coach chat thread with bubbles), Account (profile, membership card with tier + price, next coach call, settings).
- **Personalization:** week label, calorie + protein targets (and every derived bar/ring/"left" figure), program name, sidebar tier label, and Account tier+price all read from the onboarding plan when present, else fall back to a self-consistent demo. EN/ES toggle throughout.

### 5. Onboarding — `Thick & Fit - Onboarding.dc.html` (interactive) — **PRIMARY**
Premium 10-screen mobile sign-up that ends by handing off into the Portal.
- **Flow:** Welcome (full-bleed Steph hero) → 7 questions (goal, unit system, age, height, current weight, goal weight, training days, training place, coaching tier) → weight-prediction/plan preview → "you're ready" summary with computed daily targets → finish.
- Full-bleed hero photography, large Gulams headings, single-choice cards with press feedback, steppers/sliders for numeric inputs, a progress indicator, and a computed **daily target** (calories + protein) shown before finish. EN/ES.

### 6. Workout Player — `Thick & Fit - Workout Player.dc.html` (interactive) — **PRIMARY**
The in-session training screen — no AI, all coach-authored programming, built around **progressive overload** (the retention engine).
- **"Last time · 12 × 130 lb"** on every set, pulled from history, with a suggested next load.
- Working-set logging (reps + weight steppers, tap to mark a set done), auto **rest timer** overlay between sets, exercise video/still + a **muscle-activation heatmap** (front/back anatomical figures with per-exercise highlighted groups), activation chips, and a workout-complete state.

### 7. Food Log (AI nutrition) — `Thick & Fit - Food Log.dc.html` (interactive) — **PRIMARY**
The Cal-AI-style food capture loop, in T&F's editorial style with a coaching layer.
- **Snap → Analyze → Result → Log**: camera capture, analyzing state, an editable result card (identified food, portion, macros), an ingredient editor, a barcode path, and a describe-in-words path.
- **The result adds coaching Cal AI doesn't have:** goal-impact ("fits your plan" / how it moves today's targets), coach-suggested swaps. **The macro numbers must come from a real food database, not the LLM** — the LLM only identifies the food and estimates the portion. See the Nutrition Brief.

### 8. AI Nutrition Engine — `Thick & Fit - AI Nutrition Engine Brief.dc.html` (build spec, printable)
Not a UI mock — the **engineering brief** for the nutrition data layer. Hand it to the dev before building any food/macro feature. Covers: the 4-path pipeline (photo / barcode / describe / search), a launch-cheap-vs-scale-paid API stack, real data sources with rate limits (**USDA FoodData Central** — free key, 1,000 req/hr/IP; **Nutritionix** — branded/restaurant + NL, enterprise-priced, no free tier; **Open Food Facts** — free barcode DB, no key, 15 req/min/IP, cache hard, don't use for type-ahead), the Supabase schema (`foods` / `food_logs` / `ai_estimates` / `nutrition_targets`), and the exact JSON contracts.

---

## Onboarding → Portal handoff (implement as real state/data)
On finishing onboarding, the prototype writes a plan object to `localStorage['tf_plan']`:
```json
{ "goal": "glute", "goalLabel": "Build glutes & curves", "program": "Glute Builder",
  "cals": 1954, "protein": 142, "days": 4, "place": "gym",
  "tier": "coached", "habits": ["...","...","..."], "lang": "en", "ts": 0 }
```
The Portal reads it on mount and personalizes. **Tier map** (used for the sidebar label, Account membership, and price):
| `tier` | Label | Price |
|---|---|---|
| `self` | Self-Guided Member | $29/mo |
| `coached` | Coached Member | $99/mo |
| `premium` | Premium Member | $249/mo |
When no plan exists, both surfaces fall back to a self-consistent demo. In production this is real user state from the backend (onboarding answers → computed targets → user profile) — not `localStorage`.

---

### 9. Screen libraries (static spec catalogs — every state, for reference)
- **`Thick & Fit - Customer Screens.dc.html`** — auth (sign in/up, forgot, verify), onboarding (goal → about → weight prediction → plan), paywall + checkout + success, workout (follow-along, rest, complete, swap), nutrition (AI photo + result, barcode, recipe), account (manage, cancel, settings, chat), store (shopping list, digital store, premium $2.99 upsell), Phase 3 (affiliate store, live stream).
- **`Thick & Fit - Admin Screens.dc.html`** — coach login, create challenge, automation, analytics, payouts, branding, support inbox, billing & renewals, form/question builder, notifications & email, LATAM multi-currency pricing.
- **`Thick & Fit - System & Edge.dc.html`** — 404, 500, offline, maintenance, empty, loading skeleton, trial-ended, admin 404. All on-brand, bilingual.

### Reference
- **`Thick & Fit - Design System.dc.html`** — the canonical token/component kit.
- **`Thick & Fit - Design Hub.dc.html`** — start here; links everything.
- **`Thick & Fit - Scope Audit.dc.html`** — contracted-feature → design-status matrix.

---

## Bilingual (non-negotiable, day one)
Every string ships EN + ES. The pattern is an independent UI-language toggle (the Fitia model): the interface language and the food-database language resolve separately. In these prototypes, copy lives in a per-file `T()` dictionary with `en`/`es` objects — use those as your translation source strings. Build with i18n keys from the start; do not hardcode English.

## Assets
- `assets/logo-black.svg`, `assets/logo-white.svg` — her real script wordmark.
- `assets/fonts/gulams.woff2` — brand display font.
- `assets/img/*.avif` — her real hero, transformation, and current-app marketing photos (placeholders for product photography to be shot; swap exercise/member photos when filmed).

## Screenshots (`screenshots/`)
PNG renders of every surface, for a dev who won't run the HTML. Numbered to match the surface order above:
- `01-design-hub`, `02-design-system`
- `03-landing-page-*` (hero / mid / lower)
- `04-portal-desktop-*` (today, workouts, nutrition, progress, community, messages, account) + `04-portal-mobile-*` (today, nutrition, workouts)
- `05-onboarding-*` (goal → tier; the welcome and "plan ready" screens are full-bleed photo screens that don't capture cleanly — see the live `.dc.html`)
- `06-workout-player`, `07-foodlog-*` (home, camera, analyzing, result)
- `08-mobile-app-home`, `09-coach-dashboard`
- `10-customer-screens`, `11-admin-screens`, `12-system-edge` (catalog headers — open the files for the full grids)
- `13-scope-audit`, `14-polish-direction`, `15-nutrition-engine-brief`

The screenshots are a convenience; the `.dc.html` files are the source of truth (open them for scroll, state, and interaction the stills can't show).

## What's design-complete vs. still open
Per the Scope Audit: **all Phase 1, 2, and 3 features have designs.** Remaining work is *depth refinement* (drip-builder trigger detail, AI-capture live shimmer, coach-toolbox roles/permissions) and **build-only** items needing no design (PWA install, app-store submission, infra wiring). Real exercise-demo videos and member face photos are placeholders.

## Suggested build order (matches the agreement's phases)
1. **Phase 1:** auth + bilingual i18n scaffold, onboarding, workout system, subscriber dashboard, Stripe billing, basic coach admin, PWA.
2. **Phase 2:** nutrition (macros/food DB/barcode), meal plans/recipes, community, check-ins, habits, multi-form builder.
3. **Phase 3:** drip + AI messaging, full coach toolbox, digital store + $2.99 upsell + affiliate, gamification, push/email, then live streaming + AI photo logging + LATAM pricing.
