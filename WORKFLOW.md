# Thick & Fit, Workflow Spec

The app/role/flow model that launchproof:run and launchproof:simulate drive off. Hand-written from
the codebase (the auto-scan needs the dev server bound; this is authoritative).

## What this app is FOR
A bilingual (EN/ES) creator-led fitness coaching app for Stephanie Pantoja's audience of women
across the US + Latin America. It converts her existing trust (562K followers, 256 paying clients)
into a retained subscriber base by fixing what competitors get wrong: nutrition friction, billing
distrust, dead communities, buggy players. Single-tenant today (Stephanie = company 1), architected
for white-label later (every table `company_id` + RLS).

## Critical path (must always work)
Sign up -> (walled until paid) -> pay (Stripe) -> onboard (profile + computed targets) -> accept the
health disclaimer -> reach the app -> log nutrition (photo / text / search) -> train (workout player)
-> track habits + check-ins + progress -> community -> message the coach. The AI coach (text, in
Stephanie's voice) augments throughout. Coach side: see clients + renewals, reply, approve mid-ticket
work, run community + challenges, feed the AI knowledge base.

## Roles (5-role RBAC; `src/lib/auth/session.ts`)
| Role | Surface | Gate | Can do |
|---|---|---|---|
| `subscriber` | app | entitlement (paid OR comp) + health disclaimer | the full member loop |
| `free` | app | comp access (time-boxed, coach-granted) | same as subscriber while comped |
| `coach` | /coach | `requireCoach` (in `COACH_ROLES`) | full console + **approver** |
| `assistant_coach` | /coach | `requireCoach` (NOT `requireApprover`) | draft mid-ticket work only; cannot approve |
| `operator` | /coach | `requireCoach` + `requireApprover` | console + approvals + assignments |

Guards: `requireAuth` (logged in) -> `requireEntitled` (subscriber: paid/comp + health-acked, else
`/checkout` or `/disclaimer`) -> `requireCoach` (coach roles) -> `requireApprover` (coach/operator
ONLY, excludes assistant_coach; the mid-ticket bypass-block).

## Surfaces (route map)
- **Public:** `/` (webflow landing), `/about`, `/join` (waitlist), `/join/thank-you`, `/auth/sign-in|sign-up|forgot-password`.
- **Subscriber app `(app)`:** `/dashboard`, `/nutrition`, `/community`, `/progress`, `/you`, `/workouts`, `/workout/[planId]`, `/coach-chat` (AI), `/inbox` (human coach DMs), `/checkin`, `/notifications`, `/account`, `/account/billing`, `/disclaimer`, `/claim` (legacy-client invite landing), `/onboarding`, `/checkout`.
- **Coach console `(app)/coach`:** `/coach` (business overview), `/coach/billing` (MRR + renewals), `/coach/clients` (256-client CRM), `/coach/leads` (GHL pipeline + Sync now), `/coach/inbox`, `/coach/community` (+ broadcast), `/coach/challenges`, `/coach/drafts` (assistant), `/coach/approvals` (approver), `/coach/assignments` (approver + payout), `/coach/programs`, `/coach/exercises`, `/coach/tool/recipes|recipe-books|meal-plans`, `/coach/forms`, `/coach/settings`, `/coach/settings/knowledge` (AI KB), `/coach/health`, `/api-docs` (internal, coach-gated).

## State machines (legal transitions)
- **subscription** (`subscriptions.status`): `trialing` -> `active` -> `past_due` -> `canceled`; `canceled` -> reactivate -> `active`. Entitlement is computed (active sub OR `comp_access_until` in the future).
- **approval_queue** (`status`): `pending` -> `approved` | `rejected`. ONLY the service role inside `decide()` (guarded by `requireApprover`) flips to `approved` + publishes; assistants cannot (no UPDATE policy + WITH CHECK forces `pending`).
- **coaching_assignment** (`status`): `active` -> `paused` -> `ended`.
- **form** (`status`): `draft` -> `published`; assigned -> `form_response` `submitted`.
- **challenge**: scheduled (`starts_on` future) -> active (`starts_on <= today <= ends_on`) -> ended.
- **health/legal**: `profiles.health_ack_at` null -> set (one-time gate before training content).

## Day-in-the-life

### Subscriber (the member)
Opens `/dashboard` ("HEY {name}", check-in nudge, habits to-do). Logs breakfast on `/nutrition`
(snap a photo, describe it in text, or search) -> macro rings update toward the personalized target
(onboarding-computed until a coach sets a meal plan). Checks off habits. Opens `/coach-chat`, asks
the AI coach a question (grounded in Stephanie's knowledge + the member's logs). Does today's workout
in the player. Posts a win to `/community`, reacts to a coach broadcast. Messages the human coach in
`/inbox`. On the due day, submits the weekly check-in form. Reviews progress photos + weight trend.

### Coach (Stephanie / operator)
Opens `/coach` (MRR $15.4K, active members, at-risk). Reviews `/coach/billing` renewals + failed
payments. Replies to client threads in `/coach/inbox` (unread clears on open). Reviews `/coach/approvals`,
approves an assistant's drafted message/meal-plan (publishes to the client). Posts a broadcast in
`/coach/community`, creates a `/coach/challenges` reto. Pastes method text into `/coach/settings/knowledge`
to ground the AI. Assigns assistants + rates in `/coach/assignments`.

### Assistant coach (Dani, mid-ticket)
Opens `/coach/drafts`, composes a message or meal-plan for an ASSIGNED client, submits for approval.
It is HELD (no publish) until an approver approves. Cannot reach `/coach/approvals` (redirected to
`/coach/drafts`); cannot self-approve (DB-enforced).

### Operator (white-label / Stephanie)
Manages `/coach/assignments` (assistant <-> client, monthly_rate_cents), reviews the per-assistant
payout rollup (active clients x rate, tracking only). Approves mid-ticket work like a coach.

## External plug-ins (config-gated, code complete)
Live Stripe + prices, OpenRouter (AI), Mux (workout video), Resend (email/invites), Sentry + PostHog
(monitoring), VAPID (push), CRON_SECRET + prod URL (pg_cron jobs), Twilio (SMS). Each wires into
finished plumbing with no further code.
