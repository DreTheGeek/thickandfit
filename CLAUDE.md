@AGENTS.md

# Thick & Fit, Project Handoff & Claude Code Guide

## What This Is
Thick & Fit is a creator-led, bilingual (EN/ES) fitness coaching app for Stephanie Pantoja's
audience of women across the US and Latin America. Structured workouts with her filmed demos,
the most accurate low-friction nutrition tracking in the category, a living community, and an AI
coach in her voice. One-line category: creator-led bilingual fitness coaching app.

**Live at:** app.teamthickandfit.com (planned)
**Repo:** github.com/DreTheGeek/thickandfit (private)
**Owner:** Stephanie Pantoja (Thick & Fit by Steph's Blessed)
**Build partners:** LevelUp Automations (scope) + Kaldr Tech (engineering)

---

## The Vision (Why This Exists)
Stephanie built six figures on Lenus, a platform she does not own and that was never built for
her bilingual audience. Her #1 pain is nutrition: clients screenshot food labels into ChatGPT
because Lenus cannot do photo-to-macro or cooked/uncooked conversion. This app is her brain,
automated and owned. The win is converting her existing trust (562K followers, 256 paying
clients) into a retained subscriber base by fixing what every competitor gets wrong: nutrition
friction, billing distrust, dead communities, buggy players.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript strict, pnpm) |
| Styling | Tailwind v4 + shadcn/ui + Framer Motion |
| Database | Supabase Postgres + PostGIS + pgvector, RLS on every table |
| Auth | Supabase Auth (email/password + Google + Apple + Magic Link) |
| Realtime | Supabase Realtime |
| Payments | Stripe Connect Standard |
| AI | OpenRouter (claude-sonnet-4-6 quality, claude-haiku-4-5 volume, Gemini 2.5 Flash free photo) |
| Video | Mux primary, Cloudflare Stream fallback |
| Email | Resend (transactional) |
| Marketing | GoHighLevel (Stephanie subscribes) |
| SMS | Twilio 10DLC |
| Hosting | Vercel |
| Monitoring | Sentry |
| Analytics | PostHog |
| Lint/Format | ESLint + Prettier (NOT Biome) |

---

## Architecture Overview
Tenancy: company (Stephanie is tenant 1, architecture supports white-label later) -> profile
(5 roles) -> data. company_id NOT NULL + RLS on every table. Money in BIGINT cents with _cents
suffix. Build Profile D (Consumer App): API internal-only, no API Settings UI, MCP in PRD-47.

**Key patterns:**
- createClient() browser, createServerClient() server, createServiceClient() webhooks/admin
- Lazy Proxy pattern for Stripe/Resend/OpenRouter clients (no build-time crash without env vars)
- Fire-and-forget side effects: void notify(), void logAuditAction()
- 5-role RBAC: Subscriber, Free, Coach, Assistant Coach, Operator
- Design: pure black #000 + olive #5EBE62, Anton/Bebas Neue/Oswald/Inter, zero-border cards

---

## Branch Map (CRITICAL, read before any work)
- `main` = Phase 1 (PRD-00 through PRD-12). This is production.
- `phase-2` = Phase 2 (PRD-13 through PRD-30). Do not merge to main until Phase 1 ships.
- `phase-3` = Phase 3 (PRD-31 through PRD-47). Do not merge until Phase 2 ships.

Before writing any code:
1. Read the PRD header `Branch:` field.
2. `git branch` to confirm you are on the correct branch.
3. If the PRD targets phase-2/phase-3: `git checkout main && git pull`, then
   `git checkout <phase> && git rebase main` (or rebase onto the prior phase) BEFORE building.
4. Never push Phase 2/3 code to main until that phase is ready to ship.

---

## What's Built
| Feature Area | Status | Key Files |
|-------------|--------|-----------|
| (empty at PRD-01, grows per PRD) | | |

---

## Conventions (enforced by ESLint + Prettier + hooks)
- Files kebab-case. Components PascalCase from kebab-case file. Functions/vars camelCase.
- DB snake_case. Booleans verb-prefixed (is_, has_, was_). FKs <table>_id. Money bigint _cents.
- Timestamps created_at/updated_at/deleted_at. Env vars SCREAMING_SNAKE_CASE, public NEXT_PUBLIC_.
- Prettier: single quotes, semicolons, trailing commas, 100-char lines, import type for types.

## Hooks (blocking, .claude/hooks/)
check-money-type, check-tenant-column, check-rls-enabled, check-no-bcrypt-keys, check-no-secrets,
check-no-demo-data (PreToolUse); check-rls-enabled, check-use-client, check-ledger-write,
typecheck, lint (PostToolUse). Exit 2 blocks the write. Never disable a hook to get past it.

---

## Gap Log
1. Magic Link auth: deviation from the email+Google+Apple baseline. Logged, intentional.
2. Apple Health / Watch sync: requires native app (HealthKit), deferred to Phase 3 Capacitor.
   Phase 1 player uses pure web APIs (audible timer + Wake Lock).
3. MCP server + public API surface: deferred to PRD-47 (Build Profile D).
4. LATAM local-currency payments: Phase 3 (PRD-46). Stripe handles international cards day one.
5. AI Coach (PRD-31): blocked until Shakira delivers the AI Knowledge Base questionnaire.
6. Pricing values ($19.99 low, $275 mid, $2.99 add-on): assumptions pending Stephanie. Isolated
   to PRD-05/06/28. Foundation does not depend on them.
7. Macro-friendly restaurant locator: out of scope pending Rodney scope confirmation.

---

## Manual / Post-Deploy Steps
1. Supabase: project cpwesaeyhklmjbqppeah. Apply migrations. Set auth hooks. Store service role
   key as Postgres GUC for pg_cron (app.service_role_key).
2. Stripe: connect Stephanie's account. Create products/prices. Webhook /functions/v1/stripe-webhook
   + signing secret. Enable 3DS.
3. Resend: verify sending domain. Add SPF (v=spf1 include:_spf.resend.com ~all), DKIM CNAME,
   DMARC (p=quarantine). Webhook /functions/v1/resend-webhook + RESEND_WEBHOOK_SECRET.
4. GoHighLevel: connect Stephanie's $97/mo account. Wire pre-launch waitlist drip.
5. Twilio: 10DLC registration (apply early August). Status callback signed.
6. Mux: create environment, playback + signing keys. Cloudflare Stream as fallback.
7. OpenRouter: API key. Gemini API key for free photo tier.
8. Sentry: project + DSN. PostHog: project key.
9. GSC + Bing: verify domain, submit sitemap, enable IndexNow.
10. Apify: token for recipe Reel scraper (PRD-19).

## Deploy Verification (after every deploy)
1. vercel ls --prod -> status READY
2. commit hash matches
3. GET /api/v1/ping -> 200
4. Sentry: no new error spike in 5 min
5. If migration shipped: supabase db diff -> 0 output, regenerate types, commit

## Secret Rotation Log
| Secret | Rotated | By | Notes |
|---|---|---|---|
| (none yet) | | | 90-day cycle for keys |

## Tier Caps (check monthly)
Supabase edge invocations, Vercel function compute, Mux streaming minutes, OpenRouter spend,
Gemini free-tier limits. Document limits and deferral decisions here as they approach.

## pg_cron Test Procedure
Each cron in the CRON-REGISTRY: run manually, check cron_job_log for a success row. All crons use
GUC-stored service key + --no-verify-jwt on hosted Supabase.

---

## Read Order for New Engineers
1. This file
2. .planning/STATE.md
3. 00-research/COMPETITIVE-INTELLIGENCE.md + DOMAIN-RESEARCH.md
4. 01-foundation-docs/ (Discovery, Blueprint, Series Outline, Wiring Map)
5. Relevant PRD per feature
