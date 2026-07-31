# Support triage agent, build sheet

Written 2026-07-30 against the shipped code, not against a diagram. Answers Dre's question: "how can
we link this to Claude Code so that when I get a ticket it automatically goes to Claude Code, or is
this where the agentic agency comes into play?"

Short answer: it is the agentic part, and it splits into three stages that are worth building in
order. Stage 1 pays for itself immediately. Stage 3 is a real project, not a wire-up.

---

## What exists today

| piece | state |
|---|---|
| `support_tickets` table | id, company_id, subject, **body**, email, category, priority, status, assigned_to, source, timestamps |
| `/admin/support` board | log a ticket, read it (expandable), advance open -> in_progress -> resolved -> closed |
| `createTicketAction` / `setTicketStatusAction` | operator-gated server actions, Zod-validated |
| **intake** | **NONE.** Every ticket is typed by hand. `source` is always `'manual'`. |
| `ai_trace` | 334 rows. The observability table any agent step should write to. |

The gap that matters most is intake, not intelligence. A triage agent with nothing to triage is
worth nothing, and today a member with a problem has no path into this table at all.

---

## Stage 1: intake (build first)

Without this, nothing else matters.

**Two sources, both cheap:**

1. `/support` already exists as a public page and is the App Store "published contact" URL. Add a
   form that POSTs to `/api/support/ticket`: subject, body, email, category. Zod, Turnstile (reuse
   `verifyTurnstileToken` from the funnel signup), rate limit by IP (reuse `checkRateLimit`).
   `source: 'web'`.
2. Inbound email. Resend supports inbound routing; point `help@teamthickandfit.com` at
   `/api/support/inbound`, verify the webhook signature the same way `resend-webhook` already does,
   and insert with `source: 'email'`. Subject -> subject, text body -> body, From -> email.

**Do not skip the signature check on the inbound route.** An unauthenticated insert endpoint on a
public domain is a spam funnel into the one board the team is supposed to trust.

---

## Stage 2: triage + enrich (the high-value step)

Fires on insert. Reads the ticket, writes structured fields back to it. Never talks to the member.

**Schema additions (one migration):**

```sql
alter table support_tickets
  add column triage jsonb,             -- the agent's structured read
  add column triaged_at timestamptz;
```

**What the agent produces**, forced through a JSON schema so it cannot ramble:

```json
{
  "category": "billing|account|bug|content|other",
  "priority": "low|normal|high|urgent",
  "summary": "one sentence, what the member actually needs",
  "member_found": true,
  "member_context": "subscriber since Jul 12, last login Jul 29, 3 scans, no active subscription",
  "likely_area": ["src/lib/billing/entitlement.ts", "src/app/api/stripe/webhook/route.ts"],
  "suggested_reply": "draft, never auto-sent",
  "confidence": 0.0
}
```

**The enrichment is the point, not the classification.** Before the model runs, look the member up by
email and attach what we already know: role, entitlement state, last login, recent `ai_inferences`
failures, open `waitlist_leads` row. Most support tickets are answerable from that alone, and the
model is far more useful reading it than guessing.

**Rules:**
- Runs inside `after()`. A slow triage must never block the insert (see the funnel `runInBackground`
  comment for why a bare `void` is not acceptable on Vercel).
- Writes an `ai_trace` row like every other model call, so cost and latency are visible.
- `suggested_reply` is a DRAFT. It renders in the board behind a copy button. Nothing is ever sent to
  a member without a human pressing send. Launch week is the worst possible time to discover an
  agent apologising on Stephanie's behalf for something that did not happen.
- Failure is silent and non-fatal: an untriaged ticket is a normal ticket.

Cost: roughly a cent per ticket on a small model. At launch volume that is noise.

---

## Stage 3: ticket -> code (the honest limits)

This is what "goes to Claude Code" means, and it is worth being precise about why it is not a webhook.

**Claude Code is a local CLI attached to an interactive session.** There is no inbound endpoint for a
webhook to hit. A ticket cannot "open Claude Code" any more than it can open your editor. Anyone who
tells you otherwise is describing a different product.

What actually works, in increasing order of effort:

**3a. Ticket -> GitHub issue (a few hours).** When triage returns `category: 'bug'` and
`confidence > 0.7`, open a GitHub issue with the summary, member context, and `likely_area`. You
already use `gh`. Then any coding agent, including this one, can be pointed at the issue by name.
This gets you 80% of the value: the work arrives pre-diagnosed in the place work lives.

**3b. Batch review (a day).** A scheduled job collects the day's bug-tagged tickets and opens one
issue per cluster, deduped, so ten reports of the same crash are one issue and not ten.

**3c. Autonomous fix (a real project).** A hosted runner with repo access, branch permissions, and a
test gate picks up the issue, produces a PR, and never merges without review. This needs its own
security review: an agent with write access to the repo that serves member PII is a production
system, not a convenience. Do not build this before launch.

**Recommendation: 1 -> 2 -> 3a, and stop there until after Sept 27.**

---

## Verification

1. Submit the public `/support` form. Ticket appears with `source: 'web'` within seconds.
2. Send a mail to the inbound address. Ticket appears with `source: 'email'` and a readable body.
3. Forge a POST to `/api/support/inbound` with a bad signature. Rejected, nothing inserted.
4. A billing ticket from a known member comes back with entitlement state in `member_context`.
5. A bug ticket opens a GitHub issue; the same ticket submitted twice opens ONE issue.
6. Confirm no reply was ever sent automatically. Check Resend's log, not just the UI.
