# WP8: Mid-Ticket Coaching Workflow (PRD-30) - Research

**Researched:** 2026-06-28
**Domain:** Draft-then-approve workflow, RBAC sub-role enforcement, per-client assignment + payout tracking
**Confidence:** HIGH (every claim grounded in files read in this repo + craneop-ref)
**Branch:** phase-2 (next free migration: `0039`)

> RESEARCH ONLY. No app code changed, no migrations run, no commits. This doc designs WP8; the planner turns it into plans.

---

## Summary

PRD-30 asks for a "last-eyes" gate: an `assistant_coach` drafts plans/messages for assigned mid-ticket clients, and nothing reaches a client until Stephanie (`coach`/`operator`) approves. Plus per-client assignment with a monthly rate tracked for the assistant's payout.

The hard constraint that shapes this entire design: **`public.is_coach()` returns `true` for `assistant_coach`** (`supabase/migrations/0018_rls_lockdown.sql:11-14`), and **the whole coach app reads/writes through the service client which BYPASSES RLS** (`src/lib/supabase/service.ts:1-2`, comment in `0018:8`). That means RLS *cannot* be the gate that stops an assistant from publishing - an assistant's JWT passes every `is_coach()` policy, and the service client ignores RLS entirely. The gate must be enforced in the **server action layer** by checking the exact role (`ctx.role`), not by RLS and not by `requireCoach`/`COACH_ROLES` (which all admit `assistant_coach`).

The proven pattern for this in the sibling craneop repo is: a status-enum lifecycle table, **no client UPDATE policy at all**, and **state transitions executed only by the server/service role** (`craneop-ref/.../20260517_employee_invitations.sql` comment: "UPDATE has no client policy: the accept path runs under supabaseAdmin"). We mirror that exactly: `approval_queue` rows are inserted as `pending` by the assistant action, and the only code that flips a row to `approved` AND performs the publish is a single server action that first asserts `ctx.role !== 'assistant_coach'`.

**Primary recommendation:** Two tables (`coaching_assignments`, `approval_queue`) + three server actions (`submitDraft`, `decide`, `listForAssignment`) + an `item_type`-keyed publish dispatcher. Enforce "publish only after approval" with an **application-layer role assertion in `decide()`** (operator/coach only), backed by an `approval_queue.status` CHECK constraint and a published-rows-only read path. Add a `requireApprover()` guard (the missing piece - no operator-only guard exists today). Mirror the insert+`revalidatePath` action shape from `src/lib/messages/message-actions.ts` and `src/lib/community/actions.ts`.

---

## Phase Requirements

| ID | Description (from PRD-30 EARS / ledger) | Research Support |
|----|------------------------------------------|------------------|
| AC-1 / feat-last-eyes | Assistant drafts a plan for a mid-ticket client -> system HOLDS it for approval | `submitDraft` inserts `approval_queue` row with `status='pending'`; nothing publishes on insert. Enforced by the publish dispatcher living ONLY in `decide()`. |
| AC-2 | Stephanie approves -> system PUBLISHES to client | `decide(approve)` asserts approver role, runs `publishApprovedItem()` dispatcher (writes the real `messages` / `meal_plans` row), then sets `status='approved', approved_by, approved_at`. |
| AC-3 / table-coaching-assignments | Assistant assigned clients -> system tracks per-client count for payout | `coaching_assignments(assistant_id, client_id, monthly_rate_cents)`; `listForAssignment` + a payout rollup `SUM(monthly_rate_cents) GROUP BY assistant_id WHERE status='active'`. |
| table-approval-queue | `approval_queue` holding drafts (critical) | New table 0039, RLS-scoped: assistant sees own drafted rows, coach/operator see all. |

---

## User Constraints

No `*-CONTEXT.md` exists for WP8 yet (`.planning/phases/` has no WP8 context file; this is a standalone research pass). Constraints are taken from PRD-30 directly:

### Locked (from PRD-30)
- **2 new tables only:** `coaching_assignments` + `approval_queue` (Section 3 schema checklist). Cumulative target 80.
- **Money is BIGINT cents** with `_cents` suffix: `monthly_rate_cents BIGINT`. Assumption value is $25/client/mo = `2500` (PRD-30 Section 1), but the rate is a column, not a constant.
- **Bilingual EN/ES** - all UI strings via next-intl catalogs (`src/messages/en.json` + `es.json`).
- **Four UI states** on every data-bound screen (loading/empty/error/populated) per Section 11.
- **No draft may bypass the gate** (Section 8b plan-review gate): "publish is only callable post-approval; evaluator tries to bypass and confirms block."
- **Assistant Coach role from PRD-04** - already exists (`Role` union in `src/lib/auth/session.ts:7`).

### Claude's Discretion
- Exact `item_type` taxonomy (recommend `message` + `meal_plan` to start; `program` is forward-compat).
- Whether `item_ref` is a single uuid column + jsonb payload (recommended) vs polymorphic FKs (rejected - no clean FK target across `profiles`/`contacts`).
- Surface placement in `coach-nav.tsx` (recommend a new "Approvals" nav section).

### Deferred / Out of Scope
- Actual payout *payment* execution (Stripe transfers). PRD-30 is *tracking* only ("tracked for payout"), not paying.
- `program` drafts (workout programs) - schema supports it via `item_type`, but WP8 ships `message` + `meal_plan`.
- White-label / multi-assistant-team hierarchy beyond single-tenant.

---

## Standard Stack

No new libraries. WP8 is pure Postgres + Next.js server actions on the existing stack. Confirmed from `package.json`:

| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| `zod` | ^4.4.3 | Validate every action input | CLAUDE.md non-negotiable; every existing action uses it (`message-actions.ts:11`, `community/actions.ts:14`) |
| `next-intl` | ^4.13.0 | Bilingual UI strings | `src/messages/en.json` has 457 `app.coach` keys already |
| `@supabase/supabase-js` | ^2.108.2 | DB access (server + service client) | `src/lib/supabase/{server,service}.ts` |
| `next` | 16.2.6 | App Router server actions + `revalidatePath` | `'use server'` action files throughout |

**Installation:** none. `pnpm` already has everything.

> AGENTS.md warning: this is Next.js 16 with breaking changes vs training data. Do NOT assume App Router / server-action APIs - read `node_modules/next/dist/docs/` before writing route/action code. The existing actions in `src/lib/**/*actions.ts` are the authoritative local examples to copy.

---

## Architecture Patterns

### Recommended file layout (mirrors existing conventions)

```
src/lib/coach/
  assignments.ts          # data layer: listForAssignment, payout rollup (service client, read)
  assignment-actions.ts   # 'use server': upsertAssignment, deactivateAssignment (operator-only)
  approval.ts             # data layer: listQueue (drafted_by scope), getQueueItem
  approval-actions.ts     # 'use server': submitDraft, decide(approve/reject)
  approval-publish.ts     # server-only dispatcher: publishApprovedItem(itemType, payload)
src/lib/auth/
  guards.ts               # ADD requireApprover() (operator/coach, NOT assistant_coach)
src/app/(app)/coach/
  drafts/page.tsx         # Surface 1: assistant draft inbox (own drafts + status)
  approvals/page.tsx      # Surface 2: Stephanie approval queue (pending across all assistants)
  assignments/page.tsx    # Surface 3: assignment + monthly-rate management (operator-only)
src/components/coach/
  draft-composer.tsx      # 'use client': assistant writes a draft message/plan
  approval-queue.tsx      # 'use client': approve/reject buttons -> decide()
  assignment-table.tsx    # 'use client': assign assistant<->client + set rate
src/messages/{en,es}.json # add app.coach.* keys for the 3 surfaces
src/components/nav/coach-nav.tsx  # add a "navApprovals" section
```

### Pattern 1: Insert + `revalidatePath` server action (the house style)

Every mutation in this repo is a `'use server'` function that: parses input with Zod, calls a `require*` guard, writes via `createClient()` (cookie-scoped, RLS-enforced) OR `createServiceClient()`, then `revalidatePath`. Source: `src/lib/messages/message-actions.ts:15-44`, `src/lib/community/actions.ts:20-63`.

```typescript
// Source: pattern from src/lib/community/actions.ts:20-63
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';     // assistant + coach + operator
import { createClient } from '@/lib/supabase/server';

const DraftInput = z.object({
  itemType: z.enum(['message', 'meal_plan']),
  clientId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),   // shape validated per item_type below
});

export async function submitDraft(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();              // assistant passes here (correct - they may DRAFT)
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // Assistant may only draft for a client they are assigned to. Coach/operator may draft for anyone.
  if (ctx.role === 'assistant_coach') {
    const ok = await isAssignedTo(ctx.companyId, ctx.userId, parsed.data.clientId);
    if (!ok) return { ok: false, error: 'not_assigned' };
  }

  const sb = await createClient();
  const { error } = await sb.from('approval_queue').insert({
    company_id: ctx.companyId,
    item_type: parsed.data.itemType,
    client_id: parsed.data.clientId,
    drafted_by: ctx.userId,
    payload: parsed.data.payload,
    status: 'pending',                           // ALWAYS pending on insert. No publish here.
  });
  if (error) { console.error('submitDraft:', error.message); return { ok: false, error: 'failed' }; }
  revalidatePath('/coach/drafts');
  revalidatePath('/coach/approvals');
  return { ok: true };
}
```

### Pattern 2: The approval gate (THE critical pattern)

This is where "publish only after approval" lives. Two enforcement layers:

```typescript
// Source: enforcement idiom from craneop-ref employee_invitations (UPDATE via service role only)
'use server';
import { requireApprover } from '@/lib/auth/guards';   // NEW guard: operator/coach ONLY
import { createServiceClient } from '@/lib/supabase/service';
import { publishApprovedItem } from '@/lib/coach/approval-publish';

const DecideInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});

export async function decide(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = DecideInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  // LAYER 1 (the real gate): an assistant CANNOT reach this code path. requireApprover redirects
  // assistant_coach away. This is the only thing standing between a draft and a client.
  const ctx = await requireApprover();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = createServiceClient();              // service client: we are the trusted publisher

  // Read the still-pending row scoped to this tenant. If it is already decided, no-op (idempotent).
  const { data: item } = await sb
    .from('approval_queue')
    .select('id, item_type, client_id, drafted_by, payload, status')
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId)
    .eq('status', 'pending')                     // only a PENDING row may be decided
    .maybeSingle();
  if (!item) return { ok: false, error: 'not_found_or_decided' };

  if (parsed.data.decision === 'approved') {
    // Publish FIRST inside the same action, THEN mark approved. If publish throws, the row stays
    // pending and nothing leaked. (No real cross-table transaction in PostgREST; order matters.)
    const pub = await publishApprovedItem(ctx.companyId, item);
    if (!pub.ok) return { ok: false, error: pub.error ?? 'publish_failed' };
  }

  await sb.from('approval_queue').update({
    status: parsed.data.decision,
    approved_by: ctx.userId,
    approved_at: new Date().toISOString(),
    decision_note: parsed.data.note ?? null,
  }).eq('id', item.id).eq('status', 'pending');  // optimistic guard: re-assert pending in the WHERE

  revalidatePath('/coach/approvals');
  revalidatePath('/coach/drafts');
  return { ok: true };
}
```

### Pattern 3: `item_type`-keyed publish dispatcher (server-only)

The dispatcher is the ONLY place that writes the real client-facing row. It is `server-only`, never exported to a client, never callable except from `decide()`.

```typescript
// src/lib/coach/approval-publish.ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

type QueueItem = { item_type: string; client_id: string; drafted_by: string; payload: Record<string, unknown> };

export async function publishApprovedItem(
  companyId: string,
  item: QueueItem,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();
  switch (item.item_type) {
    case 'message': {
      // messages.client_id references profiles(id); sender is the APPROVER, attributed to the drafter
      // in payload if you want a byline. Mirrors src/lib/messages/message-actions.ts insert shape.
      const body = String(item.payload.body ?? '').trim();
      if (!body) return { ok: false, error: 'empty_message' };
      const { error } = await sb.from('messages').insert({
        company_id: companyId,
        client_id: item.client_id,               // the subscriber profile this thread belongs to
        sender_id: item.drafted_by,              // NOTE: messages_rw RLS wants sender_id=auth.uid();
                                                 // service client bypasses RLS so this is fine.
        body,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case 'meal_plan': {
      // meal_plans.contact_id references contacts(id) (CRM contact, NOT profiles). The payload must
      // carry contactId separately from client_id. See "Pitfall: profile vs contact" below.
      const p = item.payload;
      const { error } = await sb.from('meal_plans').insert({
        company_id: companyId,
        contact_id: (p.contactId as string) ?? null,
        name: String(p.name ?? 'Plan'),
        calorie_goal: Number(p.calorieGoal ?? 0) || null,
        split_protein_pct: Number(p.proteinPct ?? 0) || null,
        split_carb_pct: Number(p.carbPct ?? 0) || null,
        split_fat_pct: Number(p.fatPct ?? 0) || null,
        plan_jsonb: p.plan ?? null,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    default:
      return { ok: false, error: 'unknown_item_type' };
  }
}
```

### Pattern 4: The missing guard - `requireApprover()`

There is NO operator/coach-only guard today. `requireCoach()` (`src/lib/auth/guards.ts:13-18`) admits all of `COACH_ROLES` including `assistant_coach`. The only place the app distinguishes `operator` is a label in `coach/settings/page.tsx:22`. We must add:

```typescript
// ADD to src/lib/auth/guards.ts (mirrors requireCoach)
export async function requireApprover(): Promise<AuthContext> {
  const ctx = await requireAuth();
  // assistant_coach may DRAFT but never APPROVE. Only coach/operator approve.
  if (!hasRole(ctx.role, ['coach', 'operator'])) redirect('/coach/drafts');
  return ctx;
}
```

### Anti-patterns to avoid
- **Relying on RLS to block publish.** `is_coach()` is true for assistants and the coach app uses the BYPASSRLS service client. RLS is for the *subscriber-facing* surface, not the coach-app gate. (`0018:8`, `service.ts:1-2`).
- **Using `requireCoach()` to guard `decide()`.** It lets `assistant_coach` through. Use `requireApprover()`.
- **Publishing on draft insert.** `submitDraft` must NEVER write to `messages`/`meal_plans`. Only `decide(approve)` does.
- **Polymorphic FK on `item_ref`.** There is no single FK target (`messages.client_id -> profiles`, `meal_plans.contact_id -> contacts`). Use a plain `uuid` + `payload jsonb` and resolve in the dispatcher.

---

## Database Design (migration 0039)

Next free number confirmed: existing migrations stop at `0038_health_ack.sql`; use **`0039_mid_ticket_workflow.sql`**.

### Table A: `coaching_assignments`

```sql
-- 0039 PHASE 2 - Mid-ticket coaching: assistant<->client assignment + monthly payout rate.
-- An assistant_coach is assigned mid-ticket clients; each assignment carries the monthly rate the
-- assistant is paid (tracking only, no payment execution). RLS: an assistant sees ONLY their own
-- assignment rows; coach/operator see all. Writes are operator-only at the action layer.
create table if not exists public.coaching_assignments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  assistant_id       uuid not null references public.profiles(id) on delete cascade,
  client_id          uuid not null references public.profiles(id) on delete cascade,
  monthly_rate_cents bigint not null default 0,       -- $25/mo assumption = 2500
  status             text not null default 'active' check (status in ('active', 'paused', 'ended')),
  assigned_by        uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, assistant_id, client_id)        -- one live assignment per pair
);
create index if not exists idx_assignments_assistant on public.coaching_assignments (company_id, assistant_id) where status = 'active';
create index if not exists idx_assignments_client    on public.coaching_assignments (company_id, client_id);

alter table public.coaching_assignments enable row level security;
drop policy if exists assignments_rw on public.coaching_assignments;
-- Assistant: read own rows. Coach/operator: read all in tenant. (is_coach() includes assistant, so we
-- must NARROW assistants to their own rows explicitly.)
create policy assignments_read on public.coaching_assignments for select
  using (
    company_id = public.current_company_id()
    and (assistant_id = auth.uid() or public.is_approver())   -- see helper below
  );
-- Only operator/coach may create/modify assignments. Enforced again at the action layer.
create policy assignments_write on public.coaching_assignments for all
  using (company_id = public.current_company_id() and public.is_approver())
  with check (company_id = public.current_company_id() and public.is_approver());

create trigger set_assignments_updated_at before update on public.coaching_assignments
  for each row execute function public.set_updated_at();   -- set_updated_at from 0001:202
```

### Table B: `approval_queue`

```sql
-- approval_queue: the last-eyes gate. An assistant inserts a 'pending' draft; an approver (coach/
-- operator) flips it to approved/rejected. The PUBLISH (writing the real messages/meal_plans row)
-- happens ONLY in the decide() server action under the service role - never on insert, never by an
-- assistant. item_ref is the resolved target id; payload carries the full draft content.
create table if not exists public.approval_queue (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  item_type    text not null check (item_type in ('message', 'meal_plan')),  -- 'program' later
  client_id    uuid not null references public.profiles(id) on delete cascade, -- whose client
  item_ref     uuid,                                  -- optional resolved target (e.g. contact_id)
  drafted_by   uuid not null references public.profiles(id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by  uuid references public.profiles(id) on delete set null,
  approved_at  timestamptz,
  decision_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_queue_pending  on public.approval_queue (company_id, created_at desc) where status = 'pending';
create index if not exists idx_queue_drafter  on public.approval_queue (company_id, drafted_by, status);

alter table public.approval_queue enable row level security;
-- Read: drafter sees own rows; approver sees all in tenant.
drop policy if exists queue_read on public.approval_queue;
create policy queue_read on public.approval_queue for select
  using (
    company_id = public.current_company_id()
    and (drafted_by = auth.uid() or public.is_approver())
  );
-- Insert: any coach role may draft, but only as themselves and always status='pending'.
drop policy if exists queue_insert on public.approval_queue;
create policy queue_insert on public.approval_queue for insert
  with check (
    company_id = public.current_company_id()
    and public.is_coach()              -- assistant/coach/operator may draft
    and drafted_by = auth.uid()
    and status = 'pending'             -- defense-in-depth: cannot insert a pre-approved row
  );
-- NO client UPDATE/DELETE policy. The decide() transition runs under the service role (BYPASSRLS),
-- mirroring craneop employee_invitations ("UPDATE has no client policy ... runs under supabaseAdmin").
-- This means even a hand-crafted PostgREST call from an assistant's JWT cannot set status='approved'.

create trigger set_queue_updated_at before update on public.approval_queue
  for each row execute function public.set_updated_at();
```

### New RLS helper: `is_approver()`

`is_coach()` is too broad (includes assistant). Add a narrower helper, mirroring `0018:11-14`:

```sql
-- Mirrors public.is_coach() (0018) but EXCLUDES assistant_coach: the approval/assignment authority.
create or replace function public.is_approver()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'user_role'), '') in ('coach', 'operator');
$$;
```

> Why `user_role` claim works: the custom access token hook (`0004:25-42`) injects `user_role` into the JWT from `profiles.role`. `is_coach()` already reads it. `is_approver()` reads the same claim.

### Payout rollup (read, no new table)

PRD-30 AC-3 = "track the per-client count for payout." No table needed - it is an aggregate over `coaching_assignments`:

```sql
-- per-assistant monthly payout = count of active clients x their rates
select assistant_id,
       count(*)                      as active_clients,
       coalesce(sum(monthly_rate_cents), 0) as monthly_payout_cents
from public.coaching_assignments
where company_id = $1 and status = 'active'
group by assistant_id;
```

---

## Server Actions (the 3 required + helpers)

| Action | File | Guard | Writes | Notes |
|--------|------|-------|--------|-------|
| `submitDraft` | `approval-actions.ts` | `requireCoach` (+ assignment check for assistants) | `approval_queue` insert `status='pending'` | NEVER publishes |
| `decide` | `approval-actions.ts` | **`requireApprover`** (operator/coach only) | publish via dispatcher, then `approval_queue` update | THE gate |
| `listForAssignment` | `assignments.ts` (data layer) | called from page after `requireApprover`/`requireCoach` | read-only | returns assistant's assigned clients + rates + payout rollup |
| `upsertAssignment` | `assignment-actions.ts` | `requireApprover` | `coaching_assignments` upsert (unique on company+assistant+client) | operator-only; sets `monthly_rate_cents`, `status` |
| `isAssignedTo` | `assignments.ts` | n/a (internal) | read | guards assistant drafting scope |
| `publishApprovedItem` | `approval-publish.ts` | `server-only`, internal | real `messages`/`meal_plans` row | only callable from `decide()` |

`listForAssignment(companyId)` shape (mirrors `getThreads`/`listChallenges` read-layer style):

```typescript
// src/lib/coach/assignments.ts  (service client, server-only)
export type AssignmentRow = {
  id: string; assistantId: string; assistantName: string;
  clientId: string; clientName: string; monthlyRateCents: number; status: string;
};
export async function listForAssignment(companyId: string): Promise<AssignmentRow[]> { /* join profiles for names, like getThreads:51-57 */ }
export async function getPayoutByAssistant(companyId: string): Promise<{ assistantId: string; assistantName: string; activeClients: number; monthlyPayoutCents: number }[]> { /* the rollup above */ }
```

---

## Three UI Surfaces

All gated server components, `export const dynamic = 'force-dynamic'`, mirroring `coach/inbox/page.tsx:1-20`. Each needs four states (loading/empty/error/populated) per PRD-30 Section 11.

| # | Route | Guard | Audience | Content |
|---|-------|-------|----------|---------|
| 1 | `/coach/drafts` | `requireCoach()` | assistant (also coach) | "My drafts": list own `approval_queue` rows with status pills (pending/approved/rejected) + a `draft-composer` to submit a new message/meal-plan draft for an assigned client. |
| 2 | `/coach/approvals` | **`requireApprover()`** | Stephanie (coach/operator) | "Approval queue": all `pending` rows across assistants, with drafter name, client name, rendered payload preview, and Approve / Reject buttons calling `decide()`. |
| 3 | `/coach/assignments` | **`requireApprover()`** | operator/coach | Assignment table: assign assistant <-> client, set `monthly_rate_cents`, toggle status, plus the per-assistant payout rollup. |

**Nav:** add a `navApprovals` section to `src/components/nav/coach-nav.tsx:18` `SECTIONS` (under the existing "navClients" group). Both `/coach/drafts` (assistant) and `/coach/approvals` + `/coach/assignments` (approver) can live there; hide approver-only links by reading role in the layout if desired (the page guards already redirect, so hiding is cosmetic).

i18n: add keys under `app.coach.*` in BOTH `src/messages/en.json` and `es.json` (457 coach keys already exist; follow the same nesting). No em dashes (CLAUDE.md / `/sweep`).

---

## How "publish only after approval" is enforced server-side (the proof)

Four independent layers, defense-in-depth. The evaluator (PRD-30 Section 8b) will try to bypass; here is why each attempt fails:

1. **Action-layer role gate (primary).** `decide()` calls `requireApprover()` which redirects `assistant_coach`. An assistant literally cannot execute the publish code path. The publish dispatcher (`publishApprovedItem`) is `server-only` and unexported - no other caller exists.
2. **No client UPDATE policy on `approval_queue`.** An assistant cannot PostgREST-`UPDATE` `status='approved'` from their own JWT (no policy permits it). The only `approved` transition is via the service role inside `decide()`. (Idiom: craneop `employee_invitations`.)
3. **Insert is forced `pending`.** `queue_insert` policy `with check (... status = 'pending')` plus the action hardcoding `status:'pending'` means a draft can never be born approved.
4. **Publish-before-mark ordering + pending-guarded update.** `decide()` publishes first, then sets `approved`; the `UPDATE ... where status='pending'` makes double-approve idempotent (a second approval finds no pending row). If publish throws, the row stays `pending`, nothing leaked.

The subscriber-facing read path is unchanged: a client reads their `messages` thread (`messages_rw` RLS, `0037:21-26`) and their `meal_plans`. A *draft* lives only in `approval_queue` (which subscribers have no policy to read), so an un-approved draft is invisible to the client by construction.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Status lifecycle | Free-text status strings | `text ... check (status in (...))` CHECK constraint | Matches craneop quote_status enum discipline; DB rejects bad states |
| `updated_at` maintenance | Manual timestamp writes | `set_updated_at()` trigger (`0001:202`) + `create trigger` | Already the house pattern (meal_plans `0019:113`) |
| Tenant scoping | Filtering by `searchParams` company | `company_id = current_company_id()` RLS + service-client reads pinned to `ctx.companyId` | `clients.ts:3` note: company_id from ctx, never searchParams |
| Role gate | New ad-hoc `if role` checks scattered | A single `requireApprover()` guard in `guards.ts` | One place to audit; mirrors `requireCoach` |
| Idempotent approve | Lock tables / advisory locks | `UPDATE ... where status='pending'` optimistic guard | Same trick as `joinChallengeAction` upsert-ignore (`actions.ts:148-155`) |
| Name lookups | Embed names in queue rows | Join `profiles(full_name,email)` at read time | `getThreads:51-57` does exactly this |

**Key insight:** the entire workflow is achievable with existing primitives (CHECK constraints, RLS, service client, server actions, `set_updated_at` trigger). The only genuinely new code is the `requireApprover()` guard and the `is_approver()` SQL helper - everything else is copying an established local pattern.

---

## Common Pitfalls

### Pitfall 1: `is_coach()` admits `assistant_coach` (the trap that breaks the gate)
**What goes wrong:** You write an RLS policy `using (is_coach())` expecting it to keep assistants out of approvals. It does not - assistants are coaches per `0018:13`.
**Why:** Single-tenant role helper was built to gate subscribers/free from CRM PII, not to split coach sub-roles.
**Avoid:** Use `is_approver()` (new) in policies that must exclude assistants, and `requireApprover()` in actions. Never gate the approve path on `is_coach()`/`requireCoach`/`COACH_ROLES`.
**Warning sign:** An assistant test account can hit `/coach/approvals` or call `decide()`.

### Pitfall 2: profile vs contact target mismatch
**What goes wrong:** `messages.client_id` references `profiles(id)` (`0037:10`) but `meal_plans.contact_id` references `contacts(id)` (`0019:90`). A "client" in the assignment table is a subscriber *profile*; a meal-plan target is a CRM *contact*. They are different id spaces.
**Why:** CRM contacts (imported from Lenus, 256 rows) are not all auth users; subscribers with logins are `profiles`.
**Avoid:** `coaching_assignments.client_id` and `approval_queue.client_id` reference `profiles(id)` (the app subscriber). For `meal_plan` drafts, carry `payload.contactId` (the `contacts` row) explicitly; the dispatcher uses it for `meal_plans.contact_id`. Do not assume `client_id == contact_id`.
**Warning sign:** FK violation on meal-plan publish, or a meal plan attached to the wrong/empty contact.

### Pitfall 3: service client BYPASSES RLS - your policy is not the gate
**What goes wrong:** You assume the coach app's reads are RLS-filtered. They are not - `createServiceClient()` uses the service role (`service.ts:1-2`). Any "scoping" must be an explicit `.eq('company_id', ctx.companyId)` AND, for assistants reading their own drafts, `.eq('drafted_by', ctx.userId)` in the query.
**Avoid:** In the assistant draft-inbox data layer, always filter `drafted_by = ctx.userId` in code; do not rely on RLS to do it (the page may use the service client).
**Warning sign:** An assistant sees another assistant's drafts.

### Pitfall 4: publishing on the wrong actor's behalf
**What goes wrong:** `messages_rw` RLS wants `sender_id = auth.uid()` (`0037:24`). When the dispatcher inserts the approved message under the service role, `auth.uid()` is null. This is fine (service client bypasses RLS), but if anyone later refactors to the cookie client it breaks.
**Avoid:** Keep `publishApprovedItem` on the service client. Document the byline choice: `sender_id = drafted_by` (assistant authored it) vs `approved_by` (Stephanie sent it). Recommend `drafted_by` for attribution.

### Pitfall 5: double-publish on rapid double-click
**What goes wrong:** Stephanie clicks Approve twice; two `messages` rows get inserted.
**Avoid:** The `where status='pending'` re-assertion in the final `UPDATE` plus reading the row with `.eq('status','pending')` first makes the second call find nothing and no-op. Already in Pattern 2.

### Pitfall 6: em dashes / Spanish copy drift
**What goes wrong:** Adding UI strings with em dashes (blocked by `/sweep`, CLAUDE.md) or forgetting the `es.json` mirror.
**Avoid:** Add every key to both catalogs; periods/commas only.

---

## State of the Art

This is internal workflow design, not a fast-moving external domain. The relevant "state of the art" is the craneop-ref pattern set (a production sibling repo on the same stack):

| Concern | craneop approach | Applied here |
|---------|------------------|--------------|
| State machine | `create type ... as enum` (quote_status, 7 states) | `text ... check (...)` (lighter, 3 states) - both valid; CHECK is simpler for 3 |
| Two-actor transition | "UPDATE has no client policy ... runs under supabaseAdmin" (employee_invitations) | identical: no UPDATE policy on `approval_queue`, transition via service role |
| Audit | `audit_trigger_func()` AFTER INSERT/UPDATE/DELETE | optional - `0001:214` defines `audit_trigger_func`; add if PRD wants destructive-action audit (CLAUDE.md "audit logs on all destructive actions") |
| Forensic timestamps | `sent_at/accepted_at/...` lifecycle columns | `approved_at` + `decision_note` |

**Recommendation:** add an `audit_trigger` on `approval_queue` and `coaching_assignments` (CLAUDE.md Anti-Get-Sued pillar: "Audit logs on all destructive actions"). `audit_trigger_func()` already exists from `0001`.

---

## Open Questions

1. **Byline on a published message: drafter or approver?**
   - Known: `messages.sender_id` is required; dispatcher runs as service role so either works.
   - Recommendation: `sender_id = drafted_by` (the assistant did the work) but surface "approved by Stephanie" only in coach views. Confirm with Stephanie's preference - low risk either way.

2. **Can an assistant edit a rejected draft and resubmit, or must they create a new one?**
   - Recommendation: simplest is a new row (rejected rows are immutable history). A "duplicate to new draft" button is fine. Confirm during planning - affects whether `submitDraft` accepts an optional `clonedFrom`.

3. **Does the meal-plan composer build a full `plan_jsonb`, or only macro targets?**
   - Known: `meal_plans` has generated macro columns + `plan_jsonb` (`0019:99-102`). WP4 already does text-to-macro.
   - Recommendation: WP8 ships the macro-target subset (calorie_goal + split %); full plan-builder is its own scope. Keep `payload` flexible (jsonb) so a richer composer slots in later.

4. **Should `decide(reject)` notify the assistant?**
   - Recommendation: optional fire-and-forget `void notify(...)` (notifications system exists, `0031`). Nice-to-have, not blocking AC-2.

5. **No CONTEXT.md exists for WP8.** If the user runs `/gsd:discuss-phase`, the byline + resubmit + composer-depth questions above should be locked there.

---

## Validation Architecture

`workflow.nyquist_validation = true` in `.planning/config.json`, so this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | **None installed** (no vitest/jest in `package.json`). |
| E2E framework | `@playwright/test` via `e2e/launchproof.gen.spec.ts` (AUTO-GENERATED launchproof regression gate). |
| RLS check tool | `node .qa-visual/sql.cjs "<SQL>"` (Management API) + `.qa-visual/rls-isolation-test.cjs` (run after any new table - per MEMORY rls-isolation note). |
| Quick run | `node .qa-visual/sql.cjs "select ..."` for DB assertions; `npx playwright test e2e/launchproof.gen.spec.ts` for route smoke. |
| Lint/types | `pnpm lint` (eslint). Type safety via PostToolUse `typecheck` hook (blocking). |

### Phase Requirements -> Test Map
| Req | Behavior | Test type | Command / method | Exists? |
|-----|----------|-----------|------------------|---------|
| table-approval-queue | table + RLS exists | SQL | `node .qa-visual/sql.cjs "select relrowsecurity from pg_class where relname='approval_queue'"` -> `t` | Wave 0 |
| table-coaching-assignments | table + RLS exists | SQL | same for `coaching_assignments` | Wave 0 |
| RLS isolation | assistant sees only own drafts | SQL/script | `.qa-visual/rls-isolation-test.cjs` extended for new tables | Wave 0 |
| AC-1 feat-last-eyes | draft holds, not published | manual + SQL | assistant submits draft -> assert no `messages` row, one `approval_queue` pending row | manual-only (cross-actor) |
| AC-2 | approve publishes | manual + SQL | approver clicks Approve -> assert `messages`/`meal_plans` row appears + queue row `approved` | manual-only |
| Bypass block (8b) | assistant cannot approve | manual | log in as `sample` assistant account, hit `/coach/approvals` -> redirected; call `decide()` -> forbidden | manual-only |
| Route loads (4 states) | new pages render | E2E | add `/coach/drafts`, `/coach/approvals`, `/coach/assignments` to launchproof gen + run | Wave 0 (regen) |

### Sampling Rate
- **Per task commit:** `pnpm lint` + the relevant `.qa-visual/sql.cjs` assertion for any new table/policy.
- **Per wave merge:** `node .qa-visual/rls-isolation-test.cjs` + `npx playwright test e2e/launchproof.gen.spec.ts`.
- **Phase gate:** launchproof green for the 3 new routes + RLS isolation passes + manual last-eyes + bypass-block proven (PRD-30 Section 10 evaluator).

### Wave 0 Gaps
- [ ] No unit-test framework exists - WP8 relies on SQL assertions (`sql.cjs`) + launchproof E2E + manual cross-actor checks. Do NOT assume `pytest`/`vitest`.
- [ ] Extend `.qa-visual/rls-isolation-test.cjs` to cover `coaching_assignments` + `approval_queue` (run after migration 0039).
- [ ] Regenerate `e2e/launchproof.gen.spec.ts` after adding the 3 routes (it is auto-generated; do not hand-edit).
- [ ] Need a seeded `assistant_coach` test account. MEMORY lists `sample.casey=coach`, `sample.sam=subscriber`, `sample.faye=free` (pw `TFSample2026!`) but NO assistant. **An assistant_coach test login must be seeded to verify AC-1 and the bypass-block.**

---

## Sources

### Primary (HIGH confidence - files read this session)
- `src/lib/auth/session.ts:7,79` - `Role` union, `COACH_ROLES` (includes assistant_coach)
- `src/lib/auth/guards.ts:13-29` - `requireCoach`/`requireEntitled` (no operator-only guard exists)
- `supabase/migrations/0018_rls_lockdown.sql:11-14` - `is_coach()` includes `assistant_coach`; service-client BYPASSRLS note (line 8)
- `supabase/migrations/0004_auth_rbac.sql:25-42` - JWT `user_role` claim injection
- `supabase/migrations/0037_messages.sql` - `messages` table (client_id->profiles, RLS, Realtime)
- `supabase/migrations/0026_community.sql` - community RLS + is_coach gating pattern
- `supabase/migrations/0036_habits.sql` - owner-or-coach RLS shape (the template to narrow)
- `supabase/migrations/0019_recipes_meal_plans.sql:86-114` - `meal_plans` (contact_id->contacts), set_updated_at trigger
- `supabase/migrations/0001_foundation.sql:12-15,202` - `current_company_id()`, `set_updated_at()`
- `src/lib/messages/message-actions.ts`, `src/lib/community/{actions,challenge-actions}.ts` - action insert+revalidate house style
- `src/lib/coach/{clients,overview}.ts` - service-client read-layer + ctx-pinned company_id discipline
- `src/components/nav/coach-nav.tsx` - where surfaces mount
- `src/lib/supabase/service.ts` - service client BYPASSRLS
- `Build/02-prds/PRD-30-mid-ticket-workflow.md` - the spec (ACs, ledger, 2-table budget, plan-review gate)
- `craneop-ref/supabase/migrations/20260517_employee_invitations.sql` - "UPDATE has no client policy; transition via service role" enforcement idiom
- `craneop-ref/supabase/migrations/20260520_quotes.sql` - status-enum lifecycle + lifecycle timestamps + created_by pattern
- `.planning/config.json` - nyquist_validation=true; `.qa-visual/` tooling; `e2e/launchproof.gen.spec.ts`

### Secondary (MEDIUM)
- MEMORY notes: test accounts (no assistant seeded), rls-isolation-test.cjs, service-client-everywhere RLS leak history

### Tertiary (LOW)
- None. No web sources needed; this is internal-pattern design on a known stack.

---

## Metadata

**Confidence breakdown:**
- Database design: HIGH - copies exact RLS/trigger idioms from migrations read in-repo.
- Approval enforcement: HIGH - the `is_coach()`-includes-assistant trap and the service-role-transition fix are both verified against source files (`0018`, craneop `employee_invitations`).
- UI surfaces: HIGH - mirror `coach/inbox/page.tsx` + `coach-nav.tsx` directly.
- Test plan: MEDIUM - no unit framework; relies on SQL+launchproof+manual; assistant test account is a known gap.

**Research date:** 2026-06-28
**Valid until:** ~30 days (stable internal stack; revisit if role model or `is_coach()` changes).
