# Roadmap: Thick & Fit — Milestone v1.0 (Phase 1 / MVP)

**Branch:** `main` · **16 phases** · build order tuned for an autonomous loop: foundation → API →
full platform → money → migration last.

> Each GSD phase = one PRD. Full spec per phase lives in `Build/02-prds/<PRD>.md` (`plan-phase` reads it).
> **Order deviates from the kit on purpose** (per owner direction): API surface (PRD-47) pulled forward
> behind foundation; money phases (PRD-05/06) and the Lenus migration (PRD-00) pushed to the end so the
> loop builds the platform before hitting gated/blocked work. PRD-47 is normally a `phase-3` item —
> it is pulled onto `main` for this milestone.

| # | Phase | PRD | Goal | Reqs | Risk |
|---|-------|-----|------|------|------|
| 1 | Foundation | PRD-01 | Scaffold, schema, RLS, security, PWA, shared infra | FND-01..05 | high |
| 2 | API / MCP Surface | PRD-47 | Internal REST API surface + MCP server on PRD-01 api infra | API-01 | medium |
| 3 | Bilingual Infrastructure | PRD-02 | Independent EN/ES UI/DB toggle | I18N-01 | high |
| 4 | Marketing Shell + Waitlist | PRD-03 | Pre-registration funnel + GHL drip + legal | MKT-01 | medium |
| 5 | Auth + 5-Role RBAC | PRD-04 | Sign-in providers + role enforcement | AUTH-01, AUTH-02 | high |
| 6 | Multi-Form Builder | PRD-04b | Reusable form engine | AUTH-03 | high |
| 7 | Onboarding Questionnaire | PRD-04c | Questionnaire + live weight prediction | AUTH-04 | high |
| 8 | Subscriber Dashboard | PRD-07 | Logged-in client home | SUB-01 | medium |
| 9 | Exercise Library | PRD-08 | 2,619 seed + filmed demos | WKT-01 | medium |
| 10 | Substitution Engine | PRD-09 | 5-context equipment swaps | WKT-02 | high |
| 11 | Program Builder | PRD-10 | Coach-side program authoring | WKT-03 | high |
| 12 | Workout Player | PRD-11 | Timer, Wake Lock, overload, follow-along | WKT-04 | high |
| 13 | Workout Logging + History | PRD-12 | Set/rep/weight capture + history | WKT-05 | medium |
| 14 | Stripe Connect + Billing 🔒 | PRD-05 | Honest billing, 3DS, chargeback automation | BILL-01 | high |
| 15 | Pricing + Rev-Share Firewall 🔒 | PRD-06 | Tiers, cohort SKUs, legacy firewall enforcement | BILL-02 | high |
| 16 | Lenus Migration Importer ⚠ | PRD-00 | Import 256 clients + history, legacy firewall | MIG-01 | high |

🔒 = human plan-review gate before code (money). ⚠ = execution blocked on external data (build now, run later).

---

## Phase Details

### Phase 1 — Foundation (PRD-01) · no deps · unlocks everything
**Goal:** Stand up the project skeleton every later phase inherits.
Success criteria:
1. Supabase migrations 0001-0007 apply cleanly; `companies` + `profiles` exist with `company_id` + RLS + 5-role enum + `is_legacy_client`.
2. Security suite present (audit_log, session_logs, consent, security headers, auth rate limiting).
3. PWA installs (manifest + sw.js + install banners); 4 shared UI state components render.
4. `lib/supabase` client/server/service + `_shared/api.ts` + `api_keys`/`api_usage_log` + run-ai-eval + resend-webhook wired; typecheck + lint + blocking hooks pass.

### Phase 2 — API / MCP Surface (PRD-47) · deps: Phase 1
**Goal:** Stand up the internal REST API surface (and MCP server) on the foundation's api infra, so later phases build against a stable internal API.
Success criteria:
1. Internal REST API surface live on `_shared/api.ts`; SHA-256 API keys + `api_usage_log` enforced.
2. `GET /api/v1/ping` → 200; auth + company scoping enforced on API routes.
3. MCP server scaffolded (Build Profile D: no public API Settings UI / Connect-to-Claude page).
> Pulled forward from `phase-3` per owner direction. If MCP itself should stay deferred, build the REST surface here and leave the MCP server stubbed.

### Phase 3 — Bilingual Infrastructure (PRD-02) · deps: Phase 1
**Goal:** Independent UI vs DB-content language toggle (EN/ES), Fitia pattern.
Success criteria:
1. UI language and content language switch independently and persist.
2. Translation layer covers app shell; missing-key fallback defined.
3. DB content stores/serves both locales without duplication drift.

### Phase 4 — Marketing Shell + Pre-Registration Waitlist (PRD-03) · deps: Phase 1
**Goal:** Public funnel + waitlist with GHL drip and the legal pillar.
Success criteria:
1. Waitlist capture writes a lead and triggers the GHL drip.
2. Privacy / ToS / consent / retention pages live (Legal Pillar 4).
3. Marketing surface follows the design doctrine (no banned patterns).

### Phase 5 — Auth Flows + 5-Role RBAC (PRD-04) · deps: Phase 1
**Goal:** All sign-in providers + enforced role model.
Success criteria:
1. Sign up / log in works for email+password, Google, Apple, Magic Link; session persists across refresh.
2. The 5 roles gate routes/actions correctly (Subscriber, Free, Coach, Assistant Coach, Operator).
3. Auth endpoints rate-limited; device fingerprint captured at signup.

### Phase 6 — Multi-Form Builder Engine (PRD-04b) · deps: Phase 5
**Goal:** Reusable form engine Stephanie controls.
Success criteria:
1. Coach can build a form with multiple field types and publish it.
2. Submissions persist with company scoping + RLS.
3. Onboarding (Phase 7) consumes this engine.

### Phase 7 — Onboarding Questionnaire (PRD-04c) · deps: Phase 6
**Goal:** Editable questionnaire with live weight-prediction chart + plan preview.
Success criteria:
1. New user completes the questionnaire; answers persist to their profile.
2. Live weight-prediction chart updates from inputs.
3. Plan preview renders before commitment.

### Phase 8 — Subscriber Dashboard (PRD-07) · deps: Phase 5, 7
**Goal:** The logged-in client home surface.
Success criteria:
1. Dashboard shows the client's plan, next workout, and key state.
2. Respects role + company scoping; renders all four UI states.
3. Billing/subscription widgets stub gracefully until Phases 14-15 land.

### Phase 9 — Exercise Library (PRD-08) · deps: Phase 1
**Goal:** Seeded + filmed exercise library.
Success criteria:
1. 2,619-exercise seed imported; Stephanie's filmed demos attach to exercises.
2. Search + filter by muscle/equipment works bilingually.
3. Video playback via Mux (Cloudflare fallback).

### Phase 10 — 5-Context Equipment Substitution Engine (PRD-09) · deps: Phase 9
**Goal:** Swap any exercise by available equipment across 5 contexts.
Success criteria:
1. Given an exercise + equipment context, the engine returns valid substitutes.
2. Substitutions respect muscle target + movement pattern.
3. Covers all 5 equipment contexts.

### Phase 11 — Program Builder (coach-side) (PRD-10) · deps: Phase 9, 10
**Goal:** Coach authors multi-week structured programs.
Success criteria:
1. Coach builds a multi-week program with sessions, sets/reps, rest, notes.
2. Programs save as reusable templates and assign to clients.
3. Reuses workout-cool pattern; company-scoped + RLS.

### Phase 12 — Workout Player (PRD-11) · deps: Phase 11
**Goal:** The in-workout experience.
Success criteria:
1. Player runs a session with audible timer + Wake Lock (screen stays on).
2. Progressive-overload suggestions surface from history.
3. Follow-along mode plays demo video inline.

### Phase 13 — Workout Logging + History (PRD-12) · deps: Phase 12
**Goal:** Capture and review training.
Success criteria:
1. User logs set/rep/weight per exercise during a session.
2. Completion + enjoyment/effort recorded.
3. History view shows past sessions grouped by week.

### Phase 14 — Stripe Connect + Honest Billing Engine (PRD-05) · deps: Phase 1 · 🔒 money
**Goal:** Billing with anti-fraud + honest-billing moat.
Success criteria:
1. Stripe Connect charges succeed with 3DS; signed webhooks verified.
2. Card-testing prevention + chargeback evidence automation in place.
3. Money stored as BIGINT cents; ledger/audit on payment events.
> TDD mode on (money code). Human plan-review before code.

### Phase 15 — Pricing Tiers + Cohort SKUs + Rev-Share Firewall (PRD-06) · deps: Phase 5, 14 · 🔒 money
**Goal:** Tiered pricing, cohort SKUs, legacy firewall enforcement.
Success criteria:
1. Subscription tiers + one-time cohort SKUs purchasable.
2. `is_legacy_client` accounts firewalled out of rev-share (enforced, deployment-blocking).
3. Grandfathered pricing honored at checkout.
> Pricing *values* pending Stephanie (assumptions isolated here); structure does not depend on final numbers.

### Phase 16 — Lenus Migration Importer (PRD-00) · deps: Phase 1 (+ full schema) · ⚠ data blocker
**Goal:** Importer that brings 256 clients + 11 datasets into the new schema with the legacy firewall.
Success criteria:
1. Importer maps all 11 datasets (measurements, check-ins, workouts, habits, chat, meal plans, tags) idempotently.
2. Every imported account stamped `is_legacy_client=true`, `legacy_source='lenus'`, `lenus_profile_id`; grandfathered pricing preserved.
3. Deploy blocked if any imported record misses the legacy flag.
> Placed last on purpose: by now all target tables exist, and the live run needs Lenus data loaded into Supabase (Rodney). Importer is built + fixture-tested here; the live run is gated on that.

---

## Coverage

- Phases: 16 · PRDs: PRD-00-12 (incl. 04b, 04c) + PRD-47 · Requirements mapped: 22/22 ✓
- Branch: `main` (all of milestone v1.0)
- Loop strategy: Phases 1-13 build the platform unattended; 14-15 gate on human review (money); 16 builds but its live run waits on Lenus data.
- After v1.0 ships: rebase `phase-2` onto `main`, start milestone v2.0 (PRD-13-30).

---
*Roadmap created: 2026-06-18 · revised 2026-06-18 (owner reorder: API forward, money + migration last) · milestone v1.0*
