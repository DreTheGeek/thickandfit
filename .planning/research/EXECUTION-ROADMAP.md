# Thick & Fit, Launch Execution Roadmap

One ordered, dependency-sequenced plan for the remaining launch work packages: WP3-finish (AI), WP8 (mid-ticket), WP10-finish (account/legal), WP11 (cron/timezone), WP12 (monitoring), WP13 (content migration). Synthesized from the six per-WP research docs in `.planning/research/`. Every claim is grounded in files actually read in those docs and re-verified against the live tree (latest migration is `supabase/migrations/0038_health_ack.sql`; next free number is 0039).

Source docs:
- `.planning/research/wp3-ai-finish.md`
- `.planning/research/wp8-mid-ticket.md`
- `.planning/research/wp10-account-finish.md`
- `.planning/research/wp11-cron-notif-tz.md`
- `.planning/research/wp12-monitoring.md`
- `.planning/research/wp13-content-migration.md`

---

## 0. The Migration-Number Problem (read first)

Each WP independently planned to use `0039`. They WILL collide. Migration filenames are append-only history; two files cannot share a number on the same branch. Worse, this repo already has historical collisions (two `0028_`, two `0029_`, two `0034_`) so do not assume the tooling will catch a dup. Numbers are assigned here ONCE, in execution order, with zero reuse:

| # | Migration file | Owner WP | Purpose |
|---|---|---|---|
| 0039 | `0039_timezone_and_cron.sql` | WP11 | `profiles.timezone` + `profiles.reminder_hour`; explicit-local-day columns; enable pg_cron + pg_net; register cron jobs |
| 0040 | `0040_coach_knowledge.sql` | WP3 | `coach_knowledge` vector table + `match_coach_knowledge` RPC |
| 0041 | `0041_mid_ticket_workflow.sql` | WP8 | `coaching_assignments` + `approval_queue` + `is_approver()` helper |
| 0042 | `0042_legacy_claim.sql` | WP13 | `claim_legacy_contact()` security-definer RPC |
| 0043 | `0043_account_constraints.sql` | WP10 | OPTIONAL: `notification_preferences` category CHECK (only if built) |

Rules:
- WP12 (monitoring) ships ZERO migrations.
- WP10 is migration-optional. If the category CHECK is skipped, 0043 is not created and the ladder simply ends at 0042.
- If WPs are reordered, re-assign numbers to preserve ascending-by-apply-order. Do NOT let two engineers each grab "the next number" in parallel: the migration number is a shared resource, allocate it from this table.
- After ANY migration that touches a table, policy, or RPC: run `node .qa-visual/rls-isolation-test.cjs` (RLS has leaked 3x historically per MEMORY).

---

## 1. Shared-File Conflict Map (edit one WP at a time)

Six files are touched by multiple WPs. These are merge-conflict and overwrite hazards. The rule is sequential ownership: only one WP edits a shared file at a time, commit, then the next WP rebases and edits. Never parallelize edits to these files.

### `src/messages/en.json` + `src/messages/es.json` (touched by ALL SIX WPs)
The single biggest conflict surface. Every WP adds i18n keys. Mitigation:
- Each WP appends its keys under a WP-distinct sub-namespace so additions never overlap (e.g. `app.coachKnowledge.*`, `app.approvals.*`, `app.accountSecurity.*`, `app.reminders.*`, `app.monitoring.*`, `app.claim.*`).
- EN and ES must be edited in the SAME commit, identical key sets, real Spanish, NO em dashes (CLAUDE.md hard rule, enforced by `/sweep`).
- WP10 must ALSO fix the pre-existing bug found in its research: `delete-account.tsx` calls `t('common.cancel')` under the `app` namespace but `app.common.cancel` does not exist (only top-level `common.cancel`). Add `app.common.cancel` and `app.common.save` while in these files. Do this in WP10's pass so it lands once.

### `src/components/nav/coach-nav.tsx` (touched by WP3, WP8)
- WP3 adds a Knowledge link under the existing `navSettings` section (`SECTIONS`, line 56-61): `{ key: 'navKnowledge', href: '/coach/settings/knowledge', icon: 'sparkle' }` (or nearest icon).
- WP8 adds three links: `/coach/drafts` (assistant-facing), `/coach/approvals` + `/coach/assignments` (approver-facing). These belong in a NEW section or under `navClients`.
- Because both edit the same `SECTIONS` array, WP3 ships first, commits, then WP8 rebases and adds its entries. Note coach-nav renders by role-agnostic link list today; WP8 link visibility by exact role is enforced at the PAGE level (requireApprover redirect), not by hiding nav items, but consider conditional rendering for UX.

### `src/lib/auth/guards.ts` (touched by WP3, WP8)
- Verified current state: exports `requireAuth`, `requireCoach`, `requireEntitled`. `requireCoach` uses `COACH_ROLES` which INCLUDES `assistant_coach` (confirmed in `src/lib/auth/session.ts` line 7 `Role` union + WP8 doc).
- WP3 only REUSES `requireEntitled` (no change needed) and `requireCoach` for the knowledge page. No edit required unless adding an AI-specific guard.
- WP8 MUST ADD a new `requireApprover()` (operator + coach only, EXCLUDES assistant_coach). This is the single highest-risk gate in the whole roadmap (see WP8). WP8 owns the edit to this file.

### `src/lib/auth/session.ts` (touched by WP8 only, in practice)
- Defines `Role` union (line 7) and `COACH_ROLES`. WP8 may add an `APPROVER_ROLES = ['coach','operator']` const here to back `requireApprover()`. Single owner: WP8.

### `src/app/(app)/layout.tsx` (touched by WP12 only)
- WP12's PostHog pageview mount goes in `src/app/layout.tsx` (root), NOT `(app)/layout.tsx`, per the WP12 research (Providers live in root layout). Confirmed both files exist. No multi-WP conflict.

### `next.config.ts` (touched by WP12 only)
- WP12 wraps the export in `withSentryConfig` OUTSIDE `withNextIntl`, and widens CSP `connect-src`/`script-src` for Sentry + PostHog. Single owner: WP12. All 5 mandated security headers + HSTS already ship here (verified in WP12 doc), so this is additive only.

Other single-owner shared-ish files (no cross-WP conflict, listed for awareness):
- `.qa-visual/rls-isolation-test.cjs`: extended by WP3, WP8, WP13 (each appends its new tables). Append-only; low conflict risk but coordinate.
- `e2e/launchproof.gen.spec.ts`: regenerated (not hand-edited) by WP8 + others via `launchproof:codegen`. Regenerate last, after all routes exist.

---

## 2. Dependency Order + What Unblocks What

Ordering is driven by (a) hard data/correctness dependencies, (b) shared-file sequencing, (c) risk (do the irreversible/launch-gated last).

```
WP11 (timezone + cron)   <- FIRST. Timezone correctness is a foundation other WPs read.
        |
        |  reminder/renewal/checkin jobs depend on tz being correct
        v
WP12 (monitoring)        <- SECOND. No migrations, no shared logic deps. Catch errors in everything built after.
        |
        v
WP3-finish (AI)          <- THIRD. Coach-nav + guards first writer. Self-contained migration 0040.
        |
        |  WP8 reuses coach-nav + guards AFTER WP3 commits
        v
WP8 (mid-ticket)         <- FOURTH. Adds requireApprover (the critical gate). Rebases coach-nav after WP3.
        |
        v
WP10-finish (account)    <- FIFTH. Touches billing + account, i18n-heavy, fixes the app.common.cancel bug.
        |
        v
WP13 (content migration) <- LAST. Highest external-dependency + irreversible (real invites, real Mux). Launch-gated.
```

### Why this order

1. **WP11 first (timezone before everything that reads "today").** The timezone bug is pervasive: `todayIso()` is UTC in `src/lib/nutrition/diary.ts:22`, `src/lib/habits/habits.ts:15`, `src/lib/gamification/engine.ts:67`, and `food_log.log_date` / `weight_entries.recorded_on` default to UTC date in the DB. `habits.ts:14` literally has a TODO deferring this to WP11. WP3 plan-gen reads `computed_targets`, WP8 drafts reference client data, WP10 export dumps logs, WP13 imports legacy data, all of these are cleaner once "local day" is correct. CRITICAL SUB-DEPENDENCY: the reminder cron jobs (WP11's own second half) require `profiles.timezone` + `reminder_hour` to exist BEFORE the hourly reminder job can filter by `extract(hour from now() at time zone profiles.timezone) = reminder_hour`. So within WP11: add the columns, fix the local-day writers, THEN register crons.

2. **WP12 second (monitoring early so it observes later work).** Zero migrations, zero shared business logic. Installing Sentry + PostHog early means every error introduced by WP3/8/10/13 is captured during dev/staging. It is also the lowest-risk WP (graceful no-key degradation already proven by `resend.ts`/`stripe.ts` precedent). Doing it early is pure upside.

3. **WP3 third (first writer of coach-nav + guards).** WP3 and WP8 both touch `coach-nav.tsx`. WP3's change is additive (one settings link) and its migration (0040, coach_knowledge) is independent. Ship WP3, commit, so WP8 has a stable base to rebase onto. WP3 also establishes the in-chat AI disclaimer pattern that reuses WP10's `health_ack_at` gate (already shipped in 0038), so no WP10 dependency.

4. **WP8 fourth (depends on coach-nav from WP3; owns requireApprover).** WP8 rebases after WP3 to take the updated `coach-nav.tsx`, then adds its nav links and the `requireApprover()` guard. WP8 is higher-risk than WP3 (the assistant-self-approve bypass is the marquee risk and PRD-30 mandates the evaluator try to bypass it), so it goes after the simpler AI work is stable. WP8 needs a NEW seeded `assistant_coach` account (gap, see below).

5. **WP10 fifth (account/legal; i18n-heavy; billing-adjacent).** Touches `account/billing/page.tsx` and `billing/actions.ts`. No dependency on WP3/8 but it is i18n-heavy (largest message-key add after WP8) so sequencing it after the coach WPs keeps the en/es files from churning under two editors. It also fixes the `app.common.cancel` i18n bug for everyone.

6. **WP13 last (most external dependencies, irreversible, launch-gated).** Real Mux account + 369 demo video files + webhook, verified Resend sending domain, and the actual 256-client invite batch are all production launch actions gated on Stephanie's go-ahead (per `call-2026-06-25-decisions`). The ES-fill and claim-RPC plumbing can be BUILT and verified earlier with seed data, but the irreversible sends go last. Its migration (0042) is independent of the others.

---

## 3. Per-WP Build Steps + Launchproof Verification

Test accounts (pw `TFSample2026!`): `sample.casey`=coach, `sample.sam`=subscriber, `sample.faye`=free. GAP: no `assistant_coach` account is seeded (needed by WP8). Read any schema with `node .qa-visual/sql.cjs "<SQL>"`. Gate every WP on `pnpm typecheck` + `pnpm lint` (blocking hooks) and `pnpm build` (must pass WITH AND WITHOUT the relevant external key, the lazy-proxy/key-gated contract).

### WP11, pg_cron + notification triggers + per-user timezone (migration 0039)

Build order:
1. `0039_timezone_and_cron.sql`: add `profiles.timezone text default 'America/New_York'` + `profiles.reminder_hour smallint default 19`. Validate IANA zones against `pg_timezone_names` (Mexico dropped DST in 2022, so IANA names are mandatory, not UTC offsets). Add a tz-aware safety-net default/trigger for `food_log.log_date` / `weight_entries.recorded_on` / habit logged_date is optional; the primary fix is writing the local day explicitly from app code.
2. Create `src/lib/datetime/local-day.ts`: a `localDay(tz)` helper replacing UTC `todayIso()`.
3. Modify the three UTC writers + their actions: `src/lib/nutrition/diary.ts` + `diary-actions.ts`, `src/lib/habits/habits.ts` + `habit-actions.ts`, `src/lib/gamification/engine.ts` (the `utcToday` at line 67). Pass the user's `profiles.timezone` through.
4. Create `src/lib/notifications/generators.ts`: insert-on-schedule generators reusing `createNotification`/`createNotificationsBulk` (already bilingual via `notifText`). Sources all exist: renewal = `subscriptions.current_period_end` + `cancel_at_period_end`; comp-expiry = `profiles.comp_access_until` (note `isEntitled` is COMPUTED so demotion is automatic, the cron only NOTIFIES); check-in-due = `form_assignments` + `form_responses`; active subscribers = `listActiveSubscribers`.
5. Create the secret-gated routes: `src/app/api/internal/notify-reminders/route.ts`, `notify-renewals/route.ts`, `notify-checkins/route.ts`. Copy the proven pattern from the existing `/api/internal/generate-insights` + `/api/internal/ghl-sync`: CRON_SECRET bearer + service client + `cron_job_log` insert (`cron_job_log` table already exists, `0002_ai_email_cron.sql:64`).
6. In the migration, enable `pg_cron` + `pg_net` (available, not installed, verified via `pg_extension`) and register jobs via `net.http_post` to the routes, with idempotent unschedule-by-name and an exception guard. Use the `__CRON_SECRET__` placeholder-substituted-at-apply-time pattern from craneop-ref (`20260601_v3_29_reminder_cron.sql`): the GUC `alter database set` approach was permission-denied on craneop's project via the Management API, so DEFAULT to the hardcoded-substitution path and only attempt GUC if `cpwesaeyhklmjbqppeah` allows it (test before committing).
7. The hourly reminder cron filters users by `extract(hour from now() at time zone profiles.timezone) = reminder_hour` (pg_cron has NO native per-job timezone; this UTC-hourly-filter is the documented DST-correct workaround).

Launchproof verification:
- Set `profiles.timezone='America/Mexico_City'` on `sample.sam` via `sql.cjs`. As `sample.sam`, log food at a controlled UTC time near midnight; assert the `food_log.log_date` reflects the LOCAL day, not UTC. (Verifiable NOW with seed data.)
- Trigger `notify-checkins` / `notify-renewals` routes manually with the CRON_SECRET bearer; assert a `cron_job_log` success row and that in-app notification rows were inserted (in-app delivery needs no external key). (Verifiable NOW.)
- Assert `cron.job` registration via `sql.cjs "select jobname, schedule from cron.job"`. (Verifiable after migration applied to the real project.)
- NEEDS REAL DATA/KEYS: web PUSH delivery needs `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push is a verified no-op until then, only in-app rows confirm); `pg_net` reaching the route needs the deployed Vercel prod URL publicly reachable from Supabase egress (confirm in prod, not local); CRON_SECRET must be set as a Vercel env var AND substituted into the cron body at apply time.

### WP12, Sentry + PostHog + security headers + bilingual global-error (NO migration)

Build order:
1. `pnpm add @sentry/nextjs@^9 posthog-js@^1` (both currently absent from node_modules, verified).
2. Create server `src/instrumentation.ts` (`register()` + `export const onRequestError = Sentry.captureRequestError`, branch on `NEXT_RUNTIME`, early-return without DSN). Files MUST live under `src/` (project uses a src folder) or Next never loads them.
3. Create `src/instrumentation-client.ts` (guarded `Sentry.init` + `posthog.init` with `capture_pageview:false`; `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`, omitting it triggers an SDK warning).
4. Create `src/sentry.server.config.ts` and `src/sentry.edge.config.ts` (proxy.ts runs at edge, so the edge config is required to capture proxy errors). Each `Sentry.init` guarded by `if(dsn)`.
5. Create `src/lib/monitoring/posthog-pageview.tsx` (capture `$pageview` on `usePathname`/`useSearchParams` change; App Router has NO auto pageview). Mount it in `src/app/layout.tsx` inside Providers.
6. Modify `src/app/global-error.tsx` (ALREADY EXISTS, English-only with hardcoded `lang="en"`): make bilingual via a self-contained `{en,es}` map keyed off the `ui_locale` cookie (next-intl provider is GONE at this boundary, `src/proxy.ts:34-41` guarantees the cookie); add `Sentry.captureException` in `useEffect`; keep on-brand black/olive markup.
7. Modify `next.config.ts`: wrap export in `withSentryConfig` OUTSIDE `withNextIntl`; widen CSP `script-src` for `https://*.posthog.com` and `connect-src` for `https://*.posthog.com` + Sentry ingest (or configure `tunnelRoute`). Keep session replay OFF for v1.
8. OPTIONAL cosmetic: flip `src/lib/coach/system-map.ts:75` + `monitoringSoon` key (en/es line ~397) out of "Phase 3 / planned". `system-health.ts:185-197` already probes the DSN/key env vars, so the Coach System Health panel flips to "configured" with zero code change once keys are set.

Launchproof verification:
- `pnpm build` with NO monitoring env vars must SUCCEED (graceful degradation gate). (Verifiable NOW, no keys.)
- `curl -sI` on `/` and `/api/v1/ping` shows all 5 security headers + HSTS, and CSP includes the widened Sentry/PostHog origins. (Verifiable NOW.)
- Set `ui_locale=es` cookie, force a root-layout error, assert global-error renders Spanish copy and `<html lang='es'>`; clear cookie, English. (Verifiable NOW.)
- NEEDS REAL KEYS: with `SENTRY_DSN` set, throw in a route handler, confirm the event lands in Sentry; with `NEXT_PUBLIC_SENTRY_DSN` set, throw in a client component, nested `error.tsx` renders + Sentry receives it; navigate, no missing-`onRouterTransitionStart` warning. With `NEXT_PUBLIC_POSTHOG_KEY` set, navigate, `$pageview` events appear in PostHog. As `sample.casey`, the Coach System Health rows for Sentry + PostHog flip to "configured". Confirm exact CSP ingest origins against the actual DSN region before pinning the allowlist.

### WP3-finish, AI knowledge builder + plan-gen + safety (migration 0040)

Build order:
1. `0040_coach_knowledge.sql`: `coach_knowledge` table (company_id-scoped, `vector(1536)` embedding, HNSW `vector_cosine_ops` index, `source_id`/`title`/`chunk_index`/`content`/`created_by`, RLS coach-write + company-scoped subscriber-read) + `match_coach_knowledge(p_company_id, query_embedding, match_count)` SECURITY DEFINER RPC mirroring `match_coach_memory` (`0030_food_log_embedding.sql`) but keyed on `company_id` instead of `profile_id`. Embedding stack is FIXED: `openai/text-embedding-3-small` at 1536 dims (confirmed against OpenRouter embeddings docs); coach_knowledge.embedding MUST be `vector(1536)` HNSW cosine or all retrieval breaks.
2. Create `src/lib/coach-ai/knowledge.ts`: chunk pasted text (copy `chunkByParagraph` from `C:/Users/dre/ai-junkies-ref/src/lib/ai/chunking.ts`), embed each chunk via the existing key-gated `embedText()`/`toVectorLiteral()` from `src/lib/coach-ai/embeddings.ts`, store rows. Must degrade gracefully: with no `OPENROUTER_API_KEY`, store chunks with `embedding=null` (never throw).
3. Create `src/lib/coach-ai/safety.ts`: centralize bilingual guardrail copy.
4. Modify `src/lib/coach-ai/chat.ts` (`buildMessages()`, lines 38-41 are the flagged Knowledge Base swap point) + `src/lib/coach-ai/context.ts`: add `renderKnowledgeBlock()` injecting retrieved chunks into the DYNAMIC system part, NOT the cached `PERSONA_EN/ES` (preserves prompt caching, a cost risk). Retrieval-gated (top-K by question), mirroring the memory-block pattern.
5. Create `src/lib/coach-ai/plan-gen.ts`: clone the Sonnet JSON-mode pattern from `insights.ts > extractNarrative()` (`response_format json_object` + defensive parse), read `onboarding_responses`, write a `meal_plans` row using typed columns (`calorie_goal`, `protein_g`/`carb_g`/`fat_g`, `split_*_pct`, `macro_timing_name`, `num_meal_groups`) + a `plan_jsonb` subset (`{name, mealGroups:[{name,numberOfMeals}]}`) that `getMealPlanDetail` (`src/lib/coach/meal-plans.ts:95-104`) parses. SCOPE v1 TO MEAL PLANS ONLY: there is NO `programs` table; workout programs are `public.plans` + `session_exercises` and the model cannot invent FK `exercise_id` UUIDs, defer workout-gen until a schema trace is done.
6. Create the coach Knowledge page + actions (`src/app/(app)/coach/settings/knowledge/page.tsx` + `knowledge-actions.ts`) and the plan API route (`src/app/api/coach-ai/plan/route.ts`). Action shape copies `src/lib/community/challenge-actions.ts` ('use server' + Zod + requireCoach + insert + revalidatePath). Reuse `checkRateLimit` + `logUsage`->`ai_usage_log` on the new AI endpoint.
7. Modify `src/components/coach-ai/coach-chat.tsx`: add the bilingual in-chat AI disclaimer banner. Reuse the `/disclaimer` + `profiles.health_ack_at` gate (0038), do NOT add a new ack unless legal requires a distinct "AI is not a medical professional" ack (OPEN QUESTION for Stephanie/legal; if required, add `profiles.coach_ai_ack_at` to 0040).
8. Add the nav link to `coach-nav.tsx` (FIRST writer; WP8 rebases after).

Launchproof verification:
- As `sample.casey`, paste method text at `/coach/settings/knowledge`; verify rows + embedding counts via `sql.cjs`. (Pipeline verifiable NOW: chunks persist with `embedding=null` when unkeyed.)
- As `sample.sam`, ask a method question in `/coach-chat`; confirm a grounded reply + bilingual AI disclaimer banner (EN/ES toggle). (Banner verifiable NOW; grounded-reply quality NEEDS the real key.)
- As `sample.casey`, generate a meal plan; confirm it renders at `/coach/tool/meal-plans/[id]` with macros + groups. (Render verifiable NOW with a hand-written row; AI output quality NEEDS the key.)
- Run `node .qa-visual/rls-isolation-test.cjs` clean for `coach_knowledge`. Confirm `pnpm build` passes with and without `OPENROUTER_API_KEY`.
- NEEDS REAL KEY/DATA: real `OPENROUTER_API_KEY` (Gap Log 5, pending Shakira's AI Knowledge Base questionnaire) to verify actual 1536-dim embeddings, retrieval quality, and Sonnet plan-gen quality. Stephanie's real voice/method text validates grounding faithfulness (table accepts placeholder seed content so the pipeline is testable immediately).

### WP8, mid-ticket coaching workflow (migration 0041)

Build order (rebase onto WP3 first to take updated `coach-nav.tsx`):
1. `0041_mid_ticket_workflow.sql`: `coaching_assignments` (company_id, assistant_id->profiles, client_id->profiles, `monthly_rate_cents BIGINT`, status active|paused|ended, unique(company,assistant,client)) + `approval_queue` (company_id, item_type message|meal_plan, client_id->profiles, item_ref, drafted_by->profiles, payload jsonb, status pending|approved|rejected, approved_by, approved_at, decision_note). CRITICAL RLS: `approval_queue` insert forced `status=pending` via WITH CHECK, and NO client UPDATE policy (the approved-transition runs ONLY under the service role, exactly the craneop `employee_invitations` pattern). Add the NEW `is_approver()` SQL helper (coach/operator only, EXCLUDES assistant), mirroring `is_coach()` at `0018:13`. Add `set_updated_at` triggers + optional `audit_trigger` on both (CLAUDE.md Anti-Get-Sued).
2. Modify `src/lib/auth/guards.ts`: ADD `requireApprover()` (operator/coach only). This MUST be added or there is no enforcement point, `requireCoach`/`COACH_ROLES` admit assistant_coach (verified: `Role` union in `session.ts:7`, `COACH_ROLES` used by `requireCoach` in `guards.ts:16`). Optionally add `APPROVER_ROLES` to `session.ts`.
3. Create the assignment + approval libs/actions: `src/lib/coach/assignments.ts` + `assignment-actions.ts`, `src/lib/coach/approval.ts` + `approval-actions.ts`, `src/lib/coach/approval-publish.ts`. The ONLY code that flips a queue row to `approved` and performs the publish is `decide()`, guarded by `requireApprover()`. Re-assert `status=pending` in the final UPDATE WHERE clause (double-approve race guard). `publishApprovedItem` is an `item_type`-keyed server-only dispatcher writing the real `messages`/`meal_plans` row.
4. ID-SPACE PITFALL (highest data risk): `messages.client_id->profiles(id)` but `meal_plans.contact_id->contacts(id)` are DIFFERENT id spaces. Assignment/queue `client_id` references `profiles`; the meal-plan target is carried as `payload.contactId`. Do NOT assume `client_id==contact_id`.
5. Create the three pages + components: `/coach/drafts` (assistant), `/coach/approvals` + `/coach/assignments` (approver), with `draft-composer.tsx`, `approval-queue.tsx`, `assignment-table.tsx`. Add nav links to `coach-nav.tsx` (after WP3).
6. Extend `.qa-visual/rls-isolation-test.cjs` for both new tables. Regenerate `e2e/launchproof.gen.spec.ts`.

Launchproof verification (REQUIRES seeding an `assistant_coach` account first, the one true blocker):
- As the assistant: `/coach/drafts`, compose a message draft for an assigned client, submit. Assert via `sql.cjs` that ONE `approval_queue` row exists `status=pending` AND NO new `messages` row was written (draft held = AC-1).
- As the assistant: navigate to `/coach/approvals`, assert redirected away (`requireApprover` blocks); attempt to call `decide()`, forbidden (the bypass-block, PRD-30 8b MANDATES the evaluator try this). This is the marquee verification.
- As `sample.casey` (coach/operator): `/coach/approvals`, see the pending draft with drafter+client names + payload preview, click Approve. Assert the real `messages` row now appears in the client thread and the queue row is `status=approved` with `approved_by`/`approved_at` set (publish-on-approve = AC-2).
- As operator: `/coach/assignments`, assign assistant<->client + set `monthly_rate_cents`, confirm the per-assistant payout rollup (count active clients x rate) renders (AC-3, tracking-only, no Stripe transfer in WP8).
- Run the extended `rls-isolation-test.cjs`. Every screen shows all four states (loading/empty/error/populated).
- Verifiable NOW (with seeded assistant account): the full draft->approve->publish flow, assignment+payout rollup, the bypass-block. `sample.sam` is the assigned client for message drafts; a real `contacts` row (256 imported) satisfies `meal_plans.contact_id`. Payout is tracking-only, no Stripe. The ONE blocker is the missing `assistant_coach` seed.

### WP10-finish, auto-renewal disclosure + data export + account buildout (OPTIONAL migration 0043)

Build order:
1. NO migration required for core scope. `notification_preferences` table ALREADY EXISTS (`0001_foundation.sql:185-197`) with the exact `(company_id,user_id,channel,category,enabled)` shape + RLS + UNIQUE for upsert. `consent_captures.consent_type` has NO CHECK so an `auto_renewal_disclosure` type needs zero migration. OPTIONAL `0043_account_constraints.sql` only if you want a category CHECK.
2. Auto-renewal disclosure: place copy proximate to the Subscribe button in `src/components/billing/billing-actions.tsx` (-> `startCheckoutAction` in `src/lib/billing/actions.ts`), NOT `/checkout` (still a ComingSoon stub, would never be seen). `startCheckoutAction` already writes a timestamped `consent_captures` row (IP+UA) before redirecting to Stripe. Add the standing cancel/refund policy on `src/app/(app)/account/billing/page.tsx` near `honestNote`. Copy must satisfy ROSCA + California ARL: clear/conspicuous disclosure of auto-renewal + recurring amount/cadence + cancel method, in visual proximity to consent.
3. Data export: create `src/components/account/export-data.tsx` + an `exportMyDataAction` in `src/lib/account/actions.ts` (mirror `deleteAccountAction`, service-client), assembling owned rows into one JSON Blob. Use an explicit ALLOWLIST: include the ~23 profile_id-owned tables (food_log, weight_entries, habits, habit_logs, workout_logs, progress_photos as PATHS ONLY, coach_messages, payments, subscriptions, etc.) + user_id-owned (consent_captures, notification_preferences, sessions) + the profiles row; REDACT security_events, audit_log, raw push_subscriptions keys, ai_usage_log internals.
4. Account buildout on `/account`: create `change-email.tsx`, `change-password.tsx`, `notification-prefs.tsx` + `src/lib/account/notification-preferences.ts`. Change-password reuses `supabase auth.updateUser({password, currentPassword})` (supabase-js 2.108.2 confirmed in package.json). Change-email uses `updateUser({email},{emailRedirectTo})` with Secure-email-change ON (NOT immediate, confirms via both inboxes), so the UI MUST show a pending state. VERIFY/ADD an `on_auth_user_updated` trigger syncing `auth.users.email` -> denormalized `profiles.email`.
5. Wire `notification_preferences`: the table is EMPTY and NOT consulted by `sendPush` (`src/lib/notifications/push.ts`) or triggers. Decide: either wire enforcement into the send path, or HONESTLY word the UI ("we will respect these"). Lock email/billing category toggle ON (pattern from `ai-junkies-ref/.../settings/notifications/page.tsx`).
6. Fix the `app.common.cancel`/`save` i18n bug in en.json + es.json while editing them (see Shared-File Map).

Launchproof verification (use `sample.sam`):
- `/account` hub shows new Security (email/password), Notifications, Download-my-data sections; switch to ES, all new copy is Spanish, no em dashes. (Verifiable NOW.)
- `/account/billing` as a non-subscribed account: Subscribe button shows auto-renew disclosure (renews automatically + recurring amount/cadence + how to cancel) in visual proximity; standing refund/cancel policy visible; same in ES. (Disclosure render verifiable NOW; LIVE recurring-amount display NEEDS Stripe.)
- Click Download my data: a `thickandfit-my-data.json` downloads containing profile + logs/billing rows and NOT raw push keys/security/audit/image bytes. (Verifiable NOW.)
- Change password (+ current password); re-login with new password works. (Verifiable NOW.)
- Change email: UI shows a "confirm via both inboxes" pending state, not an immediate change. (Pending UI verifiable NOW; actual confirmation DELIVERY needs Resend.)
- Notification prefs: toggle a category push off, verify the row upserts via `sql.cjs`; billing/email toggle locked-on. (Verifiable NOW.)
- OPEN: refund policy wording is an unresolved owner decision (Stephanie); pricing $99.97 low is locked per memory but refund terms are in no file.

### WP13, Mux import + ES exercise names + 256-client invite/history (migration 0042)

Build order (three loosely-coupled slices; build + verify with seed data first, run irreversible sends LAST):
1. ES FILL (lowest risk, fully verifiable now): create `src/lib/content/es-fill.ts`. All 873 exercises have `cues_en` (good source) but `name_es` is NULL for all 873; muscle_groups/equipment already ship ES labels (`0007_exercises.sql`) usable as glossary. Generate `name_es`/`cues_es` via existing OpenRouter + HUMAN review. Extend `src/app/api/exercises/route.ts:31` (currently searches `name_en` only) to search ES.
2. CLAIM (verifiable now with real legacy emails): `0042_legacy_claim.sql` = `claim_legacy_contact()` security-definer RPC linking `auth.uid()`->`contacts.profile_id` + `profiles.{is_legacy_client,legacy_source,lenus_profile_id}`, guarded by tenant + is_legacy + NULL-profile (handle_new_user `0004_auth_rbac.sql:7-22` always creates a blank subscriber profile, so claim must RECONCILE by email within `current_company_id()` + is_legacy + profile_id null, not duplicate). Create `src/lib/legacy/claim.ts` + `invite.ts` (use `createServiceClient().auth.admin.generateLink({type:'invite'})`, email via existing Resend `fetch` in `src/lib/email/resend.ts:16`) + `src/app/(app)/claim/page.tsx`.
3. PHOTO IMPORT (verifiable now, public URLs): `.qa-visual/import-lenus-photos.sql` idempotently copies the 2,151 `lenus.media` progress photos (at PUBLIC `pub-*.r2.dev` URLs, 232 of 256 clients) into the private progress-photos bucket + `progress_photos` rows, keyed on unique storage_path, run per-claimed-user, migration_log-stamped, firewall-gated. REALITY CHECK: lenus holds AGGREGATES not granular history, there is NO per-date weight or per-set workout source. "Import history" = photos + a read-only `legacy_client_snapshot` card (256 rows already populated). Going-forward tracking starts fresh. Default/NULL `taken_on` (no date column in lenus.media), label as legacy, do NOT fabricate a timeline.
4. MUX (NEEDS real account + files, run LAST): create `src/lib/content/mux-import.ts` + `supabase/functions/mux-webhook/index.ts`. The player at `src/components/workout/workout-player.tsx:288` consumes `video_mux_id` as a PLAYBACK id. Stephanie's ~369 demos are NOT in the DB (lenus.media is client chat/progress media); they arrive as an external `{name,url}` manifest, name-matched to `exercises.name_en`, POSTed to `https://api.mux.com/video/v1/assets` (Basic auth, `{inputs:[{url}], playback_policies:['public'], video_quality:'basic'}`). CRITICAL: assets are async, write `video_mux_id` ONLY on the `video.asset.ready` webhook (with Mux-Signature verification), never at create time (else 369 broken spinners). Copy the craneop-ref `migrate-active-subscriptions` edge-migration shape.

Launchproof verification:
- ES FILL: run es-fill, sign in as `sample.sam` with `content_locale=es`, open `/workouts` browser, confirm Spanish names + ES search; assert `sql.cjs "select count(*) from exercises where name_es is null"` = 0. (Verifiable NOW.)
- CLAIM: mint a `generateLink` invite for a real legacy contact email, open in browser -> `/auth/callback` -> `/claim` -> set password -> `/dashboard`; verify `contacts.profile_id` + `profiles.is_legacy_client` set via `sql.cjs`. (Verifiable NOW.)
- LEGACY SNAPSHOT: as a claimed legacy client, confirm the read-only journey card shows real `legacy_client_snapshot` numbers. (Verifiable NOW.)
- PHOTO IMPORT: R2 URLs are public, so download->private bucket->`progress_photos` runs for a real test client; open the progress gallery, confirm photos render via signed URL (0032 owner RLS). (Verifiable NOW.)
- Run `node .qa-visual/rls-isolation-test.cjs` after 0042.
- NEEDS REAL ACCOUNTS/DATA (run LAST, launch-gated): Mux playback (`MUX_TOKEN_ID`/`SECRET` + 369 demo files at URLs + webhook signing secret + name->url manifest) via `/workout/[planId]` MuxPlayer; verified Resend sending domain for teamthickandfit.com (DKIM/SPF/DMARC) for real invite sends; Supabase Auth redirect URLs incl `/auth/callback` + invite template; human ES review by Stephanie/Shakira BEFORE names go live; the actual 256-client invite batch is a production launch action gated on Resend domain + Stephanie go-ahead.

---

## 4. Verifiable NOW (seed/test data) vs Needs Real External Data/Keys

### Fully verifiable NOW with seed accounts + `sql.cjs` (no external keys)
- WP11: timezone-correct local-day logging; in-app notification generation; `cron_job_log` writes; `cron.job` registration (once migration applied); renewal/comp/check-in selection queries.
- WP12: build-without-env-vars graceful-degradation gate; security-header + CSP presence via `curl -sI`; bilingual global-error via the `ui_locale` cookie; file-convention correctness.
- WP3: the migration + RLS isolation; chunk/store flow (chunks persist with `embedding=null` unkeyed); the coach Knowledge page UI; the in-chat disclaimer banner; key-gated build; a hand-written `meal_plans` row rendering.
- WP8: table+RLS existence; the full draft->approve->publish flow; assignment+payout rollup; the assistant-self-approve bypass-block, ALL provided the missing `assistant_coach` account is seeded first.
- WP10: notification-prefs upsert; data export; password change; auto-renew disclosure render; consent-record write; email-change PENDING UI.
- WP13: ES fill (assert 0 `name_es` nulls); claim RPC end-to-end (906 legacy contacts, all have email, 0 claimed); legacy snapshot card (256 rows populated); photo import mechanics (2,151 photos at public URLs).

### Needs real external data or keys (do these on staging/prod, gate the launch sends)
- `OPENROUTER_API_KEY` (WP3): real 1536-dim embeddings, retrieval quality, Sonnet plan-gen quality. Pending Shakira's AI Knowledge Base questionnaire (Gap Log 5).
- `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (WP11): web push delivery (in-app rows work without it).
- CRON_SECRET set in Vercel + substituted into the cron body; `pg_net` reaching the live public prod URL (WP11). Test whether project `cpwesaeyhklmjbqppeah` allows `alter database set` (GUC); default to hardcoded substitution if not.
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`/`PROJECT`/`AUTH_TOKEN` for source maps) and `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` (WP12): confirm events land; confirm exact CSP ingest origins by region.
- Live Stripe (WP10): the actual recurring-amount display on the Subscribe disclosure.
- Resend verified sending domain (WP10 email-change confirmation; WP13 invite sends).
- Mux account `MUX_TOKEN_ID`/`SECRET` + webhook signing secret + the 369 demo video files staged at URLs with a name->url manifest (WP13). External deliverable from Stephanie.
- The actual 256-client invite batch (WP13): production launch action, gated on Resend domain + Stephanie go-ahead.
- Human ES review by Stephanie/Shakira (WP13) before exercise names go live.
- A seeded `assistant_coach` test account (WP8): the one blocker for full WP8 verification (MEMORY only has coach/subscriber/free).

---

## 5. Cross-Cutting Gates (every WP)

1. After any migration touching a table/policy/RPC: `node .qa-visual/rls-isolation-test.cjs` must pass (RLS leaked 3x historically).
2. `pnpm typecheck` + `pnpm lint` are blocking PostToolUse hooks. Never disable a hook.
3. `pnpm build` must pass WITH AND WITHOUT the relevant external key (lazy-proxy / key-gated never-throws contract).
4. EN + ES message keys edited in the SAME commit, real Spanish, NO em dashes.
5. Money is `bigint` `_cents`; every new table has `company_id NOT NULL` + RLS; timestamps `created_at`/`updated_at`.
6. Atomic commits, one fix = one commit, `fix(scope): ...` format. Do NOT push phase-2 code to main until the phase is ready to ship.
7. Regenerate `e2e/launchproof.gen.spec.ts` LAST (after all routes exist) via `launchproof:codegen` so every new route loads non-empty with no console errors.

---

## 6. Open Decisions to Resolve With Stephanie / Legal (do not block plumbing)

- WP3: separate "AI is not a medical professional" ack vs reuse `health_ack_at`? Recommend reuse + informational banner.
- WP3: knowledge ingestion input mode (titled text paste now; questionnaire/upload writes the same rows later, no migration).
- WP8: published-message byline `sender_id` = drafted_by (assistant authored) vs approved_by (Stephanie sent)? Recommend drafted_by.
- WP8: can an assistant edit+resubmit a rejected draft, or new row only? Recommend new row (immutable history).
- WP10: refund policy wording (Stephanie); pricing $99.97 low locked, refund terms in no file.
- WP11: reminder_hour user-configurable now or hardcoded 19:00 local? Recommend add the column now (default 19), UI later.
- WP13: which exercises receive demos (match ~369 to 873, mark is_own_demo, leave the long tail video-less with the dumbbell placeholder); invite scope (recommend clients-first, not all 906 leads); Mux public vs signed playback (recommend public to match the current player).
