# Roadmap: Thick & Fit, Milestone v1.0 (Phase 1 / MVP)

**Branch:** `main`. **16 phases.** Build order tuned for an autonomous loop: foundation, then API, then the full platform, then money, then migration last.

> Each GSD phase maps to one PRD. Full spec per phase lives in `Build/02-prds/<PRD>.md` (plan-phase reads it).
> Order deviates from the kit on purpose (owner direction): API surface (PRD-47) pulled forward behind foundation; money phases (PRD-05/06) and the Lenus migration (PRD-00) pushed to the end so the loop builds the platform before hitting gated or blocked work. PRD-47 is normally a phase-3 item, pulled onto `main` for this milestone.

| # | Phase | PRD | Risk |
|---|-------|-----|------|
| 1 | Foundation | PRD-01 | high |
| 2 | API and MCP Surface | PRD-47 | medium |
| 3 | Bilingual Infrastructure | PRD-02 | high |
| 4 | Marketing Shell and Waitlist | PRD-03 | medium |
| 5 | Auth and 5-Role RBAC | PRD-04 | high |
| 6 | Multi-Form Builder | PRD-04b | high |
| 7 | Onboarding Questionnaire | PRD-04c | high |
| 8 | Subscriber Dashboard | PRD-07 | medium |
| 9 | Exercise Library | PRD-08 | medium |
| 10 | Substitution Engine | PRD-09 | high |
| 11 | Program Builder | PRD-10 | high |
| 12 | Workout Player | PRD-11 | high |
| 13 | Workout Logging and History | PRD-12 | medium |
| 14 | Stripe Connect and Billing (money gate) | PRD-05 | high |
| 15 | Pricing and Rev-Share Firewall (money gate) | PRD-06 | high |
| 16 | Lenus Migration Importer (data blocker) | PRD-00 | high |

---

### Phase 1: Foundation

**PRD:** PRD-01. **Branch:** main. **Depends on:** none. **Requirements:** FND-01, FND-02, FND-03, FND-04, FND-05.

**Goal:** Stand up the project skeleton every later phase inherits: scaffold, schema, RLS, security suite, PWA, shared infra.

**Success Criteria**:
1. Supabase migrations 0001-0007 apply cleanly; companies and profiles exist with company_id, RLS, 5-role enum, and is_legacy_client.
2. Security suite present (audit_log, session_logs, consent_captures, security_events, rate_limit_log, security headers, auth rate limiting).
3. PWA installs (manifest plus sw.js plus iOS/Android install banners); four shared UI state components render.
4. lib/supabase client/server/service, _shared/api.ts, api_keys/api_usage_log, run-ai-eval, resend-webhook wired; typecheck, lint, and the 10 blocking hooks pass.

### Phase 2: API and MCP Surface

**PRD:** PRD-47. **Branch:** main. **Depends on:** Phase 1. **Requirements:** API-01.

**Goal:** Stand up the internal REST API surface and MCP server on the foundation api infra so later phases build against a stable internal API.

**Success Criteria**:
1. Internal REST API surface live on _shared/api.ts; SHA-256 API keys plus api_usage_log enforced.
2. GET /api/v1/ping returns 200; auth and company scoping enforced on API routes.
3. MCP server scaffolded (Build Profile D: no public API Settings UI).

### Phase 3: Bilingual Infrastructure

**PRD:** PRD-02. **Branch:** main. **Depends on:** Phase 1. **Requirements:** I18N-01.

**Goal:** Independent UI versus DB-content language toggle (EN/ES), Fitia pattern.

**Success Criteria**:
1. UI language and content language switch independently and persist.
2. Translation layer covers the app shell; missing-key fallback defined.
3. DB content stores and serves both locales without duplication drift.

### Phase 4: Marketing Shell and Waitlist

**PRD:** PRD-03. **Branch:** main. **Depends on:** Phase 1. **Requirements:** MKT-01.

**Goal:** Public funnel plus pre-registration waitlist with GHL drip and the legal pillar.

**Success Criteria**:
1. Waitlist capture writes a lead and triggers the GHL drip.
2. Privacy, ToS, consent, and retention pages live (Legal Pillar 4).
3. Marketing surface follows the design doctrine (no banned patterns).

### Phase 5: Auth and 5-Role RBAC

**PRD:** PRD-04. **Branch:** main. **Depends on:** Phase 1. **Requirements:** AUTH-01, AUTH-02.

**Goal:** All sign-in providers plus the enforced role model.

**Success Criteria**:
1. Sign up and log in work for email plus password, Google, Apple, and Magic Link; session persists across refresh.
2. The five roles gate routes and actions correctly (Subscriber, Free, Coach, Assistant Coach, Operator).
3. Auth endpoints rate-limited; device fingerprint captured at signup.

### Phase 6: Multi-Form Builder

**PRD:** PRD-04b. **Branch:** main. **Depends on:** Phase 5. **Requirements:** AUTH-03.

**Goal:** Reusable form engine Stephanie controls.

**Success Criteria**:
1. Coach can build a form with multiple field types and publish it.
2. Submissions persist with company scoping and RLS.
3. The onboarding questionnaire (Phase 7) consumes this engine.

### Phase 7: Onboarding Questionnaire

**PRD:** PRD-04c. **Branch:** main. **Depends on:** Phase 6. **Requirements:** AUTH-04.

**Goal:** Editable questionnaire with a live weight-prediction chart plus plan preview.

**Success Criteria**:
1. New user completes the questionnaire; answers persist to their profile.
2. Live weight-prediction chart updates from inputs.
3. Plan preview renders before commitment.

### Phase 8: Subscriber Dashboard

**PRD:** PRD-07. **Branch:** main. **Depends on:** Phase 5, Phase 7. **Requirements:** SUB-01.

**Goal:** The logged-in client home surface.

**Success Criteria**:
1. Dashboard shows the client's plan, next workout, and key state.
2. Respects role and company scoping; renders all four UI states.
3. Billing and subscription widgets stub gracefully until Phases 14-15 land.

### Phase 9: Exercise Library

**PRD:** PRD-08. **Branch:** main. **Depends on:** Phase 1. **Requirements:** WKT-01.

**Goal:** Seeded plus filmed exercise library.

**Success Criteria**:
1. The 2,619-exercise seed imported; Stephanie's filmed demos attach to exercises.
2. Search and filter by muscle or equipment works bilingually.
3. Video playback via Mux (Cloudflare fallback).

### Phase 10: Substitution Engine

**PRD:** PRD-09. **Branch:** main. **Depends on:** Phase 9. **Requirements:** WKT-02.

**Goal:** Swap any exercise by available equipment across five contexts.

**Success Criteria**:
1. Given an exercise plus equipment context, the engine returns valid substitutes.
2. Substitutions respect muscle target and movement pattern.
3. Covers all five equipment contexts.

### Phase 11: Program Builder

**PRD:** PRD-10. **Branch:** main. **Depends on:** Phase 9, Phase 10. **Requirements:** WKT-03.

**Goal:** Coach authors multi-week structured programs.

**Success Criteria**:
1. Coach builds a multi-week program with sessions, sets, reps, rest, and notes.
2. Programs save as reusable templates and assign to clients.
3. Reuses the workout-cool pattern; company-scoped with RLS.

### Phase 12: Workout Player

**PRD:** PRD-11. **Branch:** main. **Depends on:** Phase 11. **Requirements:** WKT-04.

**Goal:** The in-workout experience.

**Success Criteria**:
1. Player runs a session with an audible timer and Wake Lock (screen stays on).
2. Progressive-overload suggestions surface from history.
3. Follow-along mode plays demo video inline.

### Phase 13: Workout Logging and History

**PRD:** PRD-12. **Branch:** main. **Depends on:** Phase 12. **Requirements:** WKT-05.

**Goal:** Capture and review training.

**Success Criteria**:
1. User logs set, rep, and weight per exercise during a session.
2. Completion plus enjoyment and effort recorded.
3. History view shows past sessions grouped by week.

### Phase 14: Stripe Connect and Billing

**PRD:** PRD-05. **Branch:** main. **Depends on:** Phase 1. **Requirements:** BILL-01. **Gate:** human plan-review before code (money).

**Goal:** Billing with anti-fraud plus the honest-billing moat.

**Success Criteria**:
1. Stripe Connect charges succeed with 3DS; signed webhooks verified.
2. Card-testing prevention plus chargeback evidence automation in place.
3. Money stored as BIGINT cents; ledger and audit on payment events.

### Phase 15: Pricing and Rev-Share Firewall

**PRD:** PRD-06. **Branch:** main. **Depends on:** Phase 5, Phase 14. **Requirements:** BILL-02. **Gate:** human plan-review before code (money).

**Goal:** Tiered pricing, cohort SKUs, and legacy firewall enforcement.

**Success Criteria**:
1. Subscription tiers plus one-time cohort SKUs purchasable.
2. is_legacy_client accounts firewalled out of rev-share (enforced, deployment-blocking).
3. Grandfathered pricing honored at checkout.

### Phase 16: Lenus Migration Importer

**PRD:** PRD-00. **Branch:** main. **Depends on:** Phase 1 plus full schema. **Requirements:** MIG-01. **Gate:** execution blocked on Lenus data loaded into Supabase (Rodney); importer is built and fixture-tested here, the live run waits.

**Goal:** Importer that brings 256 clients plus 11 datasets into the new schema with the legacy firewall.

**Success Criteria**:
1. Importer maps all 11 datasets (measurements, check-ins, workouts, habits, chat, meal plans, tags) idempotently.
2. Every imported account stamped is_legacy_client true, legacy_source lenus, lenus_profile_id; grandfathered pricing preserved.
3. Deploy blocked if any imported record misses the legacy flag.

---

## Coverage

- Phases: 16. PRDs: PRD-00-12 (incl. 04b, 04c) plus PRD-47. Requirements mapped: 22/22.
- Branch: `main` (all of milestone v1.0).
- Loop strategy: Phases 1-13 build the platform unattended; 14-15 gate on human review (money); 16 builds but its live run waits on Lenus data.
- After v1.0 ships: rebase `phase-2` onto `main`, start milestone v2.0 (PRD-13-30).

---
*Roadmap created 2026-06-18. Revised 2026-06-18 (owner reorder: API forward, money and migration last; reformatted to canonical GSD phase structure).*
