# Thick & Fit

## What This Is

Thick & Fit is a creator-led, bilingual (EN/ES) fitness coaching app for Stephanie Pantoja's
audience of women across the US and Latin America. It replaces Lenus with an owned platform:
structured workouts with her filmed demos, the most accurate low-friction nutrition tracking in
the category, a living community, and an AI coach in her voice. One-line category: creator-led
bilingual fitness coaching app. Web app at www.teamthickandfit.com (planned).

## Core Value

Convert Stephanie's existing trust (562K followers, 256 paying clients) into a retained subscriber
base by fixing what every competitor gets wrong, with nutrition friction (photo-to-macro,
cooked/uncooked) as the #1 must-work feature. If everything else fails, accurate low-friction
nutrition tracking in the user's language must work.

## Requirements

### Validated

<!-- Shipped and confirmed. -->

- ✓ Webflow marketing site lifted to Next.js 16 (single-page, pixel-parity) — v0.1 (starting commit)

### Active

<!-- Current milestone: v1.0 Phase 1 (MVP, PRD-00 through PRD-12 on main). -->

- [ ] **PRD-01** Foundation: scaffold, Supabase migrations 0001-0007, 5-role RBAC, RLS, security suite, PWA, shared state/AI-eval/email tables, hooks + ledger
- [ ] **PRD-47** API / MCP Surface: internal REST API + MCP server on PRD-01 api infra (pulled forward from Phase 3 onto `main`)
- [ ] **PRD-02** Bilingual Infrastructure: independent UI/DB language toggle (Fitia pattern)
- [ ] **PRD-03** Marketing Shell + Pre-Registration Waitlist (GHL drip, legal pillar)
- [ ] **PRD-04** Auth Flows + 5-Role RBAC (email/password + Google + Apple + Magic Link)
- [ ] **PRD-04b** Multi-Form Builder Engine
- [ ] **PRD-04c** Onboarding Questionnaire (live weight-prediction chart, plan preview)
- [ ] **PRD-05** Stripe Connect + Honest Billing Engine (3DS, chargeback automation)
- [ ] **PRD-06** Pricing Tiers + Cohort SKUs + Rev-Share Firewall
- [ ] **PRD-07** Subscriber Dashboard
- [ ] **PRD-08** Exercise Library (2,619 seed + filmed demos)
- [ ] **PRD-09** 5-Context Equipment Substitution Engine
- [ ] **PRD-10** Program Builder (coach-side)
- [ ] **PRD-11** Workout Player (audio timer, Wake Lock, progressive overload, follow-along)
- [ ] **PRD-12** Workout Logging + History

### Out of Scope

<!-- Explicit boundaries for this build (not just this milestone). -->

- Physical merchandise (waist trainers, bands) — future vision, not this build
- Licensing Stephanie's content to other coaches — long-term, not this build
- Macro-friendly restaurant locator — pending Rodney scope confirmation; Phase 3+ if real
- Full white-label multi-coach platform — architecture supports it (company_id + RLS), not built now
- Public API Settings UI / Connect-to-Claude page — Build Profile D (API internal-only; MCP is PRD-47)

## Context

- **Mission:** replace Stephanie's manual 1:1 Lenus coaching with a fully automated, owned app so she
  can step back from delivery and focus on high-ticket, while serving 256 existing clients and
  scaling to a mass bilingual market. "Same map, completely different car" — keep Lenus's IA
  (clients know it), replace the 2019 SaaS visual execution entirely.
- **Partnership:** three companies, partners not employees. Thick & Fit (Stephanie) = client/brand;
  LevelUp Automations (Rodney Williams, Shakira Canty) = scope + client relationship; Kaldr Tech
  (LaSean Pickens / DreTheGeek) = engineering.
- **256-client migration** is a foundational constraint: 80 active + 176 churned, authoritative MRR
  $16,798.99, grandfathered per-client pricing ($129-$369/mo) preserved individually, 61 clients
  renew Jun 11-Jul 14 2026. All get `is_legacy_client=true`, `legacy_source='lenus'`,
  `lenus_profile_id` stored; never enter rev-share; flag never expires. Full history migrated.
- **Build phases beyond this milestone (future milestones):** Phase 2 = PRD-13-30 (`phase-2` branch:
  macro calculator, food DB, photo-to-macro, meal plans, recipes, community, DMs, leaderboards,
  broadcasts, mid-ticket workflow). Phase 3 = PRD-31-47 (`phase-3`: AI coach + voice clone, coach
  toolbox, GHL drip, digital store, gamification, push/email, analytics, branding, SEO, Capacitor
  native + Apple Health, follow-along, LATAM payments, MCP/API).
- **Build kit:** full Kaldr Build System v3.2 package lives in `Build/` (research, foundation docs,
  48 PRDs, planning scaffold with specs/ledger/wiring-graph/hooks). The authoritative spec for each
  capability is its PRD in `Build/02-prds/` plus the living spec in `Build/03-planning-scaffold/.planning/spec/`.
- **Tooling caveat:** the kaldr-build-system skill is not installed in this environment, so GSD runs
  stock over the PRDs (blocking hooks still enforce; the kit's evaluator/ledger machinery requires
  that skill).

## Constraints

- **Tech stack (LOCKED at discovery)**: Next.js 16 App Router / React 19 / TS strict / Tailwind v4 /
  shadcn / Framer Motion; Supabase (Postgres + PostGIS + pgvector + Auth + Storage + Edge Functions
  + Realtime); Stripe Connect Standard; OpenRouter (claude-sonnet-4-6, claude-haiku-4-5, Gemini 2.5
  Flash); Mux (Cloudflare Stream fallback); Resend + GoHighLevel + Twilio 10DLC; Sentry; PostHog;
  Zod 4; Dexie + serwist (PWA); pnpm; Vercel — never reassumed.
- **Multi-tenant**: `company_id NOT NULL` + RLS on every table. Money BIGINT cents (`_cents` suffix).
  SHA-256 API keys. Stephanie is tenant 1; architecture supports white-label later.
- **Branch strategy**: `main` = Phase 1 (PRD-00-12). `phase-2`, `phase-3` for later phases (not yet
  created locally — only `main` exists). Rebase each phase onto the prior before building.
- **Security**: Fort Knox before first user — RLS, audit_log, session_logs, consent, rate limiting,
  webhook signature verification, 3DS + card-testing prevention, device fingerprint + VPN detection,
  `is_legacy_client` firewall (deployment-blocking).
- **Design doctrine**: editorial minimalist with attitude. Pure black #000 + olive #5EBE62;
  Anton / Bebas Neue / Oswald / Inter; zero-border cards; black-fill 0-radius buttons. Banned:
  centered gradient hero, 3-col icon grids, floating device mockups, gradient blobs, purple-on-white,
  "unlock your potential / seamless / empower / game-changing". Copy sells the transformation.
- **Lint/format**: ESLint + Prettier (NOT Biome). Files kebab-case, DB snake_case, money bigint.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace Lenus with an owned app | Stephanie does not own Lenus; it can't do bilingual or photo-to-macro | — Pending (build) |
| Build Profile D (Consumer App) | End users are consumers, never developers; no API keys in UI | — Pending |
| Map each PRD to a GSD phase, kit as source of truth | Kit already contains research/requirements/roadmap; don't re-derive | — Pending |
| Milestone v1.0 = Kaldr Phase 1 (PRD-00-12, MVP) | Kit defines Phase 1 as "open for business"; Phase 2/3 = later milestones | — Pending |
| OpenRouter for AI | Client build, OpenRouter acceptable; routes quality vs volume vs free photo tier | — Pending |

---
*Last updated: 2026-06-18 after milestone v1.0 initialization*
