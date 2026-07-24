# WP11: pg_cron + Notification Triggers + Per-User Timezone — Research

**Researched:** 2026-06-28
**Domain:** Supabase pg_cron scheduling, server-driven notification generation, timezone-correct date boundaries
**Confidence:** HIGH (codebase + reference repo grounded; pg_cron API verified against Supabase docs)
**Scope:** RESEARCH ONLY. No app code changed, no migrations run, no commits. Next free migration number is **0039**.

---

## Summary

The notification *delivery* layer already exists and works (in-app insert + best-effort web push, both bilingual). What is missing is anything that **generates** notification rows on a schedule. Today the only scheduled work is a single Vercel cron (`/api/internal/ghl-sync` at 06:00 UTC, `vercel.json`) plus a second secret-gated internal route (`/api/internal/generate-insights`) that is NOT currently scheduled by anything. The Hobby plan caps Vercel crons at 1/day (per project memory `deploy-pipeline.md`), so all recurring work must move to Supabase pg_cron.

Three things are true and must shape the plan:
1. **No scheduler is enabled yet.** `pg_cron`, `pg_net`, and `http` are all *available* in the project but **not installed** (verified: `select extname from pg_extension` returns none of them). No GUC `app.service_role_key` is set (verified `current_setting('app.service_role_key', true)` is null). So WP11's first job is enabling the extensions + storing the bearer secret, exactly the gap the craneop reference solved.
2. **Every "today" in the app is UTC.** `todayIso()` is duplicated in three files (`src/lib/nutrition/diary.ts:22`, `src/lib/habits/habits.ts:15`, inline `utcToday()` in `src/lib/gamification/engine.ts:67`), all `new Date().toISOString().slice(0,10)`. Worse, the DB columns default to UTC too: `food_log.log_date` and `weight_entries.recorded_on` both default to `((now() AT TIME ZONE 'utc'))::date` (verified). For a US+LATAM audience this means a 9pm-Pacific meal logs to *tomorrow*, silently breaking streaks and the diary day. The codebase already left a TODO for this: `src/lib/habits/habits.ts:14` reads "Timezone-correctness (per-user tz) is handled globally in WP11."
3. **The internal-endpoint pattern is already proven here.** `generate-insights/route.ts` and `ghl-sync/route.ts` are both `CRON_SECRET`-bearer-gated, run the service client, and log to `cron_job_log`. pg_cron should call these same kinds of endpoints via `net.http_post` with a bearer header — this is exactly the craneop pattern.

**Primary recommendation:** Add `profiles.timezone` (IANA text, default `'America/New_York'`), make all date boundaries timezone-aware via one shared helper + tz-aware DB column defaults, enable `pg_cron`+`pg_net`, store the cron bearer as a Postgres GUC, and register pg_cron jobs that `net.http_post` to new secret-gated `/api/internal/*` endpoints which insert notification rows through the *existing* `createNotification`/`createNotificationsBulk` path. Per-user *local-time* reminders use an **hourly** cron that selects only the users whose local hour currently matches their reminder hour (pg_cron itself is UTC-only — confirmed by Supabase docs).

---

## User Constraints

No `CONTEXT.md` exists for this phase (checked `.planning/phases/*/`-style and `$phase_dir`; none present for WP11). Constraints are inherited from the global stack rules in `CLAUDE.md` / `AGENTS.md`:

- **RLS on every table, `company_id NOT NULL`** on any new table. New `profiles.timezone` is a column add (RLS already on profiles).
- **No em dashes** anywhere in code or copy.
- **Service-client-everywhere** is the established norm; notification generators run as service role.
- **This Next.js has breaking changes** vs training data — read `node_modules/next/dist/docs/` before touching any route handler API (the cron-target endpoints are Route Handlers). pg_cron/SQL is unaffected by this.
- Money is bigint `_cents` (not relevant to this WP; no money tables touched).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WP11-1 | Move scheduled work to Supabase pg_cron + GUC service key (off Vercel Hobby 1/day cap) | craneop pattern in `20260531_v18_cron_schedules.sql`; extensions available but not installed; `cron_job_log` table already exists (`0002_ai_email_cron.sql:64`) |
| WP11-2 | Build notification GENERATORS (table + push exist; nothing inserts on a schedule) | `createNotification`/`createNotificationsBulk` (`src/lib/notifications/create.ts`) is the insert path; `notifyBroadcast` (`triggers.ts`) is the template; i18n via `notifText` (`i18n.ts`) |
| WP11-3 | Per-user timezone so diary day, streaks, reminder times use LOCAL day | `profiles` has no tz column (verified 14-col list); `todayIso()` x3 + UTC DB defaults are the bug; `pg_timezone_names` supports IANA zones (verified) |
| WP11-4 | Nightly insights cron | `generate-insights/route.ts` already exists, secret-gated, logs to `cron_job_log`; just needs a pg_cron schedule |
| WP11-5 | Streak recompute cron | Folded into the insights route today (`recomputeAllGamification`); `engine.ts` uses `utcToday()` and must become tz-aware |
| WP11-6 | Renewal reminders cron | `subscriptions.current_period_end` + `cancel_at_period_end` (`subscriptions.ts`) is the data source |
| WP11-7 | Check-in due cron | `getAssignedCheckins` (`checkins.ts`) computes assigned-vs-done via `form_assignments` + `form_responses` |
| WP11-8 | Comp-grant expiry promote/demote | Entitlement is *computed*, not a stored role (`isEntitled` in `billing/entitlement.ts`); "demote" is automatic — the cron only needs to *notify* on `profiles.comp_access_until` approaching/passing |

---

## Standard Stack

### Core (Postgres extensions — available, NOT yet installed)
| Extension | Purpose | Status (verified) | Notes |
|-----------|---------|-------------------|-------|
| `pg_cron` | In-database cron scheduler | available, not installed | Supabase: install into `pg_catalog` (their managed default). Jobs run in **UTC** only. |
| `pg_net` | Async HTTP from SQL (`net.http_post`) | available, not installed | Used by every craneop cron to call an endpoint. Non-blocking; result lands in `net._http_response`. |
| `http` | Synchronous HTTP from SQL | available, not installed | Alternative to pg_net; pg_net is the Supabase-blessed choice for crons. Prefer pg_net. |

Install (in the WP11 migration, idempotent):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

### Supporting (already in repo — reuse, do not rebuild)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/notifications/create.ts` | `createNotification` / `createNotificationsBulk` (insert + push) | EVERY generator inserts through this, never raw `.insert` |
| `src/lib/notifications/i18n.ts` | `asNotifLocale` + `notifText(locale, key, vars)` | All copy rendered per-recipient `ui_locale` at creation time |
| `src/lib/notifications/triggers.ts` | `notifyBroadcast` (fan-out template) | Copy this shape for new triggers (`notifyStreakAtRisk`, etc.) |
| `cron_job_log` table (`0002_ai_email_cron.sql:64`) | Per-run audit row | Every cron-target endpoint inserts one. Columns: `job_name`, `status in ('success','error','skipped')`, `detail jsonb`, `ran_at` |
| `src/lib/api/auth.ts` `safeEqual` | Timing-safe bearer compare | Use in every new internal route (ghl-sync already does; generate-insights uses `!==` and should be upgraded to `safeEqual`) |
| `src/lib/coach-ai/insights.ts` `listActiveSubscribers` | role='subscriber' discovery + locale + goal | Reuse for any per-subscriber fan-out |

### Web push (already wired, key-gated)
| Piece | File | State |
|-------|------|-------|
| `sendPush` | `src/lib/notifications/push.ts` | No-op until `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set. In-app rows always work. |
| `push_subscriptions` table | `0031_notifications.sql:59` | Owner-only RLS; `endpoint` globally unique (upsert). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron calling a Next `/api/internal/*` route via pg_net | pg_cron calling a Supabase **Edge Function** (Deno) | craneop calls edge functions; this app's scheduled logic already lives in Next route handlers (`generate-insights`). Keep generators in Next to reuse `createNotification` + the TS notification i18n. Edge functions would force re-implementing the notification layer in Deno. **Recommendation: call the Next routes.** |
| pg_cron + pg_net | Vercel cron | Hobby caps at 1/day (memory `deploy-pipeline.md`); already maxed by ghl-sync. Non-starter for hourly reminder jobs. |
| Pure-SQL generators (insert notifications in plpgsql) | TS generators behind an endpoint | SQL generators skip the HTTP hop and can't fire web push or render the TS i18n catalog. Use SQL only for the *selection*, TS for the *delivery*. **Recommendation: endpoint-based generators.** |
| `app.service_role_key` GUC (`alter database set`) | hardcoded bearer in the cron body | craneop documents that `alter database set` is **permission-denied via the Management API** on their hosted project (`20260601_v3_29_reminder_cron.sql:9-10`), so they fell back to a hardcoded `CRON_SECRET` bearer. **This is the more reliable path on hosted Supabase** — see Pitfall 1. |

---

## Architecture Patterns

### Recommended layout (new + touched)
```
supabase/migrations/
  0039_timezone_and_cron.sql       # NEW: profiles.timezone, tz-aware defaults, extensions, GUC notes, cron.schedule calls
src/lib/
  datetime/local-day.ts            # NEW: single source of truth for tz-aware "today" (replaces 3 todayIso copies)
  notifications/
    triggers.ts                    # EXTEND: notifyStreakAtRisk, notifyCheckinDue, notifyRenewal, notifyCompExpiring
    generators.ts                  # NEW: the per-job selection+fan-out (called by the endpoints)
src/app/api/internal/
    notify-reminders/route.ts      # NEW: hourly, fires local-time reminders (diary/streak nudges) for users whose local hour matches
    notify-renewals/route.ts       # NEW: daily, renewal + comp-expiry reminders
    notify-checkins/route.ts       # NEW: daily, "check-in due" nudges
    generate-insights/route.ts     # EXISTING: just gets a pg_cron schedule; folds streak recompute already
```

### Pattern 1: pg_cron job -> net.http_post -> secret-gated Next route (PROVEN in craneop)
**What:** A `cron.schedule(name, cron_expr, sql)` where the SQL is a `net.http_post` to the endpoint with a bearer header. The endpoint validates the bearer, runs the service-role generator, logs to `cron_job_log`.
**When:** Every WP11 job.
**Source:** `C:/Users/dre/craneop-ref/supabase/migrations/20260531_v18_cron_schedules.sql:50-71` (GUC variant) and `20260601_v3_29_reminder_cron.sql:35-49` (hardcoded-bearer variant, with idempotent unschedule).

Hardcoded-bearer variant (recommended for hosted Supabase — substitute `__CRON_SECRET__` at apply time, never commit the real value):
```sql
-- Idempotent: drop the named job before re-scheduling (craneop 20260601_v3_29:27-33).
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'tf-notify-reminders-hourly' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'tf-notify-reminders-hourly',
    '0 * * * *',  -- top of every hour, UTC
    $cron$
      select net.http_post(
        url := 'https://www.teamthickandfit.com/api/internal/notify-reminders',
        headers := jsonb_build_object(
          'Authorization', 'Bearer __CRON_SECRET__',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
exception
  when undefined_function then
    raise notice 'pg_cron/pg_net not installed; skipping tf-notify-reminders-hourly';
end $$;
```

GUC variant (use ONLY if `alter database ... set app.settings.cron_bearer_token` succeeds on this project — craneop's `20260531_v18` uses `current_setting('app.settings.cron_bearer_token', true)` + `current_setting('app.settings.edge_base_url', true)` and soft-fails when unset).

### Pattern 2: Endpoint shape (copy generate-insights/ghl-sync)
**Source:** `src/app/api/internal/generate-insights/route.ts:13-39`, `ghl-sync/route.ts:11-26`.
```ts
// src/app/api/internal/notify-reminders/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/api/auth';
import { runLocalTimeReminders } from '@/lib/notifications/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runLocalTimeReminders(); // selects users whose LOCAL hour == reminder hour, fans out
  const sb = createServiceClient();
  void sb.from('cron_job_log').insert({
    job_name: 'notify-reminders-cron',
    status: result.ok ? 'success' : 'error',
    detail: result,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
```
Note: pg_net's `net.http_post` issues a **POST**; either add a `POST` handler or have pg_net hit a route that accepts both. (generate-insights/ghl-sync export `GET` and are called by Vercel cron as GET; for pg_net, prefer exporting `POST` or both. This is a real gotcha — see Pitfall 4.)

### Pattern 3: Timezone-correct "today" (the core of WP11-3)
**What:** One helper that converts "now" to the user's local calendar day. Replace the three `todayIso()` copies and make the DB column defaults tz-aware.
**TS side** (`src/lib/datetime/local-day.ts`, new):
```ts
// Local YYYY-MM-DD for a given IANA timezone. Uses Intl, no deps.
export function localDayIso(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}
export function localHour(timeZone: string, at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false }).format(at),
  ) % 24;
}
```
Callers (`diary.ts`, `habits.ts`, `gamification/engine.ts`, `coach-ai/insights.ts`, `coach-ai/context.ts`) load `profiles.timezone` and pass it in. The diary/habits write paths must set `log_date`/`logged_date`/`recorded_on` explicitly to `localDayIso(tz)` instead of relying on the UTC column default (today `logFoodAction` in `diary-actions.ts:86` omits `log_date`, so it falls to the UTC default — that is the write-side bug).

**DB side**: keep the column defaults as a *safety net* but switch them to a tz-aware default once `profiles.timezone` exists. Since a column default can't read another table's row, the authoritative fix is **write the date explicitly from the app** using the loaded tz. Optionally a trigger can backfill `log_date` from `profiles.timezone` when the app omits it (defense in depth).

### Pattern 4: Per-user local-time scheduling (pg_cron is UTC-only)
**What:** pg_cron cannot run "8pm in each user's zone." Run an **hourly** UTC cron; inside the generator select only users whose *current local hour* equals their reminder hour.
**Why:** Verified against Supabase docs — DB is UTC, pg_cron has no per-job timezone param; the documented workaround is to compute UTC equivalents / filter in-query (Supabase docs + discussion #36383, unanswered = no native support).
**Selection SQL** (run inside the generator via service client):
```sql
-- Users whose local hour right now is their reminder hour (default 19:00 local).
select id, company_id, ui_locale, timezone
from public.profiles
where role in ('subscriber','free')
  and extract(hour from (now() at time zone timezone))::int
      = coalesce(reminder_hour, 19);
```
This needs `profiles.timezone` (text IANA) and optionally `profiles.reminder_hour` (smallint, default 19) added in 0039.

### Anti-Patterns to Avoid
- **Storing UTC offsets (e.g. `-5`) instead of IANA names.** Offsets break across DST (US observes it, most of Mexico does not since 2022). Store `America/New_York`, `America/Mexico_City`, etc. `pg_timezone_names` validates them (verified both resolve).
- **Letting `log_date`/`recorded_on` fall to the UTC column default.** That is the root bug. Write the local day explicitly.
- **Raw `.insert` into `notifications` from a generator.** Bypasses push + i18n. Always go through `createNotification(Bulk)`.
- **A separate pg_cron job per user.** Thousands of jobs, unmanageable. One hourly job that filters.
- **Echoing raw upstream errors in the HTTP response.** ghl-sync deliberately persists the raw error to `cron_job_log.detail` but returns a sanitized body (`ghl-sync/route.ts:36-47`). Match that.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification insert + push fan-out | Raw `.insert` + manual webpush | `createNotification` / `createNotificationsBulk` | Already handles bilingual copy, best-effort push, expired-endpoint pruning |
| Bilingual notification copy | Inline EN/ES strings | `notifText(locale, key, vars)` + add keys to `src/messages/{en,es}.json` under `app.notifications.copy` | One catalog, EN fallback, `{var}` interpolation (`i18n.ts:29`) |
| Local calendar day | Manual offset math | `Intl.DateTimeFormat('en-CA', {timeZone})` | DST-correct, zero deps, handles LATAM zones |
| Cron auth | Custom token scheme | `CRON_SECRET` bearer + `safeEqual` (`src/lib/api/auth.ts:21`) | Timing-safe, already the project convention |
| Per-run audit | New table | `cron_job_log` (exists) | `job_name`/`status`/`detail`/`ran_at` already indexed (`0002_ai_email_cron.sql:72`) |
| Active-subscriber discovery | New query | `listActiveSubscribers()` (`insights.ts:106`) | Returns locale + goal already |
| Entitlement "demote" on comp expiry | A status flip / role change | Nothing — `isEntitled()` already returns false once `comp_access_until` passes (`entitlement.ts:20`) | Demotion is automatic; the cron only *notifies* |

**Key insight:** WP11 is ~80% wiring existing pieces on a schedule, ~20% new (the tz column + the local-day helper + the selection queries). The big risk is the timezone correctness, not the cron mechanics.

---

## Common Pitfalls

### Pitfall 1: `alter database set` (GUC) is permission-denied on hosted Supabase
**What goes wrong:** The "GUC-stored service role key" plan (`app.service_role_key`) fails to apply because the Management API user can't `alter database ... set`.
**Evidence:** craneop hit exactly this and documented it: "The GUC approach was not usable: alter database set is permission-denied via the Management API on this project" (`20260601_v3_29_reminder_cron.sql:9-10`). They fell back to a hardcoded bearer that the endpoint validates against `CRON_SECRET`.
**How to avoid:** Plan for BOTH. Try the GUC; if it fails, use the hardcoded-`__CRON_SECRET__`-substituted-at-apply-time bearer (never committed). The endpoint already validates `CRON_SECRET` either way, so the endpoint code is identical.
**Warning sign:** `permission denied to set parameter` when applying the migration via the Management API.

### Pitfall 2: UTC date boundary silently corrupts streaks for the actual target audience
**What goes wrong:** A user in Pacific (UTC-7/8) or any evening logger logs after ~5pm local; `log_date` defaults to *tomorrow* UTC. Streaks see a gap; the diary "today" shows empty.
**Why:** `food_log.log_date` default `((now() AT TIME ZONE 'utc'))::date` (verified) + `todayIso()` UTC in `diary.ts`/`habits.ts`/`engine.ts`.
**How to avoid:** Write `log_date` explicitly as `localDayIso(profile.timezone)` on insert; make streak math read the local day. This is the highest-value correctness fix in the WP.
**Warning sign:** A user's "today" diary is empty in the evening; streaks reset despite daily logging.

### Pitfall 3: pg_cron runs in UTC; "8pm reminder" needs an hourly filter
**What goes wrong:** Scheduling `0 20 * * *` sends at 8pm UTC = 3pm ET = noon PT, wrong for everyone except UTC users.
**Why:** pg_cron has no per-job timezone (Supabase docs; discussion #36383 unanswered).
**How to avoid:** Hourly cron + in-query `extract(hour from now() at time zone profiles.timezone) = reminder_hour`. DST is handled because `now() at time zone <iana>` is DST-aware.
**Warning sign:** Reminders arrive at odd local hours; complaints cluster by region.

### Pitfall 4: pg_net sends POST, the existing internal routes export GET
**What goes wrong:** `net.http_post` issues a POST; `generate-insights`/`ghl-sync` export only `GET` (they're called by Vercel cron as GET). pg_net POST -> 405.
**How to avoid:** New cron-target routes export `POST` (or both `GET` and `POST`). When scheduling the *existing* generate-insights via pg_cron, add a `POST` export or call it with `net.http_get` if available; simplest is to add `export const POST = GET` semantics.
**Warning sign:** `cron_job_log` empty + `net._http_response` shows 405.

### Pitfall 5: pg_net is async — failures don't surface at schedule time
**What goes wrong:** `net.http_post` returns a request id immediately; a 500 from the endpoint lands later in `net._http_response`, not in the cron run.
**How to avoid:** Rely on the endpoint's own `cron_job_log` insert for success/failure truth (every endpoint already does this). For debugging, query `net._http_response` and `cron.job_run_details`.
**Warning sign:** Cron shows "succeeded" in `cron.job_run_details` but no notifications appear — check the endpoint's `cron_job_log` row.

### Pitfall 6: Migration must be idempotent and not crash local/dev where pg_cron is absent
**What goes wrong:** Re-applying `cron.schedule` errors on duplicate; local dev without pg_cron errors on `cron.schedule`.
**How to avoid:** Wrap in `do $$ ... exception when undefined_function then raise notice ... end $$;` and unschedule-by-name before scheduling (craneop `20260601_v3_29:27-33`).

### Pitfall 7: Storing `next` migration as 0039 but `0028`/`0029` numbers are doubled
**What goes wrong:** The migrations dir has `0028_ai_coach.sql` + `0028_rls_hardening.sql` and `0029_*` twice. Don't reuse a number.
**How to avoid:** Use **0039** (confirmed next free; highest existing is 0038).

---

## Code Examples (verified from this repo / craneop)

### Existing notification trigger to copy (fan-out shape)
```ts
// Source: src/lib/notifications/triggers.ts:16-46
// Loads members, renders per-locale payload, calls createNotificationsBulk. Best-effort, never throws.
```

### Existing secret-gated cron endpoint to copy
```ts
// Source: src/app/api/internal/ghl-sync/route.ts:11-26
const secret = process.env.CRON_SECRET;
const auth = req.headers.get('authorization');
if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
// ... run service-role work ...
void sb.from('cron_job_log').insert({ job_name: 'ghl-sync-cron', status: result.ok ? 'success':'error', detail: result });
```

### Renewal-reminder selection (new generator query)
```sql
-- T-3-day renewal nudge: active subs renewing in 3 days, not set to cancel.
select s.profile_id, s.company_id, p.ui_locale, s.current_period_end
from public.subscriptions s
join public.profiles p on p.id = s.profile_id
where s.status in ('active','trialing','past_due')
  and s.cancel_at_period_end = false
  and s.current_period_end::date = (current_date + 3);
-- Source columns: src/lib/billing/subscriptions.ts:7-23 (SubscriptionRow), ACTIVE_STATUSES:36
```

### Comp-expiry nudge selection (new generator query)
```sql
-- Comp access expiring within 3 days (no role flip; isEntitled auto-demotes when it passes).
select id as profile_id, company_id, ui_locale, comp_access_until
from public.profiles
where comp_access_until is not null
  and comp_access_until::date between current_date and (current_date + 3);
-- Source: billing/entitlement.ts:9-21 (isEntitled), profiles.comp_access_until (0035_entitlement.sql:7)
```

### Check-in-due selection (new generator query)
```sql
-- Published check-in forms assigned to a member with no response in 7 days.
select fa.profile_id, fa.company_id, p.ui_locale, fa.form_id
from public.form_assignments fa
join public.forms f on f.id = fa.form_id and f.type='check_in' and f.status='published'
join public.profiles p on p.id = fa.profile_id
where not exists (
  select 1 from public.form_responses r
  where r.form_id = fa.form_id and r.profile_id = fa.profile_id
    and r.created_at > now() - interval '7 days'
);
-- Source: src/lib/checkins/checkins.ts:14-45 (getAssignedCheckins logic)
```

---

## State of the Art

| Old Approach | Current Approach | When | Impact for WP11 |
|--------------|------------------|------|-----------------|
| Vercel cron for all scheduling | Supabase pg_cron + pg_net | Now (Hobby 1/day cap) | All recurring jobs move to DB; keep the 1 Vercel cron or migrate ghl-sync too |
| UTC offset columns | IANA timezone names + `now() at time zone <iana>` | Standard | DST-correct across US + LATAM (Mexico dropped DST in 2022 — IANA names encode this) |
| pg_cron per-job timezone | Hourly UTC cron + in-query local-hour filter | pg_cron has no tz param (verified) | The reminder job is hourly, not "once at 8pm" |

**Deprecated/outdated:** GUC `app.service_role_key` for the cron bearer is unreliable on hosted Supabase (Management API can't `alter database set`) — prefer the apply-time-substituted hardcoded `CRON_SECRET` bearer (craneop's documented fallback).

---

## Open Questions

1. **GUC vs hardcoded bearer — which works on project `cpwesaeyhklmjbqppeah`?**
   - Known: craneop's project couldn't `alter database set` via Mgmt API; fell back to hardcoded.
   - Unclear: whether this project's access token has superuser-equivalent rights for the GUC.
   - Recommendation: write the migration for the hardcoded-`__CRON_SECRET__`-substitution path (proven), attempt GUC as an optional upgrade. `.qa-visual/sql.cjs` uses `SUPABASE_ACCESS_TOKEN`; test `alter database` rights there first.

2. **What endpoint host does pg_net call — `www.teamthickandfit.com` or a Supabase Edge Function?**
   - Known: the generators live in Next routes (to reuse `createNotification`). pg_net must reach the deployed Vercel URL.
   - Unclear: whether prod URL is stable/reachable from Supabase egress at plan time (it should be; public HTTPS).
   - Recommendation: store the base URL as part of the substituted cron body (like craneop's `edge_base_url`), default to the Vercel production domain.

3. **Should `reminder_hour` be user-configurable now or hardcoded to 19:00 local?**
   - Recommendation: add `profiles.reminder_hour smallint default 19` in 0039 so the column exists; ship with default 19, expose UI later. Cheap to add now, expensive to migrate later.

4. **Web push is currently a no-op (no VAPID keys).** In-app notifications work regardless. Plan should not block on push keys; generators insert in-app rows + best-effort push (auto-activates when keys land). Confirmed `isPushConfigured()` gate in `push.ts:19`.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No JS unit-test runner detected in repo root (no jest/vitest config found); validation is via `.qa-visual/*.cjs` scripts + DB queries through `node .qa-visual/sql.cjs` |
| Config file | none — see Wave 0 |
| Quick run command | `node .qa-visual/sql.cjs "<assertion SQL>"` |
| Full suite command | `pnpm typecheck && pnpm lint` (hooks: typecheck + lint are PostToolUse-blocking per CLAUDE.md) + `node .qa-visual/rls-isolation-test.cjs` after any table/column change |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| WP11-3 | `profiles.timezone` exists, IANA-validated, default set | smoke (SQL) | `node .qa-visual/sql.cjs "select column_default from information_schema.columns where table_name='profiles' and column_name='timezone'"` | ❌ Wave 0 |
| WP11-3 | Local day differs from UTC for a PT evening time | unit | new `src/lib/datetime/local-day.test` OR a `.qa-visual` script asserting `localDayIso('America/Los_Angeles', 2026-06-28T04:00:00Z) === '2026-06-27'` | ❌ Wave 0 |
| WP11-1 | extensions installed | smoke (SQL) | `node .qa-visual/sql.cjs "select extname from pg_extension where extname in ('pg_cron','pg_net')"` | ❌ Wave 0 |
| WP11-1 | cron jobs registered | smoke (SQL) | `node .qa-visual/sql.cjs "select jobname, schedule from cron.job order by jobname"` | ❌ Wave 0 |
| WP11-4..8 | each endpoint inserts a `cron_job_log` row | integration | hit endpoint with `Authorization: Bearer $CRON_SECRET`, then `node .qa-visual/sql.cjs "select job_name,status from cron_job_log order by ran_at desc limit 5"` | ❌ Wave 0 |
| WP11-2 | generator inserts a notification through createNotification (in-app row appears) | integration | run generator against a seed subscriber, query `notifications` for the new row | ❌ Wave 0 |
| WP11 RLS | new column/table doesn't leak across users | regression | `node .qa-visual/rls-isolation-test.cjs` | ✅ exists (memory `rls-isolation.md`) |

### Sampling Rate
- **Per task commit:** `pnpm typecheck && pnpm lint` (blocking hooks) + the relevant `sql.cjs` smoke assertion.
- **Per wave merge:** full `node .qa-visual/rls-isolation-test.cjs` + manually hit each new internal endpoint with the bearer and confirm a `cron_job_log` row.
- **Phase gate:** `cron.job` shows every scheduled job; a manual run of each cron produces a `cron_job_log` success row (matches the project's "pg_cron Test Procedure" in CLAUDE.md).

### Wave 0 Gaps
- [ ] `src/lib/datetime/local-day.ts` + a tiny test/assertion for `localDayIso`/`localHour` across PT/ET/Mexico_City
- [ ] `.qa-visual` assertion script (or reuse `sql.cjs`) for: `profiles.timezone` present, extensions installed, `cron.job` populated, `cron_job_log` gets rows
- [ ] No JS test runner present — if the planner wants TS unit tests for the date helper, framework install (`pnpm add -D vitest`) is a Wave 0 task; otherwise assert via a `.qa-visual/*.cjs` script (matches existing project convention, lower friction)

---

## Sources

### Primary (HIGH confidence — read directly)
- `src/lib/notifications/{create,push,triggers,i18n,queries,actions,types}.ts` — full notification layer (delivery exists, no generators)
- `src/app/api/internal/{generate-insights,ghl-sync}/route.ts` — proven secret-gated cron-endpoint pattern + `cron_job_log` logging
- `src/lib/nutrition/{diary,diary-actions}.ts`, `src/lib/habits/habits.ts`, `src/lib/gamification/engine.ts`, `src/lib/coach-ai/{insights,context}.ts` — every UTC `todayIso()`/date-boundary site
- `src/lib/billing/{subscriptions,entitlement}.ts` — renewal + comp-expiry data sources
- `src/lib/checkins/checkins.ts` — check-in-due logic
- `supabase/migrations/{0002_ai_email_cron,0031_notifications,0035_entitlement}.sql` — `cron_job_log` table, notifications/push schema+RLS, comp_access_until
- `vercel.json` — the single existing Vercel cron
- DB introspection via `node .qa-visual/sql.cjs`: extensions available-not-installed; no GUC set; `food_log.log_date`/`weight_entries.recorded_on` default to UTC; `profiles` has no timezone column; IANA zones resolve
- `C:/Users/dre/craneop-ref/supabase/migrations/{20260531_v18_cron_schedules,20260601_v3_29_reminder_cron,20260518_leah_daily_digest_cron,20260514163307_email_infra}.sql` — the EXACT proven pg_cron patterns (GUC variant, hardcoded-bearer variant, idempotent unschedule, vault fallback)

### Secondary (MEDIUM — verified against official docs)
- Supabase pg_cron docs + pg_cron/pg_net usage (https://supabase.com/docs/guides/database/extensions/pg_cron) — DB is UTC, pg_cron+pg_net call endpoints; pg_cron has no native per-job timezone
- Supabase scheduling functions docs (https://supabase.com/docs/guides/functions/schedule-functions)

### Tertiary (LOW — community, flagged)
- GitHub discussion #36383 "Cron Job Timezone" (unanswered) — confirms there is no native pg_cron tz param; the in-query filter workaround stands

---

## Metadata

**Confidence breakdown:**
- Notification generators: HIGH — delivery layer read in full; generators are net-new but wire to existing functions
- pg_cron mechanics: HIGH — craneop migrations are exact, battle-tested templates; extensions confirmed available
- Timezone correctness: HIGH — every offending call site + UTC DB default verified by reading files and introspecting the live DB
- GUC vs hardcoded bearer: MEDIUM — craneop documents the GUC permission failure; this project's specific rights untested (Open Question 1)

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (stable; pg_cron API and repo structure change slowly)
