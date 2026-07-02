# FitnessOS Architecture v1

> Codebase-grounded engineering decisions doc. The governing discipline is one of three verdicts:
> **ADOPT-NOW** (cheap today, brutal to retrofit) / **DESIGN-NOW** (define the seam, build the
> behavior later) / **BUILD-LATER** (do not touch until a real reason lands). We ship the individual
> coach-member loop perfectly first; every deferred thing gets a seam, never a stub-that-rots.

## 1. North Star

FitnessOS is a multi-tenant, creator-led coaching platform whose moat is the most accurate
low-friction nutrition capture in the category (photo-to-macro, text-to-macro, barcode,
cooked/uncooked yield) wrapped in a coach's own voice via RAG. Stephanie (Thick & Fit) is tenant 1;
the architecture is multi-tenant from day one so creator 2 is a provisioning event, not a rewrite.

## 2. What Already Exists (the honest head-start)

This is not a greenfield bet. The following is live and proven:

- **Multi-tenant RLS**: 45+ tables, all `company_id NOT NULL`, RLS on every one via
  `current_company_id()`, enforced by the `check-tenant-column` pre-commit hook. RLS isolation test
  passes. 5-role RBAC (subscriber/free/coach/assistant_coach/operator) injected into the JWT by
  `custom_access_token_hook`.
- **Embeddings + RAG**: `embeddings.ts` (text-embedding-3-small, 1536-dim, OpenRouter, graceful null
  when unkeyed). Two live RAG layers: `coach_knowledge` (company-scoped voice/method via
  `match_coach_knowledge` RPC) and `coach_messages` (member-scoped memory, HNSW indexed).
- **Scan pipeline**: `smart-scan.ts` (meal/product classification + Gemini vision + portion-grams +
  USDA grounding, 90s timeout), `text-parse.ts`, barcode lookup, all grounding into the `foods`
  per-100g authority table with `density_g_per_ml`, `confidence`, and provenance.
- **AI plumbing**: centralized router in `src/lib/ai/models.ts`, `ai_usage_log` metering table, and
  fully-defined but 0%-used eval tables (`ai_evals`, `ai_eval_cases`, `ai_eval_runs`).
- **Billing**: Stripe Connect Standard live, webhook verified, entitlement guard (`requireEntitled`).

59 migrations (0001-0059). The gaps below are seams, not foundations.

## 3. The Engines

| Engine | Owns | Real vs Stub | API it should expose |
|---|---|---|---|
| **Nutrition** (`src/lib/nutrition/`) | photo/text/barcode capture, diary, macros | Real | `logMeal({source,items,mealSlot,date})`, `getDiaryDay(date)`, `searchFoods(q)` facade over `food_log`/`foods`/`food_portions` |
| **Workout** (`src/lib/workout/`) | per-set logging, Epley e1RM, progressive overload | Real (overload split into `src/lib/overload/`) | `WorkoutEngine.getNextSetHint(exerciseId,targetReps)`, `getExerciseHistory()` (collapse 2-3 queries) |
| **Coach/CRM** (`src/lib/coach/`) | contact CRUD, tags/segments, standing, assignments | Real (30+ files, no unified read) | `coach.getClientProfile(id)` over a `CoachClient` identity wrapper |
| **Coach-AI** (`src/lib/coach-ai/`) | chat (Haiku), nightly insights, knowledge ingest/RAG, plan-gen (gpt-5), physique | Real | `streamChat()`, `ingestKnowledge()`, `retrieveKnowledge()` via a pluggable `CoachContextBuilder` |
| **Body** (`src/lib/body/`) | weight trend, measurements, 4-week rollup | Real (computed on-read, O(n)) | `BodyStatsEngine.getTrendSummary(userId,days)` (nightly cron later) |
| **Habits** (`src/lib/habits/`) | coach-assigned daily habits, per-day toggle | Real but thin | batch complete + `habit_stats` (streak/consistency) schema |
| **Billing** (`src/lib/billing/`) | Stripe lifecycle, payments, `ai_usage_log` | Real (read-only, no quota enforcement) | `QuotaEngine.checkUsageAllowed(userId,feature,qty)` |
| **Progress** (implicit, no lib) | dashboard rollups, checkins | Stub (bespoke per-route queries) | `ProgressEngine.getMemberWeekSummary(userId)` (Phase 3, depends on all above) |

The cross-cutting rule: **engines expose methods, not table names.** Mobile and future API agents
must never learn `food_log` or `contact_id`.

## 4. Canonical Data Model + Events

**The meal entity is the canonical shape and it is production-proven.** `foods` (per-100g authority:
source, source_id, source_url, bilingual names, `density_g_per_ml`, `confidence` on `ai_estimate`
rows, 1536-dim embedding). `food_log` (the denormalized diary: macros snapshotted so day totals
never re-derive, explicit user-local `log_date`, source enum). `food_portions` (household measures)
and `cooked_uncooked_ratios` (USDA yield, never AI-guessed).

Adopt-now additive columns (all effort-S, zero migration risk):
- `foods`: add `source_version`, `ai_model` (which model produced an `ai_estimate` row).
- `food_log`: add `confidence_score` (snapshot `foods.confidence` at write),
  `corrected_at`/`corrected_by`/`correction_reason`, and a `meal_plan_item_id` backref for
  adherence tracking.
- `weight_entries` / `body_measurements`: add `corrected_at`, `prior_value` (JSONB),
  `correction_reason`. Keep `recipe_ingredients` denormalized (per-recipe confidence is the signal).

**The lightweight event table (design-now, do NOT emit yet):** one append-only `domain_events` table
is the seam future engines tap without retrofitting the core:

```
domain_events(id, company_id, aggregate_id, aggregate_type, event_type,
  event_version, payload jsonb, correlation_id, idempotency_key UNIQUE,
  source, device_type, locale, timezone_offset_minutes, profile_id, created_at)
```

Indexes on `company_id`, `aggregate_type`, `created_at`, unique `idempotency_key`. Service-role
writes only. Ship the schema; write zero events in Phase 1-2. Full event-sourcing / CQRS / replay is
a one-way door we explicitly do NOT open now (Phase 4+, and only for a real reason).

## 5. The AI Spine

Three pillars: a router, one provenance table, an eval harness.

**Router bug (fix now):** `smart-scan.ts` hardcodes `const MODEL = 'google/gemini-2.5-flash'` instead
of importing `AI_MODELS`. gpt-5 was tried and rejected (~40s latency) but that decision is buried in a
comment, not in config. This violates single-source-of-truth and blocks the eval harness from
swapping models. Fix: add a `smartScan` task to `AI_MODELS`, import it, delete the const. The decision
matrix belongs in `models.ts`: photo/physique/plan-gen = flagship quality (moat, low frequency);
text/insights = cost tier (Gemini Flash); chat = persona (Haiku 4.5). Embeddings and chunking
(500-token / 50-overlap) are **locked** at 1536 dims: changing them means re-embedding the corpus.

**The ONE provenance table:** keep `ai_usage_log` as pure metering (feature/model/tokens/cost). Add a
separate `ai_inferences` table for replay and gold-dataset curation (`input_hash`, `raw_output` jsonb,
`confidence`, `latency_ms`, `user_marked_correct`, `correction`). Today only 2 of 7 inferences log
anything; a `logInference()` utility must be wired into photo, smartScan, text-parse, chat, physique
so every inference is visible. Do not consolidate the two tables: metering and audit have different
lifecycles.

**Eval harness:** the tables (`ai_evals`, `ai_eval_cases`, `ai_eval_runs`) exist and are 0% used.
Build the minimal runner against the moat first: 10-20 labeled photos, score portion MAPE + food-ID
accuracy across gpt-5 vs gemini-2.5-flash, store in `ai_eval_runs`. This is the benchmark that finally
answers "is Gemini fast enough or do we tier up to gpt-5 for photos."

## 6. Platform / White-Label

What makes tenant 2 possible today: the full multi-tenant RLS spine is done. What blocks it:

- **Hardcoded slug**: signup and every internal cron hardcode `slug='thick-and-fit'`. Fix
  (adopt-now, S): loop `SELECT * FROM companies` instead. Free at 2 tenants; job queue only past ~10.
- **No provisioning path**: add `POST /api/internal/companies` (CRON_SECRET guarded) that creates the
  company row + seeds shared system data. Ship `invite-coach` first.
- **No `company_config`** (design-now): branding (logo, colors, custom_domain), feature flags, and
  per-tenant keys (`stripe_account_id`, encrypted `openrouter_api_key`) all hardcoded. Define the
  table + types, refactor metadata to query at request time, stub the admin UI.
- **Domain routing** (design-now): middleware to resolve subdomain/path -> `company_id` -> JWT claim.
- **Observability**: add `company_id` to `cron_job_log` and `rate_limit_log`; keep
  `session_logs`/`security_events` global.

The full branding engine, multi-coach team access, and per-tenant Stripe topology are build-later.
Ship Stephanie first; white-label is a revenue line, not a retention risk.

## 7. Phased Roadmap

- **Phase 1 (done, `main`):** PRD-01-12 stabilized. Multi-tenant RLS, foods corpus, Stripe Connect,
  entitlement guard.
- **Phase 2 (in-flight, `phase-2`):** 9 committed features. **Milestones:** fix smart-scan router
  bug; ship Nutrition/Workout/Body engine facades; land all adopt-now snapshot columns + backfill;
  ship `domain_events` and `ai_inferences` schemas (no emission); wire `logInference()` across all 7
  tasks; cron loop-over-companies.
- **Phase 3:** intelligent retrieval (embeddings on `food_log` for meal-history prediction),
  text-parse LLM fallback, `ProgressEngine` consolidation, coach-review workflow for flagged physique
  analyses, `company_config` + domain routing built out, quota enforcement live, `habit_stats`
  backfill.
- **Phase 4:** event emission turned on; coherence graph (nodes/edges over coach_knowledge +
  coach_messages + food_log + body). Only after RAG is validated in production.
- **Phase 5+:** white-label branding engine, multi-coach teams, per-tenant Stripe, federated model
  and digital-twin prediction (needs real outcome data that only exists by then).

## 8. The Decision Table (the artifact)

| Decision | Verdict | Effort | Touches |
|---|---|---|---|
| Fix `smart-scan.ts` model routing (import `AI_MODELS`) | ADOPT-NOW | S | `ai/models.ts`, `nutrition/smart-scan.ts` |
| Nutrition Engine SDK facade (`logMeal`/`getDiaryDay`) | ADOPT-NOW | M | `nutrition/nutrition-engine.ts`, `api/nutrition/*` |
| Workout Engine `getNextSetHint()` facade | ADOPT-NOW | S | `workout/engine.ts`, `workout/logging.ts` |
| Body stats read-only snapshot service | ADOPT-NOW | S | `body/engine.ts`, `body/stats.ts` |
| `foods.source_version` + `ai_model` columns | ADOPT-NOW | S | migration `foods` |
| `food_log` confidence + correction + plan backref | ADOPT-NOW | S | migration, `nutrition/diary-actions.ts` |
| `weight_entries`/`body_measurements` audit columns | ADOPT-NOW | S | migration, `weight-actions.ts` |
| `meal_plans.source` (coach/ai/imported) | ADOPT-NOW | S | migration, `coach-ai/plan-gen.ts` |
| AI provider dependency-injection interface | ADOPT-NOW | S | `ai/provider.ts` + call sites |
| Extend `ai_usage_log` provenance + `logInference()` all 7 tasks | ADOPT-NOW | M | migration, `ai/logger.ts`, 6 call sites |
| Cron loop-over-companies (kill hardcoded slug) | ADOPT-NOW | S | 7 internal cron routes |
| Tenant provisioning / invite-coach endpoint | ADOPT-NOW | S | `api/internal/companies` |
| Lock 1536-dim embeddings + 500/50 chunking | ADOPT-NOW | S | doc in `ARCHITECTURE.md` |
| `CoachClient` identity wrapper (profile_id/contact_id) | DESIGN-NOW | M | `coach/coach-client.ts` |
| Pluggable `CoachContextBuilder` interface | DESIGN-NOW | M | `coach-ai/context-builder.ts` |
| `domain_events` table (schema only, no emission) | DESIGN-NOW | S | migration, `types/domain.ts` |
| `ai_inferences` table (audit + gold dataset) | DESIGN-NOW | M | migration |
| `meal_plan_items` junction (adherence) | DESIGN-NOW | M | migration (stub) |
| `QuotaEngine.checkUsageAllowed()` | DESIGN-NOW | M | `billing/quota.ts` |
| `habit_stats` table (streak/consistency) | DESIGN-NOW | S | migration (no backfill) |
| `company_config` (branding, flags, per-tenant keys) | DESIGN-NOW | M-L | migration, `layout.tsx`, middleware |
| Domain routing middleware | DESIGN-NOW | M | `src/middleware.ts` |
| Event bus interface (noop impl) | DESIGN-NOW | S | `events/bus.ts` |
| `food_log` embeddings (Phase 3 retrieval seam) | DESIGN-NOW | M | migration (stub) |
| `physique_analyses` review fields + `food_photos.is_shared` | DESIGN-NOW | M | migrations (stub) |
| Eval harness for photo-to-macro (gpt-5 vs gemini) | DESIGN-NOW | L | `ai/eval-runner.ts`, fixtures |
| Progress Engine consolidation | BUILD-LATER | M | `progress/engine.ts` (Ph3) |
| Multi-coach teams / role matrix | BUILD-LATER | L | `coach_teams.sql`, `coach/access.ts` |
| Full event-sourcing / CQRS / replay | BUILD-LATER | XL | (do not open the door) |
| Coherence graph (nodes/edges) | BUILD-LATER | XL | Ph4 |
| Federated model + digital-twin prediction | BUILD-LATER | XL | Ph5+ |
| Backfill `food_log.confidence_score` historical rows | BUILD-LATER | M | `scripts/backfill-food-log.ts` |

## 9. Open Questions for the Founder

1. **Mobile:** is a mobile app scoped, and does it call REST or RPC? Decides whether engine facades
   wrap Supabase directly or stay transport-agnostic.
2. **Progress owner:** is the week-summary rollup coach-first (client overview) or subscriber-first
   (my week)? One engine or two?
3. **Plan generation:** is `plan-gen.ts` actually used, or is Stephanie hand-building every plan? If
   unused, plan-gen defers cleanly.
4. **Knowledge governance:** does `coach_knowledge` ingestion need versioning + approval (coach
   writes, Stephanie approves), or fire-and-forget?
5. **Food corpus on resale:** does creator 2 get their own food DB (RLS-scoped corpus) or share
   Stephanie's?
6. **Insights schema:** should the nightly `user_insights` JSONB extraction be Zod-validated before
   write, or stay flexible for experimentation?
7. **Deploy topology:** single Vercel project with domain routing, or separate projects per tenant?
   And Stripe: Connect custodian accounts vs separate merchant accounts?
8. **User corrections:** is there a UI for correcting a logged meal ("200g not 150g")? If not, that
   feedback loop into `ai_inferences.correction` is a Phase 2 gap. **(Being built now, Bucket 1.)**
