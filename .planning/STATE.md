# STATE: Thick & Fit

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** Accurate low-friction bilingual nutrition tracking must work; convert Stephanie's
trust into a retained subscriber base.
**Current focus:** Phase 2 launch build on the `phase-2` branch (nutrition wedge, billing, AI coach,
community, mid-ticket, plus launch-readiness: paywall, legal, monitoring, scheduling). See
`.planning/LAUNCH-PLAN.md` and the 14-WP launch-ready build plan.

## Current Position

Phase: Phase 2 launch build IN PROGRESS on `phase-2`, executing the 14-WP plan (~/.claude/plans + LAUNCH-PLAN.md).
DONE + verified in-browser (committed): WP0 stabilize (merge main, build green, RLS 28/28); WP1 payments (tier
ladder STRIPE_PRICE_LOW/MID + trial; live Stripe is the last step); WP2 entitlement/paywall (comped-full +
pay-to-enter, profiles.comp_access_until, requireEntitled on gated pages, verified non-entitled->/checkout +
comped->access); WP3 AI coach RESTORED (revert of 1402144; chat/insights/RAG; entitlement-gated; graceful
no-OPENROUTER-key state) + AI endpoints rate-limited; WP4 text-to-macro (reuses photo resolve pipeline; in the
"Snap your meal" modal).
Bugs fixed en route: dotted i18n keys (next-intl INVALID_KEY); subscriber app failing to render in dev (CSP
needed unsafe-eval + wss for realtime); notification-bell realtime channel ordering.
REMAINING: WP3 finish (knowledge builder, plan-gen, AI safety/disclaimer); WP5 habits; WP6 check-ins; WP7 coach
console (inbox/billing&renewals/create-challenge/community); WP8 mid-ticket; WP9 nav trim; WP10 legal/account
(disclaimer, GDPR delete/export); WP11 pg_cron + notif triggers + timezone; WP12 Sentry/PostHog/404/headers;
WP13 Mux video import + bilingual ES + 256-client invite/history; WP14 ship.
Env not yet connected (plug-in-last, like the plan's completeness principle): live Stripe, OPENROUTER_API_KEY,
Sentry/PostHog, Twilio, Mux. Test note: `sample.sam` is comped (profiles.comp_access_until) for subscriber QA.
Last activity: 2026-06-28, WP0-4 + WP3 core built, verified, committed.

## PRD-12 result (commit 01e4482)
- 3 tables: workout_logs (completion_pct/enjoyment/effort), set_logs (per-set reps/weight/difficulty, indexed for overload), workout_completion_history. RLS tenant.
- saveWorkoutLog, fetchHistory (own + coach ?profile_id w/ 403 guard), recommendForExercise (getExerciseHistory -> recommendNext). Full loop proven on real data. /history page.

## PRD-11 result (commit 2ab86fe)
- No new tables. lib/overload/recommend.ts: deterministic double-progression (no-history->hold, easy->+rep/+weight, failed->deload, 2-hard->hold). Unit-verified 6/6. AC-3 proven.
- lib/overload/explain.ts: lazy OpenRouter AI explanation (falls back to deterministic rationale w/o key; never invents the number).
- components/workout/workout-player.tsx: Web Audio beep timer, Wake Lock (+ visibility re-acquire), set flow, inline substitution (calls PRD-09). /workout/[planId] guarded 307. AC-1/2/5 (timer/wakelock/Mux/follow-along) browser-verifiable; follow-along add-on gate is PRD-36.

## PRD-10 result (commit 79e161c)
- 4 tables: plans, sessions, session_exercises (format enum straight/circuit/superset, sets/reps/time/weight/rest/rounds/notes/config), plan_assignments. RLS tenant.
- Engine: saveProgram (nested, sort_order), getProgram (ordered reload), markTemplate, assignProgram, getAssignedPlans. AC-1/2/3 proven end-to-end (coach + 2 clients).
- UI: minimal /coach/programs list. Full 3-pane interactive builder is the remaining browser-heavy UI polish on the proven engine. Substitution chain-builder also surfaces here (engine from PRD-09 ready).

## PRD-09 result (commit f4004a4)
- 2 tables: exercise_substitutions (5-context enum gym/bodyweight/bands/freeweights/machines), substitution_reason_tags (KALDR:GLOBAL, bilingual). RLS tenant.
- Engine: saveChain (replace-by-context, sort_order=index), resolveSubstitutions (ordered + reason tags, or fallback to original w/ note). AC-1/2/3 proven end-to-end with coach+client.
- UI deferred to PRD-10 (coach chain builder in program builder) + PRD-11 (client picker in player), per the PRD.

## PRD-08 result (commit 9819df9)
- 3 tables: exercises (company_id NULL = shared seed), muscle_groups + exercise_equipment_types (KALDR:GLOBAL, bilingual labels). RLS: read system seed + own company.
- 873 exercises imported (free-exercise-db; PRD said 2619 but the canonical dataset is 873). /api/exercises search proven (muscle/equipment/name filters, 401 unauth). Browser UI with 4 states.
- Gaps: AC-2 Mux demo playback needs Mux key + uploaded demos (video_mux_id column + Demo badge ready). AC-3 Spanish exercise NAMES pending a translation pass (lookup labels are bilingual; name_es null on the English seed).

## PRD-07 result (commit 1318aef)
- No new tables. lib/dashboard/summary.ts aggregates onboarding targets now; workout/streak/activity null until PRD-10/11/12 + community.
- /api/dashboard/summary (authed). DashboardWidgets: loading/error(retry)/first-run/content. Proven: new user hasOnboarded:false -> first-run; after onboarding -> macros content. Guard 307.

## PRD-04c result (commits 2b9b305, 491eceb)
- onboarding_responses table (RLS). Prediction engine (lib/onboarding/prediction.ts): BMR/TDEE/calories/macros/weekly-delta/12wk curve, pure + reusable client+server.
- /api/onboarding/submit computes + stores per profile. Math proven via API (sane numbers).
- UI: OnboardingFlow with live recharts chart (recomputes on input, AC-1), plan preview + /checkout CTA (AC-3, paywall lands in PRD-05/06). Guard 307 verified. recharts builds with React 19.

## PRD-04b result (commits 1901f4c, d34d613)
- 4 tables: forms, form_fields, form_responses, form_assignments (all RLS). 23 tables total live.
- Engine + routes: save (reorder via sort_order), publish, assign, submit (Zod + required validation + assignment check), fetch. Full lifecycle proven (AC-1/2/3) with coach + client users.
- UI: coach FormBuilder (block palette, up/down reorder, save/publish), client FormRenderer, page guards (requireCoach/requireAuth) verified 307 -> sign-in.

## PRD-04 result (commits 011ceb6, def41a7)
- Migration 0004: handle_new_user trigger (profile on signup, tenant + subscriber), custom_access_token_hook (injects company_id + user_role into JWT), enabled in Supabase Auth config.
- Role guard layer (resolveAuth/hasRole), coach-only route proven: subscriber 403, coach 200, no auth 401.
- Auth UI: bilingual sign-in/sign-up/forgot pages, OAuth buttons, /auth/callback (exchangeCodeForSession). Pages + callback runtime-verified.
- Pending external config (scaffolded, inactive until keyed): Google/Apple OAuth provider config, Resend for email verification + password reset. Magic Link is a logged deviation (kept).

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
