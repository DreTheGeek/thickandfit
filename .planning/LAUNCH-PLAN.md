# Thick & Fit, Launch Plan (everything left to do)

> Single source of truth for the road to launch. Written 2026-06-27 after auditing both branches
> against the design mocks + the 2026-06-25 Stephanie call. Supersedes STATE.md until that file is
> rewritten in Stage 1. Statuses here are honest, cross-checked against src/lib/coach/system-map.ts.

## How to read this
- **Effort:** S = under half a day. M = half to 1.5 days. L = 2-3 days. XL = 4+ days. (AI-assisted velocity.)
- **Blocked** = waiting on Stephanie or an external account. **Decision** = needs a human call before build.
- Critical path is Stage 0 -> 1 -> 2. Everything else parallelizes once the branch is stable.

## Where we actually are
Three buckets explain the gap between the mocks and the live app:
1. **Built but stranded on `phase-2`** (un-merged, un-deployed, un-verified): nutrition diary + cooked/uncooked
   + barcode + photo-to-macro, Stripe billing engine, subscriber community + challenge leaderboard,
   gamification (streaks/badges), progress photos, push notifications.
2. **Partial / placeholder** (coverage map is honest about these): coach community, coach inbox, broadcasts
   send, coach billing/renewals dashboard, forms (builder shipped, responses pending), habits.
3. **Designed but never built**: coach Payouts/rev-share, white-label Branding settings, coach Create-Challenge
   authoring, the dunning/renewals dashboard. Multi-currency/LATAM is deliberately deferred to Phase 3.

---

## The launch scope contract: Phase 2 vs Phase 3
**Phase 2 = a complete app we can take paying clients with.** The test of "complete" is one loop working
end to end: a woman (EN or ES) can sign up, **pay**, get a personalized plan, train with demos, track
nutrition the easy way, see progress, and reach her coach; and Stephanie/Dani can manage clients and get
paid. Everything required for that loop is Phase 2. Everything that only makes it *better* is Phase 3.

### Phase 2 (LAUNCH) — required to take clients
**Client loop:** auth · onboarding -> Mifflin-St Jeor targets · **pay (Stripe checkout + 3DS + subscription
+ webhook)** · workouts (player + her video demos) · nutrition wedge (diary + text-to-macro + photo-to-macro
+ barcode + cooked/uncooked) · progress (weight, photos, macro rings, streaks) · habits · recipes/meal plans
· community feed · **full AI coach (chat + plan-gen)** · push reminders · bilingual EN/ES · light/dark · PWA.
**Coach loop:** CRM (clients/leads/programs/forms/recipes/meal plans) · Billing & Renewals view · Inbox
(client<->coach) · Create Challenge (light) · coach Community view · knowledge builder (feeds the AI).
**Foundation:** Fort Knox security (RLS, rate limiting, consent, audit, 3DS) · pricing $19.97 low +
mid-ticket ($200-300) Stripe prices · honest STATE + a verification pass on all of it.

### Phase 3 (POST-LAUNCH) — enhancements, not required to take clients
High-ticket $3k+ with WAP/Fanbases financing + Calendly/Zoom booking (the financing approval limits take
weeks to warm up anyway; launch on low+mid ticket) · multi-currency / LATAM local pricing (international
cards work day-one via Stripe) · white-label / multi-tenant branding · coach Payouts / Stripe Connect
rev-share (Steph is paid directly at launch) · automated dunning sequences (manual recovery is fine at low
client counts) · in-app broadcast send (GHL handles marketing blasts) · live streaming · Apple Health /
Watch sync (native) · app-store native app (PWA launches first) · MCP / public API (internal-only at launch).

> **The one tension to know:** the full AI coach is in Phase 2 per your call, but it is the only Phase 2
> item gated on *content* (Shakira's knowledge base), not code. If "start taking clients" is urgent, the
> core loop (pay -> train -> track -> coach) can open the doors and the AI coach switches on the day the
> knowledge base lands, still Phase 2, just sequenced last. Your call whether that gates launch or trails it.

---

## Stage 0 — Stabilize the branch (DO FIRST)
Prerequisite for all phase-2 work. phase-2 is 27 commits behind main.

| Task | Effort | Notes |
|---|---|---|
| Clean working tree (decide `.claude/settings.json`, gitignore `supabase/.temp/`) | S | needs your call on settings.json |
| `git merge main` into `phase-2`, resolve conflicts | M | catalogs (en/es.json), onboarding-flow, today-screen, workout-player, STATE |
| Green typecheck + lint + build, run RLS isolation test | S | RLS has leaked here 3x; phase-2 added many tables |

## Stage 1 — Verify what's already built
phase-2 has commits but no ledger sign-off. Convert "committed" into "proven."

| Task | Effort | Notes |
|---|---|---|
| Evaluator pass on the 9 phase-2 feature areas | L | prove ACs on running app, flip ledger, confirm RLS/tenant |
| Cal AI eval set -> photo-macro AC-4 | M | Blocked on your in-person Cal AI data trip (see CAL-AI-TEARDOWN.md) |
| Rewrite STATE.md + system-map statuses to the truth | S | so the team stops working from fiction |

## Stage 2 — Launch-critical gaps Stephanie expects (not blocked on her)

| Task | Effort | Notes |
|---|---|---|
| **Text-to-macro** ("I ate 10 nuggets" -> macros) | M | the headline she watched demoed; reuses OpenRouter + food corpus + diary |
| **Habits tracker** on client home | M | she named habits + macros as THE homepage priority; habits is "planned" today |
| **Recipe tags + filters** (budget, PCOS, 3-5 ingredient) + curation | M | only Steph-approved recipes, no bulk import |
| **Free / challenge-winner lifecycle** (status tags + expiry cron + 3-day reminders) | M | Shakira's 3-day-before promote/demote spec |
| **Mux video plumbing** (multi-angle + muscle overlay, pull generic videos out) | M | footage is Blocked on Steph; the plumbing is not |
| **Pricing copy** $19.99 -> $19.97 + create Stripe price | S | confirmed low-ticket = $19.97 |
| **PWA maskable icons** + final logo wiring | S | known Phase-1 gap; final logo Blocked on Steph |

## Stage 2.5 — Full AI coach at launch (DECIDED 2026-06-27)
Both plan generation AND conversational chat ship at launch. The chat stack was already built on phase-2,
then removed and staged on phase-3 (commit 1402144), so this is largely un-deferring proven code, not
building from scratch. The gating risk is content, not code (see the promoted blocker below).

| Task | Effort | Notes |
|---|---|---|
| Restore AI coach phase-3 -> phase-2 (revert the revert / cherry-pick) | M | migration 0028 (coach_messages, user_insights, weight_entries) + Layers 1-3 already built |
| Re-verify Layer 1 streaming chat + context builder | S | built; re-prove after restore |
| Re-verify Layer 2 nightly insights + Layer 3 RAG/vector memory | S | built; re-prove after restore |
| AI plan generation from intake + knowledge base | L | the newer piece: custom meal/workout from PCOS/allergies/goal |
| Knowledge builder (Steph talks her knowledge in) | M | feeds the coach's voice; Blocked on Steph + Shakira |
| AI safety: health-advice disclaimers + consent + eval set | M | Fort Knox anti-get-sued; AI must not hand out unsafe medical advice |

**Promoted blocker:** PRD-31's AI Knowledge Base questionnaire (Shakira) was Phase-3 runway. With the full
AI coach now in launch scope, it becomes **launch-critical** — the chat has no voice and plan-gen has no
brain until Stephanie's knowledge is captured. Escalate to Shakira now; this is likely the long pole.

## Stage 2b — Coach-console gaps from the design mocks (NEW)
The mocks imply these exist. They don't. Each gets a build-or-cut call for a single-tenant launch.

| Mocked screen | Call | Effort | Reasoning |
|---|---|---|---|
| Coach **Billing & Renewals** dashboard (view) | BUILD | M | MRR + grandfathered pricing already live; add the renewals/failed view |
| Automated **dunning** sequences | FAST-FOLLOW | L | recovery automation; not needed to open the doors |
| **Create Challenge** (coach authoring) | BUILD (light) | M | subscriber leaderboard exists; add the authoring form -> publish |
| Coach **Inbox** (client<->coach messaging) | BUILD | L | Steph expects it "like before"; placeholder today, needs Realtime |
| Coach **Community** view | BUILD (light) | M | subscriber feed exists; coach moderation/post view is placeholder |
| **Broadcasts** send backend | CUT for launch | M | the call put email blasts/nurture on GHL; lean on GHL, not in-app |
| **Payouts / Stripe Connect rev-share** | CUT for launch | L | single tenant; Steph is paid directly via her Stripe Express. Revisit at white-label |
| **White-label Branding** settings (app name/accent/logo/tier pricing) | CUT for launch | L | single-tenant; branding is fixed as Thick & Fit. Phase 3 white-label |

## Stage 3 — High-ticket + offer ladder (Blocked on Steph's blueprint)

| Task | Effort | Notes |
|---|---|---|
| Offer ladder (mid $200-300, high $3k+, sub-$2k trust-builder) | M | Blocked on her offer blueprint |
| Financing: WAP + Fanbases | M | external account setup |
| Calendly + 2x/mo Zoom booking for high-ticket | M | |
| Create Stripe products/prices for all tiers | S | Blocked on Stripe connect |

## Stage 4 — Pre-launch hardening

| Task | Effort | Notes |
|---|---|---|
| Full verification pass on Stage 2 / 2b / 2.5 / 3 | L | |
| Fort Knox / security audit (`/audit`) | M | |
| Reconcile `hardening/launch-audit-2026-06` branch | M | finish or fold in |
| Deploy-verification checklist | S | vercel prod READY, /api/v1/ping 200, Sentry clean, migrations diffed |

## Stage 5 — Ship

| Task | Effort | Notes |
|---|---|---|
| Phase 1 fully shippable (billing live) | - | Blocked on Steph: Stripe connect + GHL ID verify |
| Merge `phase-2` -> `main` | S | clean if Stage 0 kept phase-2 current |
| `vercel deploy --prod` | S | git push alone does not deploy here |
| PWA live before app store | - | PWA shell already built |

---

## Parallel track — Stephanie's blockers (she executes, we facilitate)
- **AI Knowledge Base questionnaire (Shakira + Steph) — LAUNCH-CRITICAL.** Gates the full AI coach (Stage 2.5). Likely the long pole. Start now.
- GHL ID verification -> SMS · Stripe connect · mid/high offer blueprint · approved exercise + recipe lists (with Shakira) · re-recorded 369 videos · ~20 churn-status corrections · domain (teamthickandfit) + logo.

## Deferred / cut (agreed)
Live streaming · multi-currency / LATAM local pricing (Phase 3) · white-label branding (Phase 3) ·
coach payouts/rev-share (white-label) · in-app broadcast send (use GHL) · AI coach chat (phase-3).

---

## Rough timeline
- **Critical path (Stage 0->1->2):** ~1.5-2 weeks to a verified, launch-feature-complete subscriber app.
- **Stage 2b launch scope (build items only):** ~1 week, parallelizable with Stage 2.
- **Stage 2.5 (full AI coach, DECIDED):** +1-1.5 weeks. Chat is built (restore + re-verify); plan-gen +
  knowledge builder + AI safety are the new work. Content (Shakira knowledge base) is the real long pole.
- **Stage 3 + 4:** gated by Stephanie's offer blueprint + Stripe connect; ~1 week of build once unblocked.
- Net: a realistic launch window is **4-5 weeks of build**, but the hard gate is content + Stephanie's
  items (Shakira knowledge base, GHL/Stripe/offer blueprint), not engineering.

## Open decisions (need a human call)
1. ~~AI scope~~ — DECIDED 2026-06-27: full AI coach (chat + plan-gen) at launch.
2. **Stage 2b cuts:** confirm Payouts, White-label Branding, and in-app Broadcasts are cut for launch
   (proceeding as cut unless told otherwise).
3. **`.claude/settings.json`:** keep or stash the working-tree change before the Stage 0 merge.
