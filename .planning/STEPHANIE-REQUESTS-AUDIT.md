# What Stephanie has asked for, and whether we have it

Everything she has asked for across two voice notes and a text thread on 3 August 2026, checked
against what is actually in the app today. Checked by querying the live system, not by reading code.

**Status key:** ✅ done · ⚠️ partly there · ❌ not built · ⛔ blocked on someone else

---

## ⛔ THE ONE THAT CHANGES THE SCHEDULE

> *"When are we gonna start migrating my current clients into the app... my contract with Lena ends at
> the end of the month and I wanna make sure I understand the system so I'll be able to service
> clients throughout that time."*

**This is the most important sentence in any of these messages, and it moves the launch date.**

If "Lena" is **Lenus**, her current coaching platform, then she loses the tool she runs her business on
**around 31 August**. Doors were planned for **27 September**. That is a **four week gap where she has
265 paying clients and nowhere to serve them.**

### Where the migration actually stands

| | |
|---|---|
| clients whose data is in the app | **265** ✅ |
| clients who can actually log in | **1** ❌ |
| clients with no account yet | **264** |

Her history moved in July: weights, photos, messages, intake. **The invitations were never sent.** The
invite system is built and works. Nobody has pressed go.

So today she could not service a single client through the app even if she wanted to.

### What has to happen, in order

1. **Confirm the Lenus end date.** Everything below hangs off it, and we are inferring it from a voice
   note. If it is 31 August, the app has to carry her clients from 1 September.
2. **Send the 264 invites.** The email is written and bilingual. It needs her approval on the wording,
   then it is one action.
3. **Walk her through the system before that date**, because she has to be able to answer a client
   question on 1 September without calling us.

**This is not a build problem. It is a date problem, and it needs a decision this week.**

---

## Her explicit asks

### 1. ⚠️ "I need a walkthrough of how to use this. I'm not tech savvy."

Nothing has been built for this. There is no guided tour, no help page, no video.

She is about to be the primary operator of a system she has never used, on a deadline. A written guide
is not enough for someone who says plainly that she is not technical.

**Recommendation:** a live screen-share walkthrough, recorded so she can rewatch it, covering only what
she does daily: read the client list, open a client, write a program, send a meal plan, answer a
message. Not the admin portal, not settings. Roughly an hour.

---

### 2. ⚠️ "Send the list so I can distinguish the monthly clients from paid in full"

The data is there and nobody has put it on screen. From the live records:

| | clients | average lifetime spend |
|---|---|---|
| **monthly, still recurring** | 63 | $1,006 |
| **everything else** (paid in full, finished instalments, lapsed) | 193 | $378 |

The 193 are lumped together as "other" because the imported records do not carry a clean flag. We can
tell recurring from not, and we can tell a single large charge from instalments, but "paid in full"
versus "finished paying" is a judgement call on some of them.

**Recommendation:** add a **Payment type** column to her Clients screen (Monthly / Paid in full /
Finished / Lapsed), plus a filter. About half a day. She asked for a list; a filter she can use forever
is better than a spreadsheet she has to ask for again.

**One question for her:** for the 193, does she want us to guess from the payment pattern, or does she
have that split written down somewhere?

---

### 3. ❌ "Can you find a template for an onboarding form... so I have something to work with"

There is **1 form** in the whole system, and it is not an intake template.

She is asking for a starting point she can edit, not a blank page. That is a reasonable ask and a fast
one: we already know the questions the app itself asks at signup (goals, injuries, conditions,
pregnancy, training location, experience, equipment).

**Recommendation:** build her a draft intake form from the questions the app already asks, hand it over
as a template, and let her add and cut. Half a day. **She has now mentioned this three times across
two voice notes and a text.**

---

### 4. ⛔ Apple App Store: waiting on the D-U-N-S number

She and Rodney submitted for the D-U-N-S number, which she needs before she can register as a
**business** developer rather than a personal one.

Nothing we can do until it arrives. Typical turnaround is a few business days, occasionally longer.

**Worth knowing:** there is **no iOS app yet.** The D-U-N-S unblocks the developer account, which is
the first of several steps, not the last one. If she is expecting an App Store listing soon, that
expectation needs correcting now rather than in September.

---

### 5. ✅ "I did look at the website... it looks pretty good. There's a lot of adjustments I wanna make"

The site is live. She has seen it. She wants changes and has not said what they are yet.

**Recommendation:** ask her to send the list, or walk the site with her on the same call as the
walkthrough. Cheaper than guessing.

---

### 6. ⚠️ "I want to send you over my offers as well so you could put on there, I did go to the pricing section"

Pricing on the site is **$19.97 founding** (five day window) then **$24.97 standard**, which you locked
on 30 July.

Her "offers" sound like more than that: her existing packages, one-on-one, bootcamp tiers. Those are
not on the site.

**This needs care.** If her offers contradict the locked pricing, someone has to reconcile them before
either goes live. Ask her to send them, then compare before changing anything.

---

## The new request: workouts that change with her cycle

> *"She wants to be able to integrate something that alters the women's workout based on if they are
> on their cycle."*

**Status: half of this already exists, and it is the more expensive half.**

### What is already built

| piece | state |
|---|---|
| a place for her to log her period | ✅ built, at the You tab |
| working out which phase she is in | ✅ built (menstrual, follicular, ovulation, luteal) |
| the coach chat knowing her phase | ✅ built and already in use |
| coaching guidance per phase | ✅ written, in the app today |
| **the workout itself changing** | ❌ **not built** |
| anyone having used it | 0 members so far |

The coach chat already tells the coaching engine things like:

> *luteal phase: appetite and cravings commonly rise, body temperature is higher and perceived effort
> goes up. Expect the scale to hold or bump from water, treat that as normal rather than a setback,
> and do not cut calories in response.*

So the app already knows where she is in her cycle and already coaches differently on it. **What it
does not do is change the actual workout.**

### What "altering the workout" could mean, and they are not equally hard

1. **Show her a note on the workout screen.** "You are in your luteal week, this is a normal week for
   lifts to feel heavier." Nothing changes, she is just told. **Small.**
2. **Suggest a lighter version.** Offer a swap or a reduced set count during her period, which she can
   accept or ignore. **Medium**, and it uses the substitution system that already exists.
3. **Rebuild her whole program around her cycle.** Heavy weeks in the follicular phase, deload in the
   luteal. **Large**, and it changes how programs are written and assigned.

### What we would recommend

**Start at 1 and 2, not 3.** Two reasons that matter more than the engineering.

First, cycles are not reliable enough to program around for a lot of women. Anyone on hormonal birth
control, anyone perimenopausal, anyone with PCOS, and anyone postpartum will have an irregular or
absent cycle. **Her audience includes all of those**, and PCOS is common enough that it is one of the
tags in her own client records. A program that silently reorganises itself around a predicted date will
be wrong for a meaningful share of her members, and being wrong about someone's body is worse than
saying nothing.

Second, the science is genuinely contested. The strength differences across a cycle are small and
inconsistent in the research, while the differences in **how training feels** are large and well
reported. That points at coaching and permission rather than at a different program.

**Question for her:** does she want the app to *tell her* it is a harder week, or *decide for her* that
it is a lighter one? Those are different products, and her answer decides how much this costs.

---

## What she has NOT asked for that we should tell her about

These are done and she does not know:

- **New members now get a welcome email from her** with their numbers and a first-day plan.
- **The app stopped telling new members to sit and wait.**
- **She has a message thread already open with every new member**, in her voice.
- **She has a list of who is waiting on a program**, oldest first. One person has been waiting 15 days.
- **She gets a phone alert the second anyone signs up**, with their goal, injuries and payment status.
- **The exercise library went from 899 generic entries to 250 useful ones**, and gained the 26 glute
  movements it never had.

---

## Everything on one page, in the order it should happen

| # | what | who | when |
|---|---|---|---|
| 1 | **Confirm the Lenus end date** | Stephanie | this week |
| 2 | **Send the 264 client invites** | us, after she approves the wording | before that date |
| 3 | **Live walkthrough, recorded** | us + Stephanie | before that date |
| 4 | Onboarding form template (asked 3 times) | us | half a day |
| 5 | Payment type column on the client list | us | half a day |
| 6 | The calorie decision (see FOR-STEPHANIE.md) | Stephanie | 2 minutes |
| 7 | Her website change list | Stephanie | whenever |
| 8 | Her offers, reconciled with locked pricing | Stephanie, then us | before launch |
| 9 | Cycle: decide "tell her" vs "decide for her" | Stephanie | before we build |
| 10 | Filming, 76 movements | Stephanie | 1 to 3 days |
| 11 | 10 to 15 labelled food photos | Stephanie | 20 minutes |
| 12 | D-U-N-S, then Apple developer account | waiting on Apple | out of our hands |
