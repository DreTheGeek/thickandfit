# Requirements: Thick & Fit — Milestone v1.0 (Phase 1 / MVP)

**Defined:** 2026-06-18
**Core Value:** Accurate low-friction bilingual nutrition tracking must work; convert Stephanie's
trust into a retained subscriber base.

> Scope = Kaldr Phase 1 (PRD-00 through PRD-12, `main` branch). The authoritative, full-depth spec
> for each requirement is its PRD in `Build/02-prds/` plus the living spec in
> `Build/03-planning-scaffold/.planning/spec/`. Requirements below are the milestone-scoped index
> GSD phases are derived from; they are not a substitute for the PRDs.

## v1 Requirements

### Foundation (PRD-01)

- [ ] **FND-01**: Platform scaffold + Supabase migrations 0001-0007 (companies, profiles, 5-role RBAC, security suite, api_keys/api_usage_log, ai_evals, email_suppression/send_log)
- [ ] **FND-02**: Fort Knox security baseline (RLS on every table, audit_log, session_logs, consent, security headers, auth rate limiting)
- [ ] **FND-03**: PWA shell (manifest.json, sw.js, iOS/Android install banners, offline via Dexie/serwist)
- [ ] **FND-04**: Shared infra (lib/supabase client/server/service, 4 UI state components, run-ai-eval, resend-webhook, _shared/api.ts)
- [ ] **FND-05**: `is_legacy_client` firewall column + enforcement scaffolding (deployment-blocking gate)

### Migration (PRD-00)

- [ ] **MIG-01**: Lenus importer brings in 256 clients + 11 datasets (measurements, check-ins, workout history, habits, chat, meal plans, tags), stamps `is_legacy_client`/`legacy_source`/`lenus_profile_id`, preserves grandfathered per-client pricing; deploy blocked if any record misses the flag

### Bilingual (PRD-02)

- [ ] **I18N-01**: Independent UI/DB language toggle (EN/ES, Fitia pattern) usable app-wide

### Marketing (PRD-03)

- [ ] **MKT-01**: Marketing shell + pre-registration waitlist (GHL drip wired, legal/privacy/ToS/consent pillar)

### Auth & Onboarding (PRD-04, 04b, 04c)

- [ ] **AUTH-01**: User can sign up / log in with email+password, Google, Apple, or Magic Link; session persists
- [ ] **AUTH-02**: 5-role RBAC enforced (Subscriber, Free, Coach, Assistant Coach, Operator)
- [ ] **AUTH-03**: Multi-form builder engine (Stephanie builds her own forms beyond onboarding)
- [ ] **AUTH-04**: Onboarding questionnaire with live weight-prediction chart + plan preview

### Billing (PRD-05, 06)

- [ ] **BILL-01**: Stripe Connect honest billing engine (3DS, card-testing prevention, chargeback automation, signed webhooks)
- [ ] **BILL-02**: Pricing tiers + cohort SKUs + rev-share firewall (legacy clients never enter rev-share)

### Subscriber (PRD-07)

- [ ] **SUB-01**: Subscriber dashboard (home surface for a logged-in client)

### Workout System (PRD-08-12)

- [ ] **WKT-01**: Exercise library (2,619 seed + Stephanie's filmed demos), searchable/filterable
- [ ] **WKT-02**: 5-context equipment substitution engine (swap exercises by available equipment)
- [ ] **WKT-03**: Program builder (coach-side multi-week structured programs)
- [ ] **WKT-04**: Workout player (audible timer, Wake Lock, progressive overload, follow-along mode)
- [ ] **WKT-05**: Workout logging + history (set/rep/weight capture, completion history)

## Future Milestones (not this milestone)

- **v2.0 — Phase 2** (PRD-13-30, `phase-2`): macro calculator, food DB, food logging, cooked/uncooked, photo-to-macro, meal plan builder, recipe engine, recipe books, nutrition dashboard, habits/water, check-ins, progress photos, measurements, community feed, DMs, leaderboards, broadcasts, mid-ticket workflow
- **v3.0 — Phase 3** (PRD-31-47, `phase-3`): AI coach + voice clone, coach toolbox, GHL drip, digital store, premium add-on, affiliate store, gamification, push/email, coach analytics, branding, SEO/visibility, Capacitor + Apple Health, follow-along/Higgsfield, LATAM payments, MCP/API

## Out of Scope

| Feature | Reason |
|---------|--------|
| Physical merchandise (waist trainers, bands) | Future vision, not this build |
| Content licensing to other coaches | Long-term, not this build |
| Macro-friendly restaurant locator | Pending Rodney scope confirmation; Phase 3+ if real |
| Full white-label multi-coach platform | Architecture supports it; not built now |
| Public API Settings UI | Build Profile D — API internal-only; MCP is PRD-47 |

## Traceability

| Requirement | Phase | PRD | Status |
|-------------|-------|-----|--------|
| FND-01..05 | Phase 1 | PRD-01 | Pending |
| MIG-01 | Phase 2 | PRD-00 | Pending (data blocker) |
| I18N-01 | Phase 3 | PRD-02 | Pending |
| MKT-01 | Phase 4 | PRD-03 | Pending |
| AUTH-01, AUTH-02 | Phase 5 | PRD-04 | Pending |
| AUTH-03 | Phase 6 | PRD-04b | Pending |
| AUTH-04 | Phase 7 | PRD-04c | Pending |
| BILL-01 | Phase 8 | PRD-05 | Pending |
| BILL-02 | Phase 9 | PRD-06 | Pending |
| SUB-01 | Phase 10 | PRD-07 | Pending |
| WKT-01 | Phase 11 | PRD-08 | Pending |
| WKT-02 | Phase 12 | PRD-09 | Pending |
| WKT-03 | Phase 13 | PRD-10 | Pending |
| WKT-04 | Phase 14 | PRD-11 | Pending |
| WKT-05 | Phase 15 | PRD-12 | Pending |

**Coverage:**
- v1 requirements: 21 total (across 15 phases / 15 PRDs)
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-18*
*Last updated: 2026-06-18 after milestone v1.0 initialization*
