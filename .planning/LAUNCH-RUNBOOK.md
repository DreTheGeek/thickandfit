# Thick & Fit — Launch Runbook

> The single actionable checklist to take the product live. Written 2026-07-20 after a full code
> review + a launch-readiness pass. Supersedes the older `LAUNCH-PLAN.md` (2026-06-27), whose build
> stages are now essentially complete.

## Airtightness sweep (2026-07-21) — verified at the live-DB / observed-behavior level
Five parallel verifiers + a live browser/e2e pass swept the member journey, coach portal, admin
portal, auth, billing, and the database. Everything found was FIXED and re-verified same day:

- **P0 coach chat**: every reply streamed then vanished (stream deadlock on no-delta SSE frames;
  zero assistant rows ever persisted; 60s lambda burn per turn). Fixed + proven end to end.
- **HIGH billing**: payments were unrecordable (partial-index vs ON CONFLICT, error swallowed) and
  cancel→resubscribe crashed the webhook forever (UNIQUE customer index). Migration 0085 applied;
  probes re-run green.
- Checkout return race (webhook vs redirect) closed with server-side session reconciliation + a
  bilingual "activating" state; dashboard week strip now follows the member's timezone; onboarding
  save failures no longer loop the member; cron audit-log failures now surface in function logs
  (they had been silently dead since 7/8 — first prod run after deploy reveals the cause).
- Verified airtight: RLS isolation 37/37 · i18n 1540/1540 key parity · e2e suite 5/5 on the fixed
  build · all 34 coach routes render live with real data · approval flow driven end to end in prod
  · zero schema drift (all tables/RPCs/triggers live) · PWA shell complete · no dead nav links.

Remaining non-code items are in sections A–C below, plus: decide the **migrated-client entitlement
policy BEFORE arming Stripe** (the ~256 Lenus/GHL-billed clients have no native subscription row and
would hit the paywall; comp-grant them or union client_subscriptions), pin the **Stripe webhook API
version** (pre-Basil) when creating the endpoint, and enter the admin passcode once to eyeball the
13 admin pages (verified at schema level only).

## Status in one line
**Engineering is not the blocker.** All Phase 2 work packages are built and verified, the production
build is green, and `main` already contains everything (the `phase-2` branch is 95 commits *behind*
`main` with nothing the other way — the "merge phase-2 → main" step is a no-op). Launch is gated on
**(A) Stephanie's content, (B) external account wiring, (C) the go-live deploy.** The app is written
to **degrade gracefully** on every unset key, so nothing below crashes the app — each key switches a
feature on.

---

## A. Stephanie's content — the long poles (start now, nothing shortens these)

| Item | Owner | Gates | Notes |
|---|---|---|---|
| **AI Knowledge Base questionnaire** | Shakira + Steph | The coach's voice + plan-gen brain | THE long pole. Chat has no voice and plan-gen no content until captured. |
| **Re-recorded 369 demo videos** | Steph | Workout demos (Mux upload) | The Mux plumbing + webhook + import are built; they need footage. |
| **Approved exercise + recipe lists** | Steph + Shakira | Recipe library, meal plans | Steph-approved only, no bulk import. |
| **Offer blueprint** (mid-ticket structure) | Steph | Mid-ticket checkout | Low ticket locked at $19.97. High-ticket $3k+ is Phase 3, does NOT gate launch. |
| **GHL identity verification** | Steph | Twilio SMS (10DLC) | SMS trails until this clears; not a launch blocker for the core loop. |
| **~20 churn-status corrections** | Steph | CRM accuracy | In the Clients CRM. |
| **Final logo + PWA maskable icons** | Steph → eng | Branding polish | Shell is built; drop in the final assets. |
| **Legal go-ahead: 256-client invite batch** | Steph | The Lenus migration invite send | Run at go-live (job is built). |

---

## B. External accounts + environment variables

Every variable the code reads, grouped by system, with launch priority. Set these in the **Vercel
production environment**. "Degrades to" = what happens today when the key is absent.

### Required to open the doors (the core paid loop)

| Env var | System | Unlocks / degrades to |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Core DB. **Required.** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Browser client (RLS). **Required.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server/webhook client. **Required.** Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Platform | Prod origin for auth redirects, OG, sitemap. Default to kaldrtech/teamthickandfit hosts; **set both to the real domain at cutover.** |
| `STRIPE_SECRET_KEY` | Stripe | **Arms the paywall** (auto-activates the moment this lands). Degrades to: paywall off, app open. |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Subscription/entitlement sync. Degrades to: webhook returns 503. |
| `STRIPE_PRICE_LOW` | Stripe | $19.97 tier. (`STRIPE_PRICE_ID` is a legacy single-price fallback for this.) |
| `STRIPE_PRICE_MID` | Stripe | Mid-ticket tier. |
| `STRIPE_TRIAL_DAYS` | Stripe | 3-day trial length. |
| `OPENROUTER_API_KEY` | OpenRouter | Coach chat + plan-gen + text-to-macro. Degrades to: `notConfigured`. |
| `GEMINI_API_KEY` | Google | Free photo-to-macro tier. |
| `USDA_API_KEY` | USDA | External food lookups (macro accuracy). |
| `RESEND_API_KEY` + `RESEND_FROM` | Resend | Transactional email (signup, reset, dunning). Domain must pass SPF/DKIM/DMARC. |
| `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` | Mux | Workout video playback + upload. |
| `CRON_SECRET` | Platform | Gates all `/api/internal` cron routes + the cron-register jobs. Already rotated. |

### Recommended (should be set before real users)

| Env var | System | Unlocks |
|---|---|---|
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Error monitoring. |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | PostHog | Product analytics. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | Web Push | Push reminders. Degrades to: no push, in-app notices still work. |
| `ADMIN_PASSCODE` | App | Admin-route second factor. |
| `NEXT_PUBLIC_OAUTH_GOOGLE` | Supabase Auth | Shows the Google sign-in button. |

### CRM / GHL + waitlist

| Env var | System | Unlocks |
|---|---|---|
| `GHL_API_KEY` / `GHL_API_TOKEN` / `GHL_LOCATION_ID` | GoHighLevel | CRM sync + opportunity pipeline (the new `tf-ghl-sync-6h` cron). |
| `GHL_WAITLIST_WORKFLOW_ID` + `LEAD_MAGNET_URL` | GoHighLevel | Waitlist drip. |

### Phase-3 / trailing

| Env var | System | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` (+ auth token, messaging SID) | Twilio | SMS. Gated on GHL ID verify + 10DLC. Not launch-critical. |

### Platform-injected (no action — Vercel/runtime sets these)
`NODE_ENV`, `NEXT_RUNTIME`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION`.

---

## C. Go-live deploy sequence (engineering, ~1–2 days once A + B exist)

1. ~~**Ship the hardening branch.**~~ **DONE 2026-07-21** — 21 review-fix + launch-prep commits
   merged into `main` (fast-forward) and pushed; Vercel auto-deployed. Migrations `0083`/`0084`/`0085`
   applied to the live DB. The coach-chat P0 fix was verified LIVE in prod (stream closes ~3.5s, the
   assistant reply persists). The current prod code is now the fixed code.
2. ~~**`phase-2` → `main`**~~ — confirmed no-op; skipped.
3. ~~**Deploy**~~ **DONE** — pushed to origin/main; deploy landed and verified via prod health +
   the live chat probe. (Reminder for future deploys: `git push` only; never also run
   `vercel deploy --prod` — double-builds, and Hobby caps crons at 1/day, which has frozen prod.)
4. **Apply `supabase/deploy/cron-register.sql`** once the app is live at the prod URL:
   - Substitute `__APP_URL__` (e.g. `https://www.teamthickandfit.com`) and `__CRON_SECRET__` (the
     exact Vercel value). Never commit the substituted file.
   - Registers 6 jobs: reminders (hourly), renewals (14:00), checkins (15:00), insights (08:00),
     close-challenges (09:00), **ghl-sync (every 6h)**.
   - Verify: `select jobname, schedule, active from cron.job where jobname like 'tf-%';` then confirm
     a `cron_job_log` row after the first run.
5. **Run the launch-gated one-off jobs:** the 256-client Lenus invite batch, the Spanish AI
   bulk-fill + human review, the Mux demo import.
6. **Deploy-verification checklist:**
   - `vercel ls --prod` → status READY, commit hash matches.
   - `GET /api/v1/ping` → 200.
   - Sentry: no new error spike in 5 min.
   - `supabase db diff` → 0 (types regenerated + committed if a migration shipped).
   - Run `.qa-visual/rls-isolation-test.cjs` (RLS has leaked 3× historically).
7. **Optional pre-ship:** one `/audit` (Fort Knox) + `launchproof:run` across all three roles.
   Today's review + the hardening commits already cover most of this surface.

---

## D. Explicitly cut for launch (do not let these hold you up)
Coach payouts / Stripe Connect rev-share · white-label branding · in-app broadcast send (GHL handles
blasts) · automated dunning *sequences* (single failed-payment notice ships; multi-step recovery is
fast-follow) · multi-currency / LATAM local pricing · native app + Apple Health · high-ticket $3k+
financing (WAP/Fanbases) · live streaming. All Phase 3.

---

## E. Post-launch follow-ups (safe to trail; tracked)
- **Wire the Supabase `Database` generic** into the three clients + fix the 20 surfaced type sites
  (retires ~207 hand-casts; a tracked task with the exact sites already exists).
- **Chargeback evidence-packet automation** — the dispute handler now flags + alerts operators; the
  auto-assembled evidence packet (consent rows + service-delivery timestamps + payment history) is
  the next build.
- **Self-serve refund flow** — the `/about` page promises prorated refunds; today they are a manual
  Stripe-dashboard action. Add an operator refund action so the promise is self-served + audit-logged.
- **Automated dunning sequence** — beyond the single failed-payment notice now shipping.

---

## The honest recommendation
Open the doors on the **core paid loop** (sign up → pay → train → track nutrition → progress) the day
**Stripe + demo videos + domain** are live. Let the **AI coach trail by days** and switch on when
Shakira's knowledge base lands — it is still Phase 2, just sequenced last. Gating the entire launch on
the knowledge base is optional, not required.
