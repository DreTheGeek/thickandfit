# Thick & Fit

**Creator-led, bilingual fitness coaching app for Stephanie Pantoja's audience of women across the US and Latin America.**

Built by [Kaldr Tech](https://kaldrbusiness.com) for Thick & Fit by Steph's Blessed x LevelUp Automations.

> Live at: `www.teamthickandfit.com` (planned)
> Owner: Stephanie Pantoja — CPT, ~562K IG followers (@stephsblessedd), 256 paying clients
> Stack: Next.js 16 · Supabase · OpenRouter · Stripe Connect · Mux · Twilio · Vercel

---

## What This Is

Stephanie built a six-figure online coaching business on Lenus, a platform she does not own. Her single biggest client complaint: macro logging requires screenshotting food labels into ChatGPT because Lenus cannot handle photo-to-macro or cooked/uncooked conversion. She wants to exit 1:1 delivery, own her data and her brand, and serve her bilingual audience correctly.

Thick & Fit is the replacement. Not a rebrand of Lenus. A rethink of every category pain:

| Category Pain | This App's Answer |
|---|---|
| Nutrition friction | AI photo-to-macro, barcode (free), cooked/uncooked auto-conversion, USDA + LATAM food DB |
| Billing distrust | One-tap cancel, visible next-charge, 48h warning, prorated refunds, no dark patterns |
| Dead communities | Challenges + leaderboards + segmented broadcasts that drive daily return |
| Buggy workout players | Wake Lock (screen stays on), Web Audio timer, reliable Mux HLS, always-present substitution |
| Fake bilingual | Independent UI locale vs content locale — Fitia pattern, not a toggle over English content |
| No progression | Auto progressive overload: reads last 4 sessions + difficulty rating, recommends next set |
| Creator is a renter | Stephanie owns the brand, the data, the relationship, and the roadmap |

**One-line category:** The only creator-led, bilingual, female-focused fitness app that combines accurate no-friction nutrition, a working workout player, a living community, and honest billing.

---

## Current Build State

### Phase 1 (main) — 13 of 16 phases complete. 43 commits. 36 tables. All verified live on Supabase.

| Phase | PRD | What Was Built | Verification |
|---|---|---|---|
| 1 | PRD-01 | Multi-tenant foundation: 18 tables, 5-role RBAC, audit log, session logs, consent capture, rate limiting, API key registry (SHA-256), cron infrastructure, is_legacy_client firewall | Cross-tenant RLS isolation proven: Company A JWT sees 0 rows from Company B |
| 2 | PRD-47 | REST API (v1/ping, v1/me), MCP server (JSON-RPC, company-scoped tools), API docs (/api-docs) | Key A sees only company-a data, Key B sees only company-b data, no key 401 |
| 3 | PRD-02 | next-intl bilingual (EN/ES): independent ui_locale + content_locale, LATAM IP default, LanguageToggle | Independent locale switches proven at runtime |
| 4 | PRD-03 | Marketing/waitlist: bilingual /join landing, WaitlistForm, lead capture, idempotent upsert, Resend + GHL scaffold | 201 good email, 422 bad email, Googlebot 200 |
| 5 | PRD-04 | Auth + RBAC: email/password + OAuth + Magic Link, handle_new_user trigger, custom_access_token_hook (JWT claims: company_id + user_role), role guards | Subscriber 403 on coach route, coach 200, no auth 401 |
| 6 | PRD-04b | Form Builder: 4 tables, save/reorder/publish/assign/submit/fetch, coach builder UI, client renderer | Full lifecycle: build to reorder to publish to assign to submit to read |
| 7 | PRD-04c | Onboarding: Mifflin-St Jeor prediction engine (BMR/TDEE/macros/12-week curve), live recharts chart, /onboarding page | Math proven via API (90 to 84.6 kg at -0.45/wk) |
| 8 | PRD-07 | Subscriber dashboard: aggregates onboarding targets, 4 UI states (loading/error/first-run/content) | First-run to content data path proven |
| 9 | PRD-08 | Exercise library: 3 tables, 873 exercises seeded (free-exercise-db), bilingual labels, search/filter API, browser UI | Glutes: 22 results; glutes + barbell: 4 results |
| 10 | PRD-09 | 5-context substitution engine: save ordered chains, resolve with reason tags + graceful fallback | Coach builds chain, client resolves in correct order |
| 11 | PRD-10 | Program builder: 4 tables, nested save, template, assign to multiple clients, getAssignedPlans | Build to template to assign 2 clients to client sees plan |
| 12 | PRD-11 | Progressive overload: deterministic double-progression, OpenRouter AI explanation scaffold, workout player (Web Audio timer, Wake Lock, inline substitution) | 6/6 unit scenarios verified |
| 13 | PRD-12 | Workout logging: workout_logs + set_logs + completion_history, save/history/overload routes, /history page | Full loop: log to coach sees history to overload recommends "increase_reps" from real data |

### Phases 14-16: Planned, Gated (awaiting credentials / external inputs)

| Phase | PRD | What It Builds | Gate |
|---|---|---|---|
| 14 | PRD-05 | Stripe Connect Standard: webhooks, subscription lifecycle, 3DS, idempotency, chargeback evidence, payment audit log | Stripe Connect onboarding on Stephanie's account |
| 15 | PRD-06 | Pricing tiers + rev-share firewall: Free / $19.99 / $275 SKUs, is_legacy_client check (0 legacy clients in rev-share, ever), upgrade/downgrade flows | 8 pricing decisions from Stephanie |
| 16 | PRD-00 | Lenus migration importer: 256 clients, 11 datasets (measurements, check-ins, workout history, habits, chat, meal plans, tags), grandfathered pricing, is_legacy_client = true | Rodney loads Lenus export into Supabase |

---

## Phase 2 (phase-2 branch) — Planned

Full nutrition engine, community, progress and check-ins. PRDs 13-30.

- **Nutrition (the wedge):** AI photo-to-macro (Gemini Flash free tier, Claude Sonnet paid), barcode scanning (no paywall, direct shot at MyFitnessPal), cooked/uncooked auto-conversion, USDA + Open Food Facts + Stephanie-curated LATAM ingredients, bilingual food search ("pollo asado" resolves in either language), daily food diary, macro targets, meal plans, recipes, macro calculator
- **Community:** feed (posts/photos/reactions/comments), groups (migrating: Team Thick & Fit, HER again challenge, Lite, Body Recomp), challenges with live leaderboards and prizes, segmented coach broadcasts (by language/tier/tag with personalization tokens), direct messages (subscriber-to-coach, subscriber-to-AI-coach, subscriber-to-subscriber)
- **Progress and check-ins:** progress photos (front/back/side, side-by-side comparison), body measurements + weight charts (1m/3m/6m/1y), configurable weekly check-in forms, habits + water tracking with streaks
- **Voice clone:** ElevenLabs AI in Stephanie's voice for AI coach messages
- **LATAM payments:** dLocal / Mercado Pago for local-currency billing

---

## Phase 3 (phase-3 branch) — Planned

Full coach toolbox, AI coach, digital products, follow-along mode, gamification, native app. PRDs 31-47.

- **AI Coach (PRD-31):** trained on Shakira's AI Knowledge Base questionnaire, responds in Stephanie's voice and tone, text Phase 1, ElevenLabs voice clone Phase 2, Higgsfield video clone post-launch
- **Digital products store:** one-time purchase cookbook, meal plans, 12-week programs as standalone SKUs
- **Follow-along video mode:** the video IS the timer, $2.99/mo add-on unlock
- **Gamification:** streaks, badges, milestones, achievement system
- **GHL drip + AI SMS:** GoHighLevel workflows, AI-authored text messages in Stephanie's voice, Twilio 10DLC
- **Push + email automations:** pre-renewal warnings, milestone celebrations, check-in reminders
- **Capacitor / Apple Health:** native app wrapper for iOS/Android, HealthKit integration, App Store + Play Store submission
- **Full coach toolbox:** 7-tab client profiles, analytics dashboard (engagement, financial, retention), in-app user feedback/ratings inbox, branding settings, app-experience customization
- **Affiliate program**
- **Higgsfield AI video clone**
- **Macro-friendly restaurant locator** (pending scope confirmation)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict, React 19, pnpm) |
| Styling | Tailwind v4, shadcn/ui, Framer Motion |
| Database | Supabase Postgres + PostGIS + pgvector, RLS on every table |
| Auth | Supabase Auth: email/password + Google + Apple + Magic Link |
| Realtime | Supabase Realtime |
| Edge Functions | Deno (via Supabase) |
| Payments | Stripe Connect Standard |
| AI quality tier | OpenRouter — claude-sonnet-4-6 |
| AI volume tier | OpenRouter — claude-haiku-4-5 |
| AI photo free tier | Gemini 2.5 Flash (direct) |
| Video | Mux primary, Cloudflare Stream fallback |
| Email transactional | Resend |
| Email marketing | GoHighLevel ($97/mo, Stephanie's account) |
| SMS | Twilio 10DLC |
| Monitoring | Sentry |
| Analytics | PostHog |
| Validation | Zod (all external input, no exceptions) |
| Hosting | Vercel |
| PWA | Web App Manifest + Service Worker, Wake Lock API, Web Audio API |
| Native Phase 3 | Capacitor + HealthKit |
| Lint and format | ESLint + Prettier |

---

## Architecture

### Multi-tenancy
Every table has `company_id NOT NULL` + Row Level Security. Stephanie is tenant 1 (`slug: thick-and-fit`). The architecture supports white-labeling from day one: a second coach brand is a second company row, no code changes needed.

### Security model
- 5-role RBAC: Subscriber, Free, Coach, Assistant Coach, Operator
- JWT claims injected via `custom_access_token_hook` Postgres function: `company_id` + `user_role` on every token
- `is_legacy_client` firewall: all 256 Lenus migrants marked permanently — they never enter rev-share computation, no expiry, no override
- SHA-256 hashed API keys, constant-time compare, per-key rate limiting
- Audit log on all destructive actions with timestamp + actor
- Session logs, consent captures, security event log
- 10 blocking git hooks enforce: BIGINT cents for money, company_id on every table, RLS enabled, no hardcoded secrets, no demo data in migrations, "use client" on interactive components
- All views: `security_invoker = true` (views bypass RLS by default without this)
- `getUser()` on server-side auth checks, not `getSession()` (which trusts client JWT only)
- Service role key is server-side only — never in a `NEXT_PUBLIC_` variable

### Money rule
All monetary values are `BIGINT` cents with a `_cents` suffix: `price_cents`, `revenue_cents`, `cost_cents`. No `NUMERIC`, `DECIMAL`, or `FLOAT` on money columns. Enforced by a blocking pre-write hook that exits 2 on violation.

### Bilingual
Independent `ui_locale` (interface language) and `content_locale` (which DB language is queried). Both are cookie-driven and user-overridable at any time. LATAM IPs default to ES via `x-vercel-ip-country` in middleware. This is the Fitia pattern: a user can read the app in English while seeing content authored in Spanish, or vice versa.

### Progressive overload engine
Deterministic, never AI-invented. Standard double-progression: no history holds, top of rep range easy increases weight, bottom of range easy increases reps, failed sets trigger deload, 2 hard sets hold. The AI explanation layer (OpenRouter, lazy-loaded) narrates the recommendation but never changes the number. Scientifically grounded (Mifflin-St Jeor BMR, 7700 kcal/kg energy balance). Unit-tested 6/6 scenarios.

### API and MCP
REST API at `/api/v1/`. MCP server at `/api/mcp` (JSON-RPC 2.0). All tools and data are company-scoped: a key issued to company A cannot read company B's data, enforced at the query level by RLS.

### PWA
Full offline-capable PWA: Web App Manifest, Service Worker, Wake Lock (screen stays on during workouts), Web Audio API (audible timer via generated tones, no file dependency), iOS install banner, Android install prompt. Installable from the browser on both platforms today. Capacitor wraps it for App Store submission in Phase 3.

---

## Local Setup

**Prerequisites:** Node 20+, pnpm, a Supabase project

```bash
git clone https://github.com/DreTheGeek/thickandfit.git
cd thickandfit
pnpm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm dev
```

Apply migrations in order (`supabase/migrations/0001_foundation.sql` through `0010_workout_logging.sql`) via Supabase CLI or the Management API.

Start at `/join` (waitlist), `/auth/sign-up` (register), `/onboarding` (questionnaire), `/dashboard`.

---

## Deploy

Hosted on Vercel. Push to `main` deploys to production. All environment variables live in the Vercel dashboard, never committed.

Post-deploy checklist (full detail in `CLAUDE.md`):
1. Supabase: apply migrations, enable `custom_access_token_hook` in Auth config
2. Stripe: connect Stephanie's account, create products/prices, register webhook, enable 3DS
3. Resend: verify sending domain, add SPF/DKIM/DMARC records
4. GoHighLevel: connect account, wire pre-launch waitlist drip
5. Mux: create environment, upload exercise demo videos
6. Twilio: 10DLC registration
7. OpenRouter: API key for AI overload explanations
8. Sentry + PostHog: project keys
9. GSC + Bing: domain verification, sitemap, IndexNow

---

## Design Doctrine

**Aesthetic:** Editorial minimalist with attitude. Premium and bold, not generic SaaS.

**Palette:** Pure black `#000000` + olive `#5EBE62`. No gradients.

**Typography:** Anton (display headlines), Bebas Neue (H2), Oswald (H3), Inter (body).

**Components:** Zero-border white cards, whitespace as separator. Black fill buttons, white text, 0 border radius. Olive for active states.

**Banned patterns:** Centered gradient hero. Three-column icon grid. Floating device mockups. Gradient blobs. The phrases "unlock your potential," "seamless," "empower," "game-changing."

**The rule:** Same map as Lenus (clients know the IA), completely different car. Migrated clients find the same positions. The beige is gone.

---

## Pricing (pending final decisions from Stephanie)

| Tier | Price | Key Features |
|---|---|---|
| Free | 7-day trial, then limited | Workout library browse, basic nutrition |
| Low-ticket | $19.99/mo | Full workouts + progressive overload, full nutrition + barcode, community, AI photo-to-macro (5/day), AI coach text |
| Follow-along add-on | +$2.99/mo | Video-as-timer mode (Phase 3) |
| Mid-ticket coaching | $275/mo (3 or 6-mo commit) | Everything + PT assistant + Stephanie last-eyes, unlimited AI photo-to-macro, custom meal plans |
| Legacy / migrated | $129-$369/mo individual | Grandfathered. is_legacy_client = true. Never in rev-share. |
| Challenge SKUs | One-time | Cohort enrollments (e.g. 6-week Body Recomp) |

Current authoritative MRR from 256 Lenus clients: **$16,798.99/mo**

---

## Open Blockers

None of these block Phases 1-13, which are complete.

| Blocker | Owner | Unblocks |
|---|---|---|
| Lenus data loaded into Supabase | Rodney | PRD-00 / Phase 16 |
| Stripe Connect onboarding | Stephanie | PRD-05 / Phase 14 |
| 8 pricing decisions | Stephanie | PRD-06 / Phase 15 |
| Shakira AI Knowledge Base questionnaire | Shakira | PRD-31 / AI Coach |
| 80-100 exercise videos (40+ by 7/22/2026) | Stephanie | Mux demo playback |
| Billing cutover plan for 61 renewing clients | Rodney + Stephanie | PRD-05 migration billing |

---

## Partners

| Company | Role |
|---|---|
| Thick & Fit by Steph's Blessed | Brand owner, content, Stephanie Pantoja |
| LevelUp Automations | Scope owner, client relationship, Rodney Williams + Shakira Canty |
| Kaldr Tech | Engineering, LaSean Pickens (DreTheGeek) |

---

## Timeline

| Milestone | Target |
|---|---|
| Phases 1-13 complete | June 18, 2026 (done) |
| Internal handoff (Phase 1 + Phase 2 core) | ~July 22, 2026 |
| Private beta + client migration window | July 22 - September 2026 |
| Public marketing launch | September 2026 |

---

## License

Private. All rights reserved. Thick & Fit by Steph's Blessed. Not open source.
