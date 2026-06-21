# Thick & Fit — Merged Prioritized Roadmap (CTO synthesis of 4 research streams)

## Verdict
Strong, verified data + admin/CRM foundation (48 RLS tables, 5-role RBAC, JWT claim
injection, real revenue/pipeline views, full Lenus + GHL migration, $297k history) and a
working-but-thin subscriber app. NOT shippable as-is for two verified reasons.

### Blocker 1 — Live data-breach / privilege-escalation holes (confirmed in code)
- **profiles** (`0001_foundation.sql` L50-51): bare `company_id = current_company_id()`, NO
  `WITH CHECK`, NO `id = auth.uid()`. Single-tenant => any subscriber can UPDATE any profile,
  set their own role to `operator`, and become admin on next token refresh. Most dangerous hole.
- **CRM PII tables** (`0013_crm_foundation.sql`): contacts, client_subscriptions,
  contact_transactions, tags, contact_tags, legacy_client_snapshot, migration_log are
  tenant-only with no role gate and no WITH CHECK. Any logged-in user can read AND write all
  256 clients' PII + 1539 transactions ($297k). `0016` fixed this bug class for saved_segments
  only and left the real PII tables open. Live GDPR/CCPA exposure.
- **Per-user tables** (`0006`,`0009`,`0010`): onboarding_responses, workout_logs, set_logs,
  workout_completion_history, plan_assignments are tenant-only not per-user. Subscribers can
  read/tamper with each other's data.
- `next.config.ts` has NO `headers()` block (zero of the five mandated headers). No rate
  limiting, consent writers, or MFA exist in `src/`. `src/app/api/forms/[id]/submit/route.ts`
  L29 leaks raw `e.message`.

### Blocker 2 — The automation layer is aspirational (confirmed)
pg_cron + pg_net not enabled; ZERO edge functions deployed (resend-webhook + run-ai-eval are
Deno source only); GHL sync is a manual Node script. Dunning, win-back, nudges, drips, and
broadcasts physically cannot run — the biggest competitive gap. Schema is ready (cron_job_log,
signed resend-webhook, `_shared/api.ts` has serviceClient + timing-safe compare + a rate limiter).

### CLAUDE.md correction
Store `project_url` + `service_role_key` in **Supabase Vault**, not a Postgres GUC. The GUC
(`app.service_role_key`) is plaintext in catalogs/backups/logs. Update post-deploy step 1.

---

## Roadmap (ranked by impact x effort)

### NOW (deployment-blocking; one migration batch + the spine)
1. **Profiles RLS fix** — self-scope SELECT/UPDATE to `id = auth.uid()`, block role
   self-mutation via a BEFORE UPDATE trigger (operator-only), add WITH CHECK. [high/low]
2. **Role-gate 0013 CRM PII tables** to coach/assistant_coach/operator with explicit WITH
   CHECK, using the 0016 pattern. [high/low]
3. **Re-scope per-user tables** (onboarding_responses, workout_logs, set_logs,
   workout_completion_history, plan_assignments) to owner-only for subscribers + a
   coach/operator read path; add WITH CHECK. [high/medium]
4. **Security headers + error-leak fix** — five mandated headers in next.config.ts; replace raw
   e.message in forms/[id]/submit/route.ts L29. [medium/low]
5. **RLS perf sweep** (same migration) — `(select ...)` wrap on current_company_id/auth.jwt,
   `TO authenticated` on every policy, extract role check to `current_user_role()/is_coach_role()`
   helper, verify every RLS table has a company_id index and every view sets
   `security_invoker=true`. ~95% read-latency gain from the wrap, ~99.78% from TO authenticated. [medium/low]
6. **Automation spine** — enable pg_cron + pg_net; store keys in Supabase Vault; deploy
   resend-webhook + run-ai-eval with `--no-verify-jwt`; add `webhook_events` table with
   `UNIQUE(provider, provider_event_id)` as the single idempotency primitive for ALL external
   webhooks; wire one proof cron that writes a cron_job_log row. [high/medium]

### NEXT (security-before-payments, revenue, the wedge)
7. **Rate limiting + auth-event logging + consent capture** — app-layer rate limiting (back
   rate_limit_log or Upstash) on auth/waitlist/MCP; write session_logs + security_events on
   auth events (login success/fail, IP, device fingerprint); wire consent_captures into
   sign-up/onboarding/billing (type, version, IP, UA, timestamp). Prerequisite before payments. [high/medium]
8. **Stripe with Fort Knox baked in** — stripe-webhook edge function (signature verify, dedupe
   via webhook_events, raw-persist, 200-fast, async): subscription lifecycle ->
   client_subscriptions, invoice.payment_failed -> dunning, charge.dispute.created ->
   chargeback evidence. Enable 3DS, idempotency keys, payment-attempt rate limiting, audit +
   delivery-proof on money movement. Re-fetch the canonical Stripe object per event
   (out-of-order delivery). [high/high]
9. **Dunning + win-back automations** — pg_cron -> edge-function jobs on data we own
   (contacts, client_subscriptions, contact_transactions): daily dunning-sweep, weekly
   win-back over lapsed subs + 650 leads / 988 GHL opportunities. Dunning recovers 70-85% of
   failed payments vs 40-50% without. Highest-ROI automation; reuses saved_segments. [high/medium]
10. **GHL webhook-primary + nightly reconcile** — ghl-webhook edge function
    (ContactUpdate/OpportunityUpdate, last-writer-wins on ghl_updated_at) + repackage the
    existing ghl-sync.cjs cursor logic as a scheduled nightly full-reconcile. [medium/medium]
11. **Nutrition wedge (cheap-first)** — (a) deterministic cooked/uncooked conversion lookup
    table (no AI) + curated ~200-food bilingual LATAM ingredient table (data entry); then
    (b) photo-to-macro (Gemini free tier) + barcode/USDA/Open Food Facts. Photo-to-macro is now
    table stakes (Everfit, Trainerize); the defensible moat is deterministic cooked/uncooked +
    the LATAM layer + bilingual — uncopyable by English-first rivals. [high/high]
12. **CRM depth + observability** — bulk actions (multi-select + bulk
    tag/stage/segment/assign/export) on Clients + Leads; churn/retention KPI on Business
    Overview from client_subscriptions; wire the broadcast composer to a Resend fan-out edge
    function; Supabase Log Drain -> Sentry; dead-man's-switch cron on missing cron_job_log
    rows; PostHog event tracking to feed the empty Engagement view. [medium/medium]

### LATER (parity + creator features)
13. **Twilio 10DLC + two-way SMS** edge functions (auth codes, check-in nudges, missed-lead
    text-back, Text2Pay recovery) with signed callbacks; start 10DLC paperwork early. [medium/high]
14. **Accountability automation** — check-in reminders, habit streaks, engagement nudges
    (cron over existing form/workout data) + NPS/survey send to feed Engagement. [medium/medium]
15. **Community delivery backend** — push/email/realtime fan-out behind existing composers +
    posts/reactions/comments/groups/challenges/leaderboards schema (Phase 2). [medium/high]
16. **MFA + admin hardening + SSRF guards + dependency scanning** — MFA on operator/coach,
    separate admin session, optional IP allowlist, SSRF allowlist on GHL/URL inputs,
    Dependabot/audit gate. [medium/medium]
17. **Wearables + Mux** — Apple Health/Google Fit/Fitbit/Garmin/Oura via Phase 3 Capacitor
    shell; Mux environment + signing keys for demo videos. [medium/high]
18. **AI Coach (PRD-31)** — populate run-ai-eval evaluator registry, ai_evals, OpenRouter,
    grounding on Stephanie's knowledge base. Blocked until Shakira delivers the AI Knowledge
    Base questionnaire. [medium/high]
19. **Test layer** — Vitest unit tests for deterministic logic (overload, Mifflin-St Jeor
    onboarding, substitution) + Playwright E2E for role-based 403 flows via launchproof codegen,
    in CI. RLS fixes need 403 regression tests so the escalation holes never reopen. [medium/medium]

---

## Top 5 moves to do next
1. RLS lockdown migration TODAY (profiles + 0013 CRM PII + per-user tables + perf sweep, one batch).
2. Security headers + forms error-leak fix TODAY.
3. Stand up the automation spine (pg_cron+pg_net, Vault, deploy 2 functions, webhook_events, one proof cron).
4. Build Stripe with Fort Knox baked in (3DS, idempotency, dedup webhook, dunning, chargeback evidence).
5. Ship dunning + win-back crons on data we already own (256 clients, $297k, 650 leads, 988 opportunities).

## Extract from CraneOP once accessible
1. Edge-function + cron registry/config (deno.json or functions/config.ts).
2. pg_cron schedule definitions + secret storage (Vault vs GUC); cron.schedule -> net.http_post -> edge-function shape.
3. stripe-webhook end-to-end (signature verify, dedupe, subscription mapping, payment_failed -> dunning, dispute -> chargeback packet).
4. Rate-limiting/breach-scoring middleware behind rate_limit_log + 3DS/VPN/device-fingerprint logic.
5. GHL sync as pg_net+pg_cron vs Node script + inbound ghl-webhook handler.
6. Resend/Twilio webhook sender validation + bounce/complaint handling.
7. api_keys SHA-256 validation, prefix-indexing, key-rotation tooling (vs src/lib/api/auth.ts).
8. audit_trigger_func/set_updated_at definitions + service-role/pg_cron write exemptions on system tables.
9. custom_access_token_hook + auth-event writers on login success/fail.
10. next.config security headers block, CSP, + SSRF allowlist helper.
