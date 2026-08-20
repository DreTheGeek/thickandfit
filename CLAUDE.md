@AGENTS.md

# Thick & Fit, Project Handoff & Claude Code Guide

## What This Is
Thick & Fit is a creator-led, bilingual (EN/ES) fitness coaching app for Stephanie Pantoja's
audience of women across the US and Latin America. Structured workouts with her filmed demos,
the most accurate low-friction nutrition tracking in the category, a living community, and an AI
coach in her voice. One-line category: creator-led bilingual fitness coaching app.

**Live at:** www.teamthickandfit.com (planned)
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
| Database | Supabase Postgres + pgvector, RLS on every table (PostGIS deferred: install only when the restaurant-locator scope in Gap Log #7 is confirmed) |
| Auth | Supabase Auth (email/password + Google + Apple + Magic Link) |
| Realtime | Supabase Realtime |
| Payments | Stripe, single account (NOT Connect: see note below) |
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

## Branch Map: ABANDONED, everything is on `main` (measured 2026-08-19)

The phased-branch model below was the plan and is not what happened. Measured, not remembered:

| branch | last commit | behind main | unique commits |
|---|---|---|---|
| `main` | 2026-08-19 | - | production, everything |
| `phase-2` | 2026-07-02 | 498 | 0 |
| `phase-3` | 2026-06-21 | 641 | 2 (a merge and a revert) |

Phase 2 and Phase 3 work (nutrition, community, AI coach, gamification, MCP) shipped straight to
`main`. Both branches are stale and hold nothing `main` lacks. **Following the steps below would
branch a new feature off a two-month-old tree**, which is the only reason this section is still
here rather than deleted: the instruction was live long enough that it may be in someone's habits.

Build on `main`. A PRD header's `Branch:` field is a record of the original plan, not an
instruction. Delete `phase-2` and `phase-3` when someone is confident nothing references them.

<details><summary>The original policy, superseded</summary>

- `main` = Phase 1 (PRD-00 through PRD-12). This is production.
- `phase-2` = Phase 2 (PRD-13 through PRD-30). Do not merge to main until Phase 1 ships.
- `phase-3` = Phase 3 (PRD-31 through PRD-47). Do not merge until Phase 2 ships.

1. Read the PRD header `Branch:` field.
2. `git branch` to confirm you are on the correct branch.
3. If the PRD targets phase-2/phase-3: `git checkout main && git pull`, then
   `git checkout <phase> && git rebase main` (or rebase onto the prior phase) BEFORE building.
4. Never push Phase 2/3 code to main until that phase is ready to ship.

</details>

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

## Site Visibility (pre-launch gate)
Rodney, 2026-07-30: the marketing site stays out of public view until doors open Sept 27. The
launch is two funnels: the waitlist (Aug 4) and the main app signup (Sept 27).

**CURRENT STATE (2026-07-30): the site is FULLY LIVE. Both switches are OFF in Vercel prod.**
Dre took the site public on 2026-07-30, ahead of the Aug 4 / Sept 27 dates below. The marketing site
is publicly visible and the waitlist is accepting real signups now. The gate CODE stays in place and
is inert; re-darkening is an env var, not a revert.

TWO INDEPENDENT SWITCHES, because the two funnels were scoped to open on different dates.
`src/lib/launch/prelaunch.ts` holds both lists. Both default OFF, so deploying the code darkens
nothing by itself.

| switch | closes | originally scheduled |
|---|---|---|
| `PRELAUNCH_WAITLIST_CLOSED=1` | `/join*` (the waitlist funnel) + `/api/funnel/signup` | open Aug 4 |
| `PRELAUNCH_HIDE_SITE=1` | `/` `/about` `/faq` `/pricing` `/vs/*` (+ every `/es` twin) | open Sept 27 |

- Both off (now): everything public, `/soon` still exists but nothing points at it.
- Both on: the whole public surface 307s to `/soon`, a bare holding page.
- Only `PRELAUNCH_HIDE_SITE`: marketing 307s to `/join`. Marketing dark, waitlist live.
- ALWAYS LIVE: `/soon`, `/api/*` (except funnel signup while closed), `/auth/*`, legal (`/terms`
  `/privacy` `/disclaimer` - App Store review and CAN-SPAM need these reachable), `/support`, the
  authed app, and the `admin.` host. Login always works, so the team can test while dark.
- Team preview: visit `/?preview=<PRELAUNCH_PREVIEW_TOKEN>` once; it sets a 30-day cookie that
  bypasses BOTH switches, including the signup API, so the full funnel stays testable while closed.
  Rotating the token invalidates every existing preview cookie.
- `/soon` must never be gated. Every gated path redirects there, so gating it is an infinite redirect
  on the only reachable page. `isGatedPath` checks it first; the test asserts it in all four modes.
- Adding a new public marketing page? Add it to `GATED_PATHS` or it ships visible.
- Closing the page is not closing the funnel: `/api/funnel/signup` creates the lead, the GHL contact
  and the referral code, so it enforces the flag itself. A page redirect alone leaves it POSTable.
- Cost to know about: hidden pages get de-indexed while dark, so the `/vs/*` comparison pages and
  the AEO work restart their indexing clock when the site goes live. Accepted deliberately.
- Verify after flipping either switch: `node .qa-visual/prelaunch-gate-test.mjs` (unit, 139 cases)
  then curl the real matrix on prod. A gate is not proven by the flag being set.

## Starter program on signup (`STARTER_PROGRAM_ID`) — built, OFF

Nothing in this app assigns a training program automatically: a plan reaches a member only when a
coach opens the console. `/coach/awaiting` exists to keep the "Steph writes your plan by hand"
promise visible and `OVERDUE_DAYS = 3` concedes it slips. The cost is that a woman who pays on
Tuesday can still be waiting on Friday with 40 imported programs sitting in a library she cannot
reach, and nobody is reading that queue during a holiday.

`src/lib/programs/auto-assign.ts` closes it, and is **inert until `STARTER_PROGRAM_ID` is set to a
plan uuid** in Vercel. Absent var = off, same shape as the scan flag below. It runs at onboarding
completion, verifies the plan belongs to this company, and **never overrides a coach**: a member who
already holds any plan assignment is skipped.

**Flipping it on is a product decision, not a config change.** It makes "she writes your plan by
hand" a half-truth, so the member-facing copy in `first-steps.tsx` (`programNote`) and on the
checkout page should be revisited in the same change. The honest framing is "here is your starting
week, Steph is personalising it", which is both true and better than silence.

It takes an ID rather than matching on her onboarding answers (goal, experience, gym or home) on
purpose: choosing well requires seeing the 40 programs, and a name-pattern matcher written without
looking at them would be a guess. A matcher can replace the lookup later without touching the call
site in `/api/onboarding/submit`.

| flipped | plan | by |
|---|---|---|
| not yet | — | built 2026-08-13, off |

## Scan auto-accept (`NEXT_PUBLIC_SCAN_AUTO_ACCEPT`)
Confidence-gated auto-logging: a scan where EVERY item is matched and >= 0.9 confidence is logged
without the confirm screen, with an Undo. Built in PRD-D and shipped **OFF** (absent env var = off).
No mainstream competitor does this, which is both the opportunity and the reason for the gate.

**Do not flip it on vibes.** Flip only when, for the ACTIVE `AI_MODELS.smartScan` model on the
expanded gold set: eval F1 >= 0.8, portion MAPE <= 0.25, and the |mean fat bias| baseline is KNOWN
(not necessarily small, but measured). Record the numbers and the date here when you flip it.

Fat bias is reported by `pnpm eval:scan` as a SIGNED number, overall and for oil plates. Negative
means underestimating, which is the July 2026 NIH/NIDDK finding (~250-345 kcal/meal missed, ~30g of
invisible fat). Decision rule for the future prompt-tuning PRD: |mean bias| > 8g on oil plates means
the mandated "cooking oil" prompt line is not enough. It is deliberately NOT a pass bar yet: never
tune a threshold and the metric that measures it in the same change.

| flipped | model | F1 | MAPE | mean fat bias (oil) | by |
|---|---|---|---|---|---|
| not yet | openai/gpt-5 | 0.892 | 19% | **n/a, no fat-labeled cases yet** | baseline 2026-07-31, run f7d1d319 |

**Eval run-to-run variance is real. Do not read a single run as a verdict.** Three runs on 2026-07-31,
same 12 cases, same model, prompt change confined to the clarify string (which meal cases never use):

| run | prompt | F1 | MAPE | pass |
|---|---|---|---|---|
| f7d1d319 | v2 | 0.892 | 19% | 11/12 |
| f8aea2dc | v3 | 0.878 | 21% | 11/12 |
| f3a321ea | v3 | 0.925 | 18% | 11/12 |

The v2 number sits BETWEEN the two v3 runs, and individual cases moved in both directions, so the
spread is noise (roughly +/-0.025 F1) rather than signal. Pass rate held at 11/12 throughout, which
is why it is the metric to trust on a 12-case set. Before attributing an F1 move to a change, run it
at least twice; a 0.02 swing on this set proves nothing.

Baseline run 2026-07-31 against prod: 11/12 pass (92%), avg score 86, avg 14.5s. F1 0.892 is just under
the 0.8 bar's comfortable margin and MAPE 19% already clears 25%, so the ONLY thing blocking a decision
is the fat baseline, and that needs the labeled high-fat gold set (PRD-D D2) which is a human
deliverable: 10-15 photos of pan-fried protein, dressed salad, restaurant plates, avocado/nuts and
visible-oil stir fry, each with a `total_fat_g` and `oil_used` in the manifest. Until those exist the
eval correctly reports fat bias as n/a rather than a fabricated 0.

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
| CRON_SECRET | 2026-07-03 | Claude (launch hardening) | rotated to align Vercel prod + pg_cron registrations; old value unrecoverable (encrypted) |
| Supabase `smtp_pass` (Resend key) | 2026-07-30 | Claude (email restore) | new sending-only key `supabase-smtp-2026-07-30`; the previous value was cleared by a partial auth-config PATCH and is unrecoverable (the Management API returns it masked) |

## Supabase auth security posture (audited 2026-08-01)
Enabled via the Management API, verified by observed behaviour, not by the flag reading true:
- `password_hibp_enabled: true` - rejects passwords found in known breaches (HaveIBeenPwned,
  k-anonymity so the password never leaves Supabase). Verified: "Password123!" -> 422 weak_password,
  a strong unique password -> 200. Credential stuffing is the realistic attack on a consumer app, and
  this beats complexity rules, which is also current NIST guidance. `password_required_characters`
  is deliberately left null for the same reason.
- `security_update_password_require_reauthentication: true` - the current password is required before
  it can be changed. Without it, a hijacked session changes the password and locks the real owner out.
- `mfa_totp_enroll_enabled` / `verify` already true. Worth turning on for OPERATOR accounts before
  launch: those four accounts can see all revenue and all member PII.

STILL OFF, and it needs a Cloudflare secret: `security_captcha_enabled`. Supabase-native captcha
protects the AUTH endpoints (signup, signin, password reset, OTP), which the route-level Turnstile in
`/api/funnel/signup`, `/api/waitlist` and `/api/support/ticket` does NOT cover, because those are our
own Next.js routes. Once TURNSTILE_SECRET_KEY exists, set `security_captcha_enabled: true` +
`security_captcha_provider: 'turnstile'` + `security_captcha_secret` to close the auth surface too.

**Any auth-config PATCH: re-assert `rate_limit_email_sent: 30` in the same call and diff the SMTP
group afterwards.** See the two traps below.

## Auth email: two config traps that cause outages
1. **A partial PATCH to `/config/auth` CLEARS the rest of the SMTP group.** Sending only
   `smtp_admin_email` nulled `smtp_host`/`smtp_port`/`smtp_user`/`smtp_pass` and took email down. Always
   PATCH the WHOLE block together: host, port (as the STRING `'465'`), user, pass, admin_email,
   sender_name, `external_email_enabled`. Non-SMTP keys (`mailer_otp_exp`) are a separate group and are
   safe to patch alone.
2. **`rate_limit_email_sent` silently reverts to 2/hour.** It reset during the SMTP patch above, and
   2/hour is low enough that the 3rd invite in a batch fails with "email rate limit exceeded". Re-assert
   `rate_limit_email_sent: 30` after ANY auth-config change, and re-check it before a launch send.

Sending domain is `teamthickandfit.com` (verified 2026-07-30). `thicknfit.kaldrtech.com` was REMOVED
from the Resend account on ~2026-07-24, which is what broke every auth email until this was found: the
sender pointed at a domain the account no longer had. Resend requires, on `send.<domain>`, an MX to
`feedback-smtp.us-east-1.amazonses.com` (10) plus a TXT of LITERALLY `v=spf1 include:amazonses.com ~all`.
DNS is GoDaddy; disable its SPF-merge for that record or it rewrites it to a `_spfm` indirection and
verification fails. Still TODO: no DMARC record on `_dmarc.teamthickandfit.com`.

## Payments: plain Stripe, and the Square question (settled 2026-08-04)

**There is no Connect code.** This file said "Stripe Connect Standard" for months and it was never true:
`Stripe-Account`, `/v1/accounts`, `account_links`, `transfer_data`, `application_fee` and
`on_behalf_of` return zero hits across `src/` and `supabase/`. It is a single-account integration:
`src/lib/billing/stripe.ts` is a hand-rolled 252-line REST client over `fetch` with its own form
encoder and HMAC signature check, no SDK. Anyone sizing a payments change off the old line would have
badly overestimated it.

**Square was evaluated and rejected.** Square is genuinely cheaper (3.5% + 15c card-on-file, no
chargeback fee, vs Stripe's 2.9% + 30c + 1.5% international + 0.7% Billing), worth roughly $540/yr at
265 low-tier subscribers. It loses anyway on one variable: **Square has no LATAM presence and one
presentment currency.** A US Square account charges USD only, so a Guadalajara member sees `$24.97
USD` and eats her issuer's FX. Square has merchant accounts in 8 countries, none in Latin America;
Stripe has 46 including Mexico and Brazil, and 135+ presentment currencies. Cross-border
authorization runs 5 to 15 points below domestic in the region, and on a subscription a decline is a
lost member, not a lost sale. The fee saving is smaller than one bad month of involuntary churn.

Square also has no dunning engine: no smart retries, no card account updater, no proration, no hosted
portal, and ACH cannot be stored and charged later. `entitlement.ts` gates on `active | trialing` and
the webhook handles `invoice.payment_failed` and `customer.subscription.trial_will_end`; neither has a
Square equivalent. Migration is 1,375 lines of `src/lib/billing/`, 90 Stripe-referencing files, 8
`stripe_*` column families across 4 tables, and a 170-line webhook covering 8 event types.

Revisit only if Square opens a Mexican merchant account with local presentment, or if Stripe
restricts the account (in which case the answer is Braintree/Adyen/Paddle, not Square, which is
quicker to hold funds). If a physical surface ever appears (studio, retreat, merch), run Square for
card-present and keep every subscription on Stripe. **Split by surface, never by customer.**

The real LATAM lever is not the processor: add MXN/COP via `currency_options` on the existing Price
objects, confirm Smart Retries and the card updater are on (the 0.7% Billing fee is already being
paid), and instrument authorization rate by issuing country.

## The advertised trial is an env var, not a build

`/vs/cal-ai` and `/vs/fitia` say "Start 3 days free. No card to start." Both halves are currently
false, in different ways, and they fail differently:

- **The trial is built and switched off.** `trialDays()` in `src/lib/billing/actions.ts` reads
  `STRIPE_TRIAL_DAYS`, defaults to 0, and `encodeForm` drops the key so no trial is sent. The var is
  NOT set in Vercel production (checked 2026-08-04). Turning the trial on is one env var.
- **"No card to start" stays false even then.** Stripe Checkout in subscription mode collects a card
  regardless of `trial_period_days` unless `payment_method_collection: 'if_required'` is set, and it
  is not. Setting it also means the trial can end with no card on file, which is a different product
  decision. Do not fix the copy by flipping the env var alone.

## "At risk" now means two different things, and they are not the same people

Until 2026-08-14 every use of "at risk" in this app meant BILLING: `isAtRisk` in
`src/lib/coach/overview.ts` reads `client_subscriptions.status` (`past_due`, `unpaid`) and
`billing_health` (`lapsed`, `due-soon/late`). The coach home tile, the attention chip and the 9pm
recap all read that one definition, correctly. Its limitation is not accuracy, it is timing: a
declined card is the LAST event in a churn. She decided weeks earlier.

`src/lib/engagement/` is the earlier signal, built from activity rather than payments. **Both chips
can be lit at once and they describe different women.** When you touch either, keep them distinct —
the failure mode is someone "simplifying" them into one number that means neither thing.

| | reads | fires | surface |
|---|---|---|---|
| billing risk | subscription status + `billing_health` | card declines | `/coach/billing`, `attention_atRisk` |
| engagement risk | workouts, food, weight, habits, check-ins, her messages | she stops showing up | `/coach/quiet`, `attention_quiet` |

- **Thresholds live in `risk-shared.ts`** (7 / 14 / 28 quiet days; weak first month = fewer than 4
  workouts, evaluated days 21-30). They are round numbers, not tuned ones. Tuning needs churn
  outcomes this app has not collected yet — revisit when there are cancellations to score against.
  49 boundary assertions: `npx tsx .qa-visual/engagement-risk-test.mts`.
- **Precedence is not the declaration order.** ghost > at_risk > weak_start > slipping. A member can
  satisfy several at once and must appear on the queue exactly once, under the description that
  changes what the coach does.
- **"Last active" takes two sources.** `user_streaks.last_active_on` is one row per member and
  covers all history, but it is only written when she opens `/dashboard` or `/you` and it counts
  three things. The sweep takes the MAX of it and a 30-day window over six activity tables. Neither
  source can make a member look quieter than she is, which is the direction that matters.
- **Profile-keyed only.** Migrated Lenus members who have not claimed an account have no profile,
  cannot log and cannot be notified. Reading contact-keyed history here would put 250 women who have
  never opened the app at the top of a churn queue on day one. Their queue is `invite-legacy`.
- **The ladder ships ON, unlike the other two flags in this file.** Three in-app + push messages at
  7 / 14 / 28 quiet days, bilingual, once per rung per quiet spell (the dedupe asks "since she was
  last active", not "ever", so a member who returns and lapses again gets it again). It rides the
  existing daily `notify-checkins` cron rather than a new pg_cron entry, deliberately: a feature
  whose purpose is to work while nobody is watching must not depend on someone remembering to
  register a schedule. There is no kill switch beyond reverting; if one is wanted, gate
  `generateReengagementNudges` on an env var the same way `STARTER_PROGRAM_ID` gates auto-assign.
- **Three ways to fall off this queue silently, all now closed, all found by re-reading rather
  than by a test.** Each removed a real member from the only list that would have reached her, and
  a member vanishing off a churn queue looks exactly like a member who is fine.
  1. *Cancelled members were on it.* Nothing demotes `profiles.role` when a subscription ends, so
     she is still `subscriber`, still onboarded, and extremely quiet. `hasDepartedGrants` drops her.
     It is inert until Stripe is configured, deliberately: pre-Stripe nobody can have cancelled.
  2. *A resumed pause read as a departure.* Resuming revokes the pause grant rather than deleting
     it. For a member with a Stripe grant the live one outvotes it; for a migrated Lenus client with
     no entitlement row at all, that `revoked` row is her ONLY grant. `purchaseGrantStatuses` strips
     the pause bookkeeping (`pause:<profileId>`, defined once in `status-shared.ts`) before the test.
  3. *The ladder re-sent rung 28 every 90 days.* The send history was read through a fixed 90-day
     window; the ladder has no upper bound (rung 28 is `>= 28`), so a ghost's day-28 message aged out
     and she was told again that a coach would reach out personally. The lookback is now the oldest
     `quietSince` in the cohort — exactly the anchor the dedupe compares against. Because that is
     unbounded in time it carries a 5,000-row cap that FAILS rather than sends: a truncated history
     reads as "nothing sent", which is the same bug wearing a success code.
- **The day-28 message promises a human.** "Your coach is going to reach out personally." What makes
  that true is `/coach/quiet` being read, exactly as `/coach/awaiting` is what keeps "Steph writes
  your plan by hand" honest. If that page stops being read, the message becomes a lie.
- **Deliberately NOT in the 9pm ops-bot recap.** The recap is Deno and cannot import from `src/`, so
  adding it would mean re-implementing the whole sweep — six tables, two "last active" sources and
  the classifier — in a second language, and this file already documents where that goes. Revisit
  only with a shared SQL view both sides read.
- Cost: `getAttention` now runs the sweep (~9 queries) on every coach home load. Fine at 270
  members. If the roster reaches thousands, materialize it nightly next to `user_state` instead.

## The Aug 13 call: what shipped, and the four switches it left off

The [2026-08-13 call](https://fathom.video/calls/784517045) named the Lenus failures she is leaving
behind, and several were answered on the call as already built when they were not. Commits `b3b71c7`
through `d80152a` close them. **Four things are built and inert until someone sets a value** — the
same shape as `NEXT_PUBLIC_SCAN_AUTO_ACCEPT`, and each is a product decision, not a config chore:

| var | effect when set | who decides |
|---|---|---|
| `STARTER_PROGRAM_ID` | every new member gets a program at onboarding | Dre picks a plan uuid |
| `STARTER_MEAL_PLAN_ID` | team/steph tiers also get a meal plan | Dre picks a template uuid |
| `COACH_AI_DAILY_LIMIT` | AI coach questions per day (default 20) | Stephanie — she said 3 |
| `coach_settings.training_followup` | plan-expiry reminders fire | Stephanie, in the UI |

`STRIPE_TRIAL_DAYS` is a fifth, documented above.

- **The `past_due` chain was the P0.** A declined card had no fix anywhere: `requireEntitled` ejected
  her to `/checkout`, and `startCheckoutAction` read her subscription only for the customer id, so it
  would have sold her a SECOND subscription. Now `/api/billing/portal` + a `past_due` mode on
  `/account/billing`, and checkout refuses when `LIVE_SUBSCRIPTION_STATUSES` matches.
- **Three status lists live in `status-shared.ts`** with the reason they are not one list. Collapsing
  any two is the failure that file is arranged to prevent: `isActiveStatus` includes `past_due`,
  `isActiveEntitlementStatus` excludes it, `LIVE_SUBSCRIPTION_STATUSES` includes `unpaid`.
- **`routeForEntitlements` is the whole access routing table**, four outcomes, and `paused` outranks
  `past_due`. Both `pastDueOnly` and `isPaused` delegate to it so they cannot disagree.
- **Check-in reminders moved to the hourly `notify-reminders` route** and now read the seven
  `coach_settings` columns that had a UI and no reader. Her cadence is bi-weekly, not the hardcoded 7.
  Both route names stay: renaming a target pg_cron points at is how a cron silently stops.
- **Coach-addressed notifications now exist** (`plan_expiring`). `notifications` is profile-keyed and
  coaches have profiles, so this needed no schema change.
- **The plan-renewal queue reads only a member's NEWEST assignment.** `plan_assignments` has no
  status column, no unassign and no archive — the table only grows, and the app already treats the
  newest row as "your program" (`getAssignedPlans` orders newest-first, `/workouts` renders
  `plans[0]`). The queue's window is open-ended on the past side on purpose (an expired plan is the
  case it exists for), so walking every assignment turned it into an archive of everything that had
  ever ended, one coach notification each, with no action that could clear a row. Relatedly,
  `assignProgram` now writes `assigned_at` explicitly: the table is `UNIQUE(plan_id, profile_id)`, so
  re-running a client through a block she has done before is an UPDATE, and omitting the column left
  the old date — pinning her at "week 12 of 12" on `/workouts` and stranding the plan on the queue.
- **A paused member keeps `/workouts` (history), not `/workout/[planId]` (the session).**
  `requireEntitledOrPaused` returns `onBreak` so the page cannot forget to close the program half.
  `/paused` lists what she keeps; every link on it must actually open, and the first version linked
  `/history`, which redirects to `/workouts`, which bounced her back to `/paused`.
- **Pauses are migration 0140.** Read-only: her records stay, the paid surface closes, `/paused`
  instead of a paywall. It deliberately does NOT touch Stripe — some of her pauses are unpaid breaks
  and some are paid holds. Auto-resume runs first in the daily job and the engagement sweep excludes
  paused members, or the app spends her break telling her she has gone quiet.
- **`plans.archived_at` is migration 0141.** She said delete 17 of 40; `plan_assignments` references
  them and clients are mid-program, so `scripts/archive-retired-programs.mjs` archives instead and
  dry-runs by default, printing assigned-client counts for her to confirm.
- **Still not verified in a browser by anyone.** Section 1 in particular cannot be: it needs a live
  Stripe key and a test decline.

**Two things only Stephanie can do**, and the second blocks the first: generate the Stripe secret key
(every money figure in the admin portal is a Lenus-migration artifact until she does, which is why she
flinched at $16k MRR on the call), and answer what the low tier's daily AI question count should be.

**Deliberately NOT built: per-tier AI limits.** `contacts.product_type` carries two incompatible
vocabularies at once — the Lenus migration wrote `bootcamp`/`personalCoaching`/`basic`/`solon`, new
signups write `Self-Guided`/`Team Thick & Fit`/`1-on-1 with Steph` — and nothing in the repo says
which Lenus value is which tier. Guessing would cap a woman paying for 1-on-1 coaching at the free
number. Settle the mapping with her before wiring it.

## 0140 to 0143: APPLIED 2026-08-19, and what they had been silently breaking

All four were written on 2026-08-14, shipped as code to `main`, and never run against the database.
Applied and verified 2026-08-19. Keep the notes below: the reasoning is still the reasoning, and the
five days they sat unapplied are the useful part.

**What "shipped but unapplied" actually looked like, because none of it threw.** Every call site
fails open (`console.error` then `return []`), so there was no error page anywhere and no Sentry
spike. Instead:

- Her whole 41-program library read as EMPTY in `/coach/programs` and in the assignment picker,
  from 2026-08-14. A coach opening `/coach/awaiting` to keep the "Steph writes your plan by hand"
  promise had nothing to assign.
- `getEngagementSweep` selects `assigned_coach_id`, so it returned zero rows. That one function
  feeds `/coach/quiet`, the attention chip AND both nudge ladders, so the daily cron ran, logged
  success, and sent nothing to anyone.
- `/coach/subscribers/[id]` read the same column, got null, and called `notFound()`. Every
  app-signup member record 404'd.
- The pause feature was dead at the CHECK constraint.

**0144 was the same story, found 2026-08-20.** `seasonal_campaigns` had never been created, so
`generateSeasonalCampaigns` (the third of the three automated senders) read a table that did not
exist and failed open. Applied and verified; the table is empty and every row defaults to inactive,
which is the design.

**There is now a guard: `node .qa-visual/schema-applied-test.mjs`.** It parses every CREATE TABLE and
ADD COLUMN out of `supabase/migrations/` and asserts each one exists in the live database, exiting
non-zero when it does not. Run it after any migration and before any launch. It currently reports
132 tables and 55 added columns, all present. `tenant-boundary-test.mjs` reads the SQL FILES and
passed throughout both incidents: that one checks what the migrations SAY, this one checks whether
anybody ran them.

**The lesson is not "remember to apply migrations".** It is that this app's fail-open convention,
which is right for a single unreadable table, turns an unapplied migration into a console that looks
calm and is lying. A migration that ships with its code and not with its schema has no failing test
anywhere. `node .qa-visual/tenant-boundary-test.mjs` reads the SQL FILES, not the database, so it
passed throughout.

Verified after applying: `paused` in the entitlements CHECK, `plans.archived_at` present with 41
plans visible, `auth_company_id()` SECURITY DEFINER, `coach_coverage` with RLS on and one policy,
`profiles.assigned_coach_id` present and the sweep returning rows again.

**On 0142's stated trap: the auth hook IS configured.** `hook_custom_access_token_enabled = true`,
pointing at `public.custom_access_token_hook` (checked via the Management API 2026-08-19). So the 70
policies that scope through `current_company_id()`, which reads the JWT claim ONLY with no fallback,
do resolve. Do not assume that from this line alone if the hook is ever touched: it is the single
point of failure for those 70, and `auth_company_id()` (with its `profiles` fallback) is the safer
shape for anything new.

Original notes, still accurate. `.planning/RUNBOOK-2026-08-14.md` steps 1, 1b, 1c. Apply in number order: 0143's RLS policy calls
`auth_company_id()`, which 0142 creates.

- **0140 / 0141** — the `paused` entitlement status and `plans.archived_at`. Until 0140 lands,
  `pauseMemberAction` fails at the CHECK constraint and the whole pause feature is dead code.
  (Applied 2026-08-19.)
- **0142 tenant boundary** — 21 policies granted on `is_coach()` with no company predicate. The
  trap: the obvious fix (`current_company_id()`) reads a JWT CUSTOM CLAIM injected by an auth hook
  that is a manual post-deploy step, so if it was never set the migration denies every coach read in
  the product. `auth_company_id()` prefers the claim and falls back to the caller's `profiles` row.
  **Verification is a browser step, not a SQL one**: a coach console that loads EMPTY means the
  helper returned null. `node .qa-visual/tenant-boundary-test.mjs` audits the SQL statically and
  fails on the next unscoped policy, in the diff.
- **0143 coach assignment + coverage** — additive. `profiles.assigned_coach_id` and `coach_coverage`.
  Resolver, reader, server actions AND the screens: the "Coach and access" card on the client record
  (also the first UI for pauses, which had a backend and no screen), `/coach/coverage`, the
  covering-for banner on `/coach`, and Mine/Everyone on `/coach/quiet` and `/coach/awaiting`. The
  filter is a URL parameter read on the server, and it stays HIDDEN until something is assigned —
  with the whole roster owned by the company, "mine" is an empty console. `coach_coverage.ends_on`
  is the LAST DAY AWAY, inclusive: "back on the 20th" is stored as the 19th.

## Three automated senders, and they must never reach the same woman

- `generateReengagementNudges` fires on QUIET days (7/14/28) and reaches someone who stopped.
- `generateLifecycleNudges` fires on TENURE (day 7/14/30/45/90) and reaches someone who did not.
- `generateSeasonalCampaigns` fires on the CALENDAR and is the only one that can address a whole
  cohort in a day. Migration 0144; the table ships EMPTY and every row defaults to inactive, so
  nothing sends until somebody writes a campaign on `/coach/campaigns` and switches it on. A
  malformed window fails CLOSED (sends to nobody), each campaign carries a tenure floor (default 14
  days) so a woman who joined on 20 December is not told on the 26th not to give up, and the
  audience choice (`all | active | at_risk`) reads `atRisk` off the same sweep the other two just
  used. It runs LAST in the daily job for that reason.

  **Windows are MM-DD and recur every year, and `ends_md < starts_md` means the window crosses New
  Year.** That case is the whole reason `isSeasonActive` exists: for `12-26 → 01-05` the obvious
  `start <= today && today <= end` is false on every single day it should be true. The dedupe year
  for the January side is the year the season STARTED, or a member gets the same message on 30
  December and again on 2 January. `npx tsx .qa-visual/season-test.mts`.

  **No seed campaign ships, deliberately.** Pre-writing a "December save" row would mean guessing
  Stephanie's offers, her voice and her numbers. The empty page names the two seasons worth writing
  first and leaves the copy to her.

## Two of those three overlap, and here is the rule

- `generateReengagementNudges` fires on QUIET days (7/14/28) and reaches someone who stopped.
- `generateLifecycleNudges` fires on TENURE (day 7/14/30/45/90) and reaches someone who did not.

The lifecycle skips anyone `isEngagementRisk`, and both run in the same daily job off the same
sweep so they cannot disagree about who she is. "You've been at this a month, look what you built"
landing on a woman who has not logged anything in three weeks proves nobody is looking.

The lifecycle's **grace window** (`[day, day + 7)`) is what makes it safe against an existing
roster: a member already 200 days in matches nothing. Without it, first run would have congratulated
256 migrating members on anniversaries that passed months ago — the same shape as the renewal-queue
archive. Dedupe is once EVER, not once per spell: nobody reaches day 30 twice.

## The advertised trial now reads the switch

The `/vs/*` pages used to say "Start 3 days free. No card to start." while `/faq` said "No free
trial" — the site contradicted itself, and both halves of the /vs claim were false. `STRIPE_TRIAL_DAYS`
is now read by `configuredTrialDays()` in `src/lib/billing/trial-shared.ts`, which BOTH the checkout
call and the marketing page use, so setting the var turns the offer and the sentence on together and
the page cannot drift from the product. "No card to start" was removed outright: Checkout collects a
card regardless of `trial_period_days` unless `payment_method_collection: 'if_required'` is set, and
setting that means a trial can end with no card on file — a product decision, not a copy fix.

## The 8.0 member portal: the two traps a green build does not catch

The member app is being re-skinned to `.planning/design_handoff/8.0/`. File A
(`client-portal.html`) is the CONTRACT; File B (`mobile-client-ui.html`) is a mood board with good
ideas and one liability (a screen carrying a named competitor's logo). Where their hexes disagree,
`globals.css` wins: it is the only one of the three with written reasoning per token.

The palette is scoped by `.tf-portal`, applied in exactly ONE place
(`src/components/app/subscriber-shell.tsx`). `git grep -c "tf-portal" src/` must stay at 1, or the
containment that keeps the coach console out of this is gone.

**Trap 1: the scope re-themes ROLES and silently inverts LITERALS.** `bg-surface` / `text-muted`
follow the palette for free. `bg-ink text-bg` is an inversion, not a role: correct on the light
palette (ink #0f0f0f, bg #e7e5df) and backwards inside the portal (ink #ffffff, bg #000000). Worse
is `bg-ink` beside a literal `text-white`, which renders white on white and is invisible rather
than merely wrong. **Nine instances were found and fixed, all shipped, all with a green build**:
the challenge card, the coach broadcast, the goal card on /you, the membership card on /account,
the support tab on EVERY portal screen, today's date in the week strip, the rest banner in the
workout player, and the Android install pill. `<Card dark>` is deleted rather than deprecated,
because leaving it is how the next one appears. Use `RaisedCard` from `portal/portal-chrome.tsx`,
or an explicit dark ground where the copy is white by design.

A filled CONTROL is the exception: `bg-ink text-bg` on a button is the handoff's `.btn-white` and is
correct in both palettes. The rule is about surfaces, not pills.

**Trap 2: `useTranslations` is the CLIENT hook.** A component that calls it and is rendered by an
async server page throws on every request, behind a 200 and the error boundary's "Something went
wrong". `tsc`, `eslint` and `next build` are all green: nothing about the call is statically wrong.
The workout preview shipped this way. Either mark the component `'use client'` or use
`getTranslations` from `next-intl/server`.

**Every one of these was caught by looking, not by building.** `node .qa-visual/portal-shots.mjs`
signs in as a real member against PRODUCTION, shoots eleven screens, and asserts per screen that the
page did not render the error boundary and does contain a marker of its own content. It exits
non-zero, so it is a test, not a gallery. Run it after any portal change.

    node .qa-visual/portal-shots.mjs              phone 390x844, English
    node .qa-visual/portal-shots.mjs --desktop    1280x900, where the rail replaces the bottom bar
    node .qa-visual/portal-shots.mjs --es         Spanish

Three things only the non-default modes showed: her wordmark was the BLACK svg on the dark rail, the
preview's sticky CTA ran the full 1280 while its content sat in the shell's 760 column, and
`(app)/loading.tsx` carried a `dark:invert` that never fires (the dark variant is `[data-theme="dark"]`
and `.tf-portal` is a class scope). **--es sets the ui_locale COOKIE and must do so AFTER sign-in**:
the middleware only defaults that cookie when absent, but the sign-in action then writes it from the
member's PROFILE, so setting it first yields an entirely English run that reports every screen green.

A fourth class the tool caught: a HYDRATION mismatch. /inbox threw React #418 on every visit because
message timestamps format with no timezone, so the server rendered UTC and the browser rendered hers.
Both halves are individually valid, so no build can see it. Timezone- and now-relative text carries
`suppressHydrationWarning`, which is what it is for.

The kit is `src/components/portal/`: `portal-chrome.tsx` (screen, header, tabs, button, media row,
stat row, meter, data row, raised card), `today-cards.tsx`, `train-cards.tsx`, `capture-sheet.tsx`.
It is deliberately free of `'use client'` so `you-screen.tsx`, an async server component, can consume
it. Nav lives once in `src/components/nav/tabs.ts`, consumed by both the phone bar and the desktop
rail, which had drifted to different tab sets.

## `rest_sec` held milliseconds, and the player counted them as seconds

Fixed 2026-08-20 (migration 0145), and worth keeping because the shape recurs: a UNIT bug in an
importer is invisible to every check this repo runs, and only becomes visible when some screen puts
the number in front of a person.

Her Lenus export carries `restTime` in milliseconds. `scripts/import-lenus-programs.mjs` wrote it
straight into `session_exercises.rest_sec`, so 1,454 of 1,458 prescribed rests were 1000x too large.
The player does `setRest(ex.rest_sec)` and ticks once a second: finishing a set of banded squats
(20000) opened a **five and a half hour** countdown with the audible timer never firing. Live since
the programs import, through a green typecheck, lint, build and the whole QA board.

It surfaced only because the new workout-preview screen estimated a session at "3,380 min" and the
number was absurd enough to chase.

**Fixed in three places on purpose**, because any one alone gets undone:
- **data**: 0145 divides and clamps to 600s. It REFUSES to run if any row sits between 601 and 999,
  where seconds and milliseconds cannot be told apart. That band is empty on the real data.
- **producer**: the importer divides now. STATE.md schedules it to re-run before her Lenus account
  closes, and it would have rewritten every row back.
- **consumer**: `src/lib/workout/rest.ts` normalises on READ, so a third mistake here cannot reach a
  member. `npx tsx .qa-visual/rest-normalize-test.mts` pins both sides of the threshold, the ceiling
  and idempotency (0145 already converted the table, so normalising a correct 90 must not halve it).

**The other imported units were checked and are FINE**, so nobody needs to redo it. `time_sec` looks
like the same bug (73 rows >= 1000, max 3000) and is not: 3000s is a 50 minute incline walk, 300s a
five minute one, and the values track the movement. `reps > 200` is eight rows of jump rope at 300 to
500 skips, which is a real prescription. `weight` tops out at 158.76, which is lb. `rest_sec` was the
only one.

## Tier Caps (check monthly)
Supabase edge invocations, Vercel function compute, Mux streaming minutes, OpenRouter spend,
Gemini free-tier limits. Document limits and deferral decisions here as they approach.
- Supabase auth email rate limit: 30/hour (raised from the 2/hour default on 2026-07-18 after a
  real user's password reset was silently 429'd). The true ceiling is the Resend plan's daily
  quota; if launch volume approaches it, raise the Resend plan before raising this limit again.
- Supabase storage `ai-scans/`: as of PRD-A this grows with FAILED scans too (noFood/clarify/error),
  not just successful ones, because those photos are the replay corpus for the next model. Revisit
  retention if the bucket approaches the storage tier cap. At client-downscaled JPEG sizes
  (~200-500KB) and 256 launch clients that is years away, so noting it here is enough.

## pg_cron Test Procedure
Each cron in the CRON-REGISTRY: run manually, check cron_job_log for a success row.

**Correction (2026-08-03): the GUC pattern this file used to describe was never in place and cannot
be.** `alter database postgres set app.service_role_key = ...` returns `42501 permission denied to
set parameter`, because the role available on hosted Supabase is not superuser. 13 of 14 cron bodies
were carrying the CRON_SECRET as a literal in `cron.job.command`, readable by anything with DB access
and needing a 13-place edit to rotate.

**Use Supabase Vault instead** (`supabase_vault` 0.3.1, already installed):

```sql
'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
```

The secret is stored once under `vault.secrets`; rotation is one `vault.update_secret` call. The two
recap crons use this. The remaining 10 still inline the literal and should move the next time each is
touched.

## The ops bot runs in Supabase, not Vercel
`supabase/functions/ops-bot/` holds the 9pm ET recap, the Telegram webhook, and the `/open /ticket
/resolve /progress /today /waitlist /scan /health` commands. Deployed `--no-verify-jwt` because
Telegram cannot present a Supabase JWT; each route authenticates itself instead, and adding a route
that skips that is the one way to break this.

**Why it moved.** On 2026-08-01 Vercel soft-blocked the project for a fluid-compute overage. pg_cron
fired 60 times, every call returned 402, the recap never sent, and `cron_job_log` recorded nothing at
all because the route that writes it never ran. The bot went silent exactly when something was wrong,
and silence reads identically to a clean night. A monitor must not share a failure domain with the
thing it monitors.

- Secrets live in Supabase function secrets (`supabase secrets set`), NOT Vercel. Vercel's copies are
  encrypted and `vercel env pull` returns them BLANK, so they cannot be migrated: budget on rotating
  any secret you need on both sides.
- `/health` reports integrations from real traffic (`ai_usage_log`, `ai_inferences`, `email_send_log`,
  `webhook_events`), not from env vars. A literal port of the old env-var check would have shown six
  red crosses, since those variables are in Vercel and this function cannot see them. It distinguishes
  quiet (normal pre-launch) from failed from never-seen.
- `sendTicketAlert` deliberately STAYS in the app: it fires in the request path of a ticket
  submission, so it is correctly in Vercel's failure domain. A ticket cannot be filed while the app is
  down, so there is nothing to announce.
- The DST arithmetic is covered by `.qa-visual/et-bounds-parity-test.mjs` (every hour of a year,
  against ground truth, not just against the old code). Getting it wrong is invisible until November.
- **Telegram group privacy mode hides plain text from the bot.** In a group a bot only receives
  messages starting with `/`, replies to it, or @mentions. A plain "hi" is dropped by Telegram BEFORE
  the webhook, and `getWebhookInfo` still reports a clean delivery with no error, so from the server
  side it is indistinguishable from nobody having sent anything. Cost a round trip on 2026-08-03 while
  bootstrapping the chat id. Always test with `/start`, never with plain text.
- A signup announces itself from a DB trigger (`notify_new_signup`, 0104), not from the signup code
  path, because a profile row can be created four ways and wiring it into one is how the next one goes
  silent. It swallows every error: it runs inside the account-creation transaction, so a fault there
  does not lose a message, it stops people signing up.

**Chat id `-5030283896`** (the ops group), stored as a Supabase function secret and mirrored in
`.env.local`. It is NOT recoverable from Vercel: encrypted vars there read back blank, and the Bot API
has no method to list a bot's chats. If it is ever lost again, the only route is the bootstrap branch
in `ops-bot/index.ts` plus a `/start` in the group.

---

## Read Order for New Engineers
1. This file
2. .planning/STATE.md
3. 00-research/COMPETITIVE-INTELLIGENCE.md + DOMAIN-RESEARCH.md
4. 01-foundation-docs/ (Discovery, Blueprint, Series Outline, Wiring Map)
5. Relevant PRD per feature
