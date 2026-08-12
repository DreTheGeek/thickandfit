# The vacation test: what breaks when nobody opens the console

Written 2026-08-12. The brief was to stop thinking like an engineer auditing code and start thinking
like the person who owns this business: what has to happen every day from 7am to 7pm, every week,
and every month from 1 January to 31 December, for 256 women to get coached and keep paying.

The test this document applies: **she buys the software on Monday and flies to Cabo on Tuesday. What
degrades, and how fast?**

The answer today is: the first paying client degrades within 3 days, and four separate queues start
silently filling within hours. None of that is a bug. Every individual piece works. The gap is that
the software is built to *show a human what needs doing* and almost nothing is built to *do it*.

---

## What is already strong, so nobody rebuilds it

The automation spine is real and better than most of the category:

- **14 registered crons** covering reminders (hourly), renewals, check-ins, nightly insights,
  challenge close-out, GHL sync every 6h, memory and knowledge-graph rebuilds, weekly eval runs.
- **The ops bot lives in Supabase, not Vercel**, specifically so a Vercel outage cannot silence the
  monitor. That is a lesson most teams learn much later and much more expensively.
- **A 9pm ET recap** that reports without anyone asking.
- **Notifications that cannot be muted for billing**, a signup alert fired from a DB trigger rather
  than a code path, and eight automated notification generators.

So the plumbing exists. What follows is not "add automation". It is "nothing currently owns the
client's outcome".

---

## Part 1 — The day (7am to 7pm)

### Gap 1.1 — A new paying client gets nothing until a human writes her plan

**This is the one that ends the vacation on day one.**

There is no automatic program assignment anywhere: `assignPlan` / `auto_assign` return zero hits
across `src/lib/programs/` and `src/lib/coach/`. Plans reach a member only when a coach opens
`/coach/programs` and assigns one.

The product knows this and has already papered it: `/coach/awaiting` exists, and its own header says
why —

> "The member-facing copy now says *Steph writes your plan by hand, she will message you when it is
> ready.* This page is what keeps that sentence honest."

`OVERDUE_DAYS = 3`. The team has already conceded that hand-written plans slip, and built a page to
catch the slips. On a normal week that page is a good idea. On a vacation week it is a list of
paying customers being let down, and nobody is reading it.

**Sharpest version of the problem:** she has **40 imported Lenus programs, 229 sessions, 2,497
prescriptions** sitting in the library. A woman who pays on Tuesday could be training Tuesday. She
waits instead, because the only path from "paid" to "training" runs through a person.

**What closes it:** a default program assigned at activation, chosen from her real library by the
onboarding answers already collected (goal, experience, training location, days per week). Framed
honestly to the member — "here is your starting week, Steph is personalising it" — which is both
true and better than silence. The coach then edits rather than authors, and the hand-written promise
becomes an upgrade instead of a bottleneck.

### Gap 1.2 — Four queues that decay with nobody responsible

`getAttention()` computes exactly the right four numbers:

| queue | what it means | what happens if nobody looks |
|---|---|---|
| `unanswered` | client messaged, no coach reply (14d window) | she is ignored, and its own comment says this "is the one that actually costs a renewal" |
| `intake` | `needs_coach_review = true` | new client sits unreviewed |
| `noPlan` | client with no meal plan | paid for nutrition, has none |
| `atRisk` | billing failing | churns |

All four are **dashboard reads with an `href`**. There is no escalation, no SLA, no reassignment to
an assistant coach, no fallback after N days. They are a to-do list, and a to-do list is exactly the
thing that does not work when the person is away.

**And the recap does not carry them.** The 9pm ops-bot recap is the one mechanism designed to report
when nobody is looking, and grepping it for `awaiting|unanswered|intake|at.risk|overdue` returns
nothing. It reports entitlement counts and support tickets. The four things that decay in her absence
are precisely the four it does not mention.

**What closes it:** put the four queues in the recap tonight (cheap, one function, high value), then
give each an SLA with an escalation path — unanswered > 24h pings the assistant coach, > 48h pings
the owner, intake > 72h auto-approves-with-flag or escalates.

### Gap 1.3 — A failed card ejects a paying member, silently

Documented in full elsewhere in this repo, but it belongs on this list because it is a vacation
killer: a declined card moves the member to `past_due`, `requireEntitled` bounces her out of every
training surface to `/checkout`, `/account/billing` simultaneously tells her the plan is active, and
no way to update a card exists anywhere in the product. Stripe retries for days. Nobody is watching.
She concludes the app is broken and leaves.

---

## Part 2 — The member lifecycle (day 0 to day 90)

The industry numbers are unusually clear here, and they are the numbers this product is currently
blind to:

- **50% of members who quit do so inside the first 90 days.**
- **Members who attend fewer than 4 times in their first month have an ~80% chance of cancelling.**
- Past 90 days with consistent attendance, likelihood of staying a year goes up **3x**.
- At-risk members are re-engageable **up to 6 weeks before** they cancel.
- Under **3% monthly churn** is elite for small-group and coaching operators; ~28.6% annual churn is
  the industry average.

### Gap 2.1 — The entire lifecycle is one nudge

`generateOnboardingNudges()` fires **once**, to members who signed up more than 12 hours and less
than 14 days ago, only if they never completed onboarding, and only if they have never been nudged
before.

After that single message, a member who never onboards is never contacted again. There is nothing at
day 7, 14, 30, 45 or 90. The research says day 7 and day 30 personal check-ins are the standard, and
that the 90-day window decides half of all churn. This product currently spends its entire retention
budget in the first 14 days, on one notification, to one segment.

### Gap 2.2 — Nothing notices a member who stops training

`atRisk` is **billing-only**: `past_due`, `unpaid`, `billing_health`. A woman whose card works fine
and who has not opened a workout in three weeks is completely invisible to this system until the day
she cancels — at which point the research says she was reachable for the previous six weeks.

The data to detect her already exists: `workout_logs`, `set_logs`, `workout_completion_history`,
`form_responses` (now full of real check-ins), `weight_entries`, the food diary. The signal is
sitting there. Nothing reads it for risk.

**What closes it:** an engagement-risk score computed nightly (the `tf-generate-insights-nightly`
cron is already the right home), a "quiet" threshold that matches her coaching cadence, and an
automatic intervention ladder — nudge, then coach task, then owner alert — rather than a number on a
dashboard.

### Gap 2.3 — The first-month attendance cliff has no trigger

"Fewer than 4 sessions in month one" is the single most predictive number in the category and the
app does not compute it. It has every workout log needed. A member at 1 session on day 21 should
generate an intervention automatically, because that is the moment it is still cheap to fix.

---

## Part 3 — The year (1 January to 31 December)

Nothing in this codebase is calendar-aware. Every cron is "daily", "hourly" or "every 6h". The
business it serves is strongly seasonal:

| period | what the business does | what the software does |
|---|---|---|
| **January** | the single most profitable month, New Year acquisition surge | nothing different |
| **Feb–Mar** | the January cohort hits its 90-day cliff | nothing different |
| **Apr–Jun** | steady, summer-body push | nothing different |
| **Jul–Aug** | slump: vacations, travel, cancellations | nothing different |
| **Sep–Nov** | back-to-school recovery, pre-holiday goals | nothing different |
| **December** | highest-cancellation month of the year | nothing different |

The consequence is not subtle: the January cohort is the biggest of the year and hits its 90-day
cliff in **April**, unattended. The December save-campaign window arrives and nothing runs.

**What closes it:** a campaign calendar as data rather than as someone's memory — seasonal sequences
that arm themselves, a hold/pause option for summer travel (an alternative to cancelling that the
product does not currently offer), and a December retention push that fires whether or not anyone
remembers it exists.

---

## Part 4 — What the coach experience needs to make her replaceable

She cannot leave if she is the only person who can do the work. The role model is already built —
five roles including `assistant_coach`, and `requireApprover` exists precisely so an assistant cannot
approve their own draft. The scaffolding is right. What is missing is the delegation itself:

- **No assignment.** Queues are company-wide, not "yours". An assistant coach cannot be handed 40
  clients and held to them.
- **No coverage mode.** Nothing to say "I am away until the 20th, route everything to Dani."
- **No SLA or escalation**, so nothing distinguishes an ignored queue from an empty one.
- **23 of 39 coach pages still do not explain themselves**, which is the difference between hiring
  help and training help.

---

## The build order, by how fast each one bites

1. **Auto-assign a starting program on activation.** Turns "paid and waiting" into "training today",
   and uses her existing 40 programs. Highest value, and it is the literal day-one failure.
2. **Put the four attention queues in the 9pm recap.** Smallest change on this page, and it converts
   silent decay into a message she reads on the beach.
3. **Engagement-risk detection + intervention ladder.** The 80%-cancel signal is computable from data
   already stored; nightly insights cron is the right home.
4. **The `past_due` chain**, including a way to update a card. Blocked path, needs a human, but it is
   revenue leaving through a door nobody can close.
5. **A real lifecycle: day 7 / 14 / 30 / 45 / 90.** Replaces one nudge with the sequence the category
   proves works.
6. **Coverage + assignment for coaches.** Makes the away state a supported mode rather than an outage.
7. **The seasonal calendar.** Highest ceiling, lowest urgency; needs her input on offers.

---

## Sources

Retention and churn benchmarks: [JeriCommerce](https://blog.jericommerce.com/resources/gyms-fitness-studios-retention-statistics),
[PushPress](https://www.pushpress.com/blog/gym-member-retention-guide),
[fitDEGREE 90-day system](https://www.fitdegree.com/post/how-to-build-a-90-day-member-retention-system-for-your-boutique-studio),
[NexScale 2026 benchmarks](https://www.nexscale.ai/resource-hub/fitness-member-retention-benchmarks-2026).
Operations and the member journey: [Gymdesk operator's playbook](https://gymdesk.com/blog/manage-a-gym),
[Trainerize 2026 studio trends](https://www.trainerize.com/blog/2026-fitness-studio-trends/).
Seasonality: [FLiiP](https://myfliip.com/blog/increase-gym-revenue-during-seasonal-fluctuations/),
[GymMaster](https://www.gymmaster.com/blog/seasonal-gym-marketing-ideas-to-boost-memberships/),
[Upswell](https://upswellmarketing.com/blog/5-tricks-you-need-to-know-to-overcome-gym-seasonality).

Every claim about this codebase was read out of the code, not assumed. Nothing here was exercised in
a browser: Supabase and the production host are unreachable from the environment this was written in.
