# STATE: Thick & Fit

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** Accurate low-friction bilingual nutrition tracking must work; convert Stephanie's
trust into a retained subscriber base.
**Current focus:** Milestone v1.0 — Phase 1 (MVP, PRD-00-12)

## Current Position

Phase: Phase 4 (Marketing/Waitlist, PRD-03) complete and runtime-verified. Advancing to Phase 5 (PRD-04 Auth + 5-Role RBAC).
Plan: Phase 5 (PRD-04, email/password + Google + Apple + Magic Link, 5-role RBAC)
Status: PRD-01 + PRD-47 + PRD-02 + PRD-03 built and verified. 4 of 16 phases done.
Last activity: 2026-06-18, PRD-03: waitlist_leads + tenant seed (19 tables), /api/waitlist 201/422 proven, /join bilingual + Googlebot 200.

## PRD-03 result (commits d88fa37, fbb6b97)
- Table waitlist_leads (RLS) + real Thick & Fit tenant seeded (slug thick-and-fit).
- /api/waitlist: Zod-validated, idempotent upsert, lazy Resend (magnet) + GHL (drip) skip without keys. Lead capture proven (201, DB row; 422 bad email).
- /join bilingual landing + WaitlistForm (4 states) + thank-you. AC-2 (design) + AC-3 (Googlebot 200) proven.
- Note: Resend/GHL keys not set, so email + drip are coded-but-inactive until keys added. Google/Apple OAuth (PRD-04) will likewise need provider config.

## PRD-02 result (commit 0b44b2e)
- next-intl (cookie-driven, no URL routing). Catalogs src/messages/en.json + es.json.
- Independent locales: ui_locale (interface) vs content_locale (content), both cookie + profile backed. Proven independent at runtime.
- LATAM/ES IP default via middleware (x-vercel-ip-country), user-overridable. LanguageToggle component.
- Note: root layout now dynamic (reads locale cookie); marketing static-prerender can be re-optimized in PRD-03.

## PRD-47 result (commits b506754, fcfbca6)
- REST: lib/api/auth.ts (Node SHA-256 key validation), /api/v1/ping (200), /api/v1/me (401 on bad key). Runtime curl verified.
- MCP: /api/mcp JSON-RPC (initialize/tools/list/tools/call), tools scoped to the calling key company. Proven: key A sees only company-a, key B only company-b, no key -> Unauthorized.
- Docs: /api-docs (noindex; role-gating deferred to PRD-04).
- No new tables (uses PRD-01 api_keys + api_usage_log).

## PRD-01 result (commits 9e8bf35 .. 5df6ccb)

- DB: migrations 0001+0002 applied via Management API. 18/18 tables, RLS on all, 15+ policies. Cross-tenant proof: company A JWT sees only company-a, company B sees only company-b.
- 5-role RBAC seeded, is_legacy_client firewall + deployment-blocking comment, money columns bigint cents.
- Code: lib/supabase (client/server/service), _shared/api.ts (SHA-256 key validation), run-ai-eval + resend-webhook edge fns, 4 UI states, PWA shell (manifest + sw.js + install components + layout meta). pnpm build green.
- Open gaps (environmental / deferred): (1) blocking hooks are installed in .claude/hooks and one verified exit-2, but NOT wired into .claude/settings.json yet (that write was declined), so they do not block live during the build. (2) PWA real-device install on iPhone/Android not testable in this environment. (3) no endpoints deployed yet to curl the 401/no-stack-trace check. (4) PWA icons point at the Webflow jpgs as placeholders, real 192/512 maskable PNGs needed.

## Accumulated Context

- Only the Webflow lift (v0.1) is committed. Real build (PRD-00-12) not yet started.
- Build kit lives in `Build/` — research, foundation docs, 48 PRDs, planning scaffold (specs,
  ledger, wiring-graph, hooks). Authoritative spec per capability = its PRD + living spec.
- Local branches: only `main`. `phase-2`/`phase-3` not yet created (needed for later milestones).
- kaldr-build-system skill not installed → GSD runs stock over PRDs; blocking hooks still enforce.

## Open Blockers (do not block PRD-01 foundation)

- Lenus data loaded into Supabase (cpwesaeyhklmjbqppeah) — Rodney — blocks PRD-00 migration
- Supabase / Stripe Connect / Resend / GHL / Twilio / Mux / OpenRouter / Sentry / PostHog not configured
- 8 team decisions (pricing $16.99 vs $19.99, $250 vs $275, $2.99 add-on, live streaming, digital
  products) — Stephanie — isolated to PRD-05/06/28/35/36
- Shakira AI Knowledge Base questionnaire — blocks PRD-31 (Phase 3, runway exists)
