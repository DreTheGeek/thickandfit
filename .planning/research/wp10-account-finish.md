# WP10 Finish: Auto-Renewal Disclosure + Data Export + Account Buildout

**Researched:** 2026-06-28
**Branch:** phase-2
**Domain:** Subscription law (auto-renewal/ROSCA + CA ARL), GDPR/CCPA data portability, Supabase Auth account self-service, next-intl bilingual UI
**Confidence:** HIGH on codebase facts (all cited from files read); MEDIUM on external legal-copy requirements (verified against multiple sources, but final copy is owner/counsel's call)

> RESEARCH ONLY. Nothing below was built. No migrations run, no app code changed, no commits. Every claim cites a file path or a live DB query.

---

## Summary

WP10 has three remaining slices, all "account/legal finishing" on top of the already-shipped deletion + medical-disclaimer gate:

1. **Auto-renewal disclosure** before charge + a cancel/refund-policy surface. The actual "agree to be charged" moment is the **Subscribe** button on `/account/billing` (`src/components/billing/billing-actions.tsx` -> `startCheckoutAction`), NOT `/checkout` (which is still a `ComingSoon` stub, `src/app/(app)/checkout/page.tsx`). Disclosure copy must sit immediately adjacent to that button, and a short standing policy surface (cancel any time, no-refund-on-renewal or whatever Stephanie sets) belongs on `/account/billing` and/or a linked static page.
2. **Data export** (GDPR Art. 20 / CCPA right to know): a server action that assembles the signed-in user's rows from their owned tables into a single downloadable JSON, triggered from `/account`. Mirror the existing `deleteAccountAction` shape (`src/lib/account/actions.ts`).
3. **Account buildout**: `/account` today is only a language toggle + a billing link + sign-out + delete danger zone (`src/app/(app)/account/page.tsx`). Add **change email**, **change password**, and **notification preferences**.

The single biggest de-risking finding: **the `notification_preferences` table already exists** with the exact `(company_id, user_id, channel, category, enabled)` shape and RLS (`supabase/migrations/0001_foundation.sql:185-197`). It is currently **empty and not consulted anywhere** in the send path. So notif-prefs is a UI + read/write-action job on an existing table; no new table needed. A small migration is only needed if we want a CHECK on `category` or a SQL helper to default-on missing rows.

**Primary recommendation:** Build all three as server actions in `src/lib/account/actions.ts` (export) + a new `src/lib/account/notification-preferences.ts` (prefs read/write) + reuse `src/lib/auth/actions.ts` patterns for email/password. Add disclosure + policy copy as new `app.billing.*` and a new `app.account.*` i18n keys in BOTH `en.json` and `es.json`. No new table required for the core scope; one optional tiny migration (0039) only if we add a `category` CHECK constraint.

---

## User Constraints (no CONTEXT.md present)

No `*-CONTEXT.md` exists in `.planning/phases/` for this WP (the task came directly via the prompt). Treat the prompt's "REMAINING (do not build)" list as the locked scope:
- (1) Auto-renewal disclosure before charge + cancel/refund policy surface.
- (2) Data export server action -> downloadable JSON, triggered from `/account`.
- (3) Build out `/account`: change email, change password, notification preferences.
Explicitly OUT: do not rebuild deletion or the medical-disclaimer gate (already shipped and verified).

---

## Current State (cited)

### `/account` page today
`src/app/(app)/account/page.tsx` (RSC, `force-dynamic`):
- Reads `profiles.ui_locale, content_locale` for the current user.
- Renders: back link to `/you`, `<LanguageToggle>`, a link to `/account/billing`, a sign-out form (`signOutAction`), and the `<DeleteAccount>` danger zone.
- Uses `useTranslations`/`getTranslations('app')`. Keys live under `app.account.*` and `app.billing.*`.

### Deletion (already shipped, the model to mirror)
`src/lib/account/actions.ts`:
- `deleteAccountAction()` -> `requireAuth()` -> `createServiceClient().auth.admin.deleteUser(ctx.userId)` (cascades all owned data via `profiles.id` FK), then `signOut()`, then `redirect('/?deleted=1')`.
- `acceptHealthAction()` already lives here too. This file is the natural home for `exportMyDataAction()`.

### Billing / checkout (where disclosure goes)
- `src/app/(app)/checkout/page.tsx` is a **stub** (`<ComingSoon>`). The real subscribe CTA is on `/account/billing`.
- `src/app/(app)/account/billing/page.tsx` renders status + next charge + card last4 + history, and `<BillingActions mode=...>`.
- `src/components/billing/billing-actions.tsx` -> `SubscribeButton` posts `startCheckoutAction` then `window.location.href = checkoutUrl`. **This is the pre-charge moment.** Disclosure copy must render here (or in the billing page right above this control).
- `src/lib/billing/actions.ts` `startCheckoutAction` already records a `consent_captures` row (`consent_type:'billing'`, `consent_version:'2026-06'`, IP + UA) BEFORE redirecting to Stripe. This is exactly the anti-get-sued hook the auto-renewal disclosure should extend (bump version, or add a distinct `auto_renewal_disclosure` consent_type).
- Stripe checkout session is created with `mode:'subscription'` and `request_three_d_secure:'automatic'` (`src/lib/billing/stripe.ts:106-132`). Trial days come from `STRIPE_TRIAL_DAYS`. Recurring amount + interval come from the Stripe price; the app reads them back as `sub.price_cents` + `current_period_end` for display.

### Existing billing i18n (already honest, extend it)
`src/messages/en.json` `app.billing` already has: `nextCharge` "Next charge {amount} on {date}", `endsOn`, `cancelConfirm` "...You will not be charged again.", `honestNote` "No hidden fees. No retention traps. Cancel any time in one tap." ES parity confirmed (`app.billing` has 23 keys in both files). These are the tone anchor for the new disclosure copy.

---

## Slice 1: Auto-Renewal Disclosure + Cancel/Refund Policy Surface

### Legal baseline (MEDIUM confidence on requirements; copy is owner+counsel's)
US auto-renewing subscriptions are governed by the federal **ROSCA** (Restore Online Shoppers' Confidence Act) and state ARLs, with **California's Automatic Renewal Law (ARL)** the strictest and the de-facto national bar because Stephanie's audience spans the US. The recurring obligations relevant here:
- Present the auto-renewal terms **clearly and conspicuously**, in **visual proximity** to the consent/charge button (not buried in linked Terms).
- Disclose: that it renews automatically, the **recurring amount + cadence**, **how to cancel**, and any free-trial -> paid conversion terms.
- Obtain **affirmative consent** to those specific terms before the first charge.
- Provide an **easy online cancel** path ("click to cancel").
- Send/maintain an acknowledgement the consumer can keep.

The app already satisfies "easy cancel" (one-tap cancel + reactivate, no dark patterns, `billing-actions.tsx`) and already captures timestamped billing consent. The gap is the **conspicuous, proximate disclosure text** at the consent moment and a **standing policy surface**.

> needsRealData: exact recurring price + interval are real Stripe data ($99.97 low-tier locked per memory `call-2026-06-25-decisions.md`; mid is coach-assigned). Disclosure should render the *actual* amount/cadence when known. For a not-yet-subscribed user we may not have a price loaded, so copy must read the price from the configured Stripe price or fall back to a generic "you'll be charged the plan price shown at checkout, then automatically each {interval} until you cancel." Final no-refund-on-renewal wording is Stephanie's policy decision (open question below).

### Where it goes (cited)
1. **Inline disclosure** in `src/components/billing/billing-actions.tsx` `SubscribeButton`, rendered directly above/below the submit button. New keys `app.billing.autoRenewDisclosure` (+ optionally a `{amount}/{interval}` interpolated variant).
2. **Standing policy block** on `src/app/(app)/account/billing/page.tsx` near the existing `honestNote` footer: cancel-any-time + refund policy. New keys `app.billing.refundPolicy`, `app.billing.autoRenewSummary`.
3. **Optional** dedicated static page (e.g. `/legal/billing-terms` or a section in an existing legal/terms page) linked from both. Check for an existing legal page first; consent already references Terms + Privacy (`recordSignupConsent`), so a "Subscription Terms" anchor is consistent.

### Consent record (cited, anti-get-sued)
Extend `startCheckoutAction` (`src/lib/billing/actions.ts:56-112`) so the pre-redirect `consent_captures` insert reflects the auto-renewal acknowledgement. Two clean options:
- Bump `CONSENT_VERSION` to a value that encodes the disclosure (e.g. `'2026-06-autorenew'`), OR
- Insert an additional row with `consent_type:'auto_renewal_disclosure'`.
`consent_captures.consent_type` has **no CHECK constraint** (verified: `select pg_get_constraintdef ... contype='c'` returned `[]`), so a new consent_type needs **no migration**. Columns confirmed: `company_id, user_id, consent_type, consent_version, accepted, ip_address, user_agent, created_at`.

---

## Slice 2: Data Export (GDPR Art. 20 / CCPA)

### Approach (HIGH confidence; pure codebase work)
A server action `exportMyDataAction()` in `src/lib/account/actions.ts` that:
1. `requireAuth()` to get `ctx.userId` + `ctx.companyId`.
2. Uses `createServiceClient()` (service-client-everywhere is the project rule; RLS would also allow user-client reads of own rows, but service client is simpler and consistent and the action is already auth-gated).
3. Reads the user's auth identity (email, created_at) via `createClient().auth.getUser()`.
4. SELECTs every owned row from the tables below, assembles a single JSON object, returns it to the client for download (or returns a data URL / triggers a download).

### Delivery mechanism (Next.js 16 note)
AGENTS.md warns this Next.js has breaking changes; read `node_modules/next/dist/docs/01-app` before finalizing. Two viable patterns:
- **Server action returning a string** -> client builds a `Blob` and clicks a generated `<a download>` (simplest, no new route, mirrors how `billing-actions` already consumes action return values via `useActionState`).
- **A GET route handler** `src/app/(app)/account/export/route.ts` returning `Content-Disposition: attachment` JSON. Cleaner download UX, but must auth-guard the route (`resolveAuth`). Prefer the server-action+Blob path to stay consistent with the existing action-driven account UI and avoid a new public-ish surface.

### Tables to include (verified ownership map)
Ownership confirmed by querying `information_schema.columns` for `profile_id` vs `user_id`. The user's data lives across these (each filtered by the user's id):

**Owned by `profile_id` (= the user's profile id):**
`food_log`, `weight_entries`, `habits`, `habit_logs`, `workout_logs`, `workout_completion_history`, `progress_photos` (export the row metadata + storage paths; do NOT inline image bytes), `coach_messages`, `notifications`, `post_comments`, `post_reactions`, `recipe_favorites`, `form_assignments`, `form_responses`, `plan_assignments`, `onboarding_responses`, `challenge_participants`, `cancellation_reasons`, `payments`, `subscriptions`, `user_insights`, `user_streaks`, `user_badges`, `contacts` (this is the CRM mirror; a subscriber's own contact row, if present), `push_subscriptions` (consider excluding raw keys for security).

**Owned by `user_id`:**
`consent_captures`, `notification_preferences`, `sessions`, `session_logs`, `ai_usage_log` (consider excluding internal cost columns), `security_events` (consider excluding; security-sensitive), `audit_log` (consider excluding; internal).

**Profile itself:** `profiles` row (the single row where `id = ctx.userId`).

> Decision for the planner: a GDPR "data I provided / data about me" export should include the user-authored data (logs, photos metadata, messages, check-ins, billing history) and the profile. **Exclude or redact** internal/security tables (`security_events`, `audit_log`, raw `push_subscriptions` keys, `ai_usage_log` cost internals) to avoid leaking infra detail. Document the inclusion list in the action as a single `EXPORTED_TABLES` map so it stays auditable.

### Shape (sketch)
```ts
// src/lib/account/actions.ts (sketch — not built)
'use server';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// table -> the column that points at this user. Keep this list auditable in one place.
const BY_PROFILE = [
  'food_log', 'weight_entries', 'habits', 'habit_logs', 'workout_logs',
  'workout_completion_history', 'progress_photos', 'coach_messages',
  'notifications', 'post_comments', 'post_reactions', 'recipe_favorites',
  'form_assignments', 'form_responses', 'plan_assignments', 'onboarding_responses',
  'challenge_participants', 'cancellation_reasons', 'payments', 'subscriptions',
  'user_insights', 'user_streaks', 'user_badges',
] as const;
const BY_USER = ['consent_captures', 'notification_preferences', 'sessions', 'session_logs'] as const;

export async function exportMyDataAction(): Promise<{ json: string } | { error: string }> {
  const ctx = await requireAuth();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const svc = createServiceClient();

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: ctx.userId, email: user?.email, created_at: user?.created_at },
  };
  for (const table of BY_PROFILE) {
    const { data } = await svc.from(table).select('*').eq('profile_id', ctx.userId);
    out[table] = data ?? [];
  }
  for (const table of BY_USER) {
    const { data } = await svc.from(table).select('*').eq('user_id', ctx.userId);
    out[table] = data ?? [];
  }
  const { data: profile } = await svc.from('profiles').select('*').eq('id', ctx.userId).maybeSingle();
  out.profile = profile ?? null;

  return { json: JSON.stringify(out, null, 2) };
}
```
Client trigger (sketch) in a new `src/components/account/export-data.tsx`:
```tsx
'use client';
// onClick -> startTransition -> const res = await exportMyDataAction();
// if 'json' in res: new Blob([res.json], {type:'application/json'}) -> URL.createObjectURL -> <a download="thickandfit-my-data.json">
```
> Pitfall: large exports + server-action response size. Photos must be paths/URLs only, never base64 bytes. Add a `LIMIT`/streaming consideration only if a user could have tens of thousands of rows (unlikely at this stage; food_log is the heaviest). Flag rate-limiting (reuse `checkRateLimit`) so export can't be hammered.

---

## Slice 3: Account Buildout (email / password / notification prefs)

### 3a. Change password (HIGH confidence; reuse existing pattern)
Supabase `auth.updateUser({ password })` is already used for the reset flow (`src/lib/auth/actions.ts:117-142` `updatePasswordAction`). For in-app change:
- The user is already signed in, so `updateUser({ password })` works directly (no recovery token needed).
- **Optional current-password confirmation** is supported: `updateUser({ password, currentPassword })` (supabase-js >= 2.102.0; this repo runs **2.108.2**, verified in `node_modules/@supabase/supabase-js/package.json`). Recommend passing `currentPassword` so a stolen session can't silently change the password (defense-in-depth; aligns with Fort Knox anti-hacker).
- Build a new action `updateMyPasswordAction` (or generalize the existing one) + a small client form modeled on `src/components/auth/reset-password-form.tsx` (new-password + confirm inputs, `useActionState`). Reuse the `inputClass`, the sanitized error messages, and `checkRateLimit`.

### 3b. Change email (MEDIUM confidence on flow; HIGH on API)
`auth.updateUser({ email })` triggers Supabase's email-change flow. **Verified default behavior** (Supabase docs + GitHub discussion #42520): with **"Secure email change" ON (default)**, Supabase sends a confirmation link to **BOTH** the current and the new address; the email only changes after the required confirmation(s). With Secure email change OFF, only the new address gets a link. So the UI must:
- Collect the new email, call `updateUser({ email: newEmail }, { emailRedirectTo: <origin>/auth/callback })` (mirror the `emailRedirectTo` already used in `signUpAction`).
- Show a "Check your inbox (and your current email) to confirm the change" pending state, because the change is NOT immediate.
- Keep `profiles.email` in sync. NOTE: `profiles.email` is a separate denormalized column (`profiles.email text NOT NULL`, verified). Supabase updates `auth.users.email` on confirmation; there must be a trigger or webhook to mirror it to `profiles.email`. **Open question:** confirm whether an existing trigger syncs `auth.users.email -> profiles.email`. If not, plan a sync (DB trigger on `auth.users` update, or update `profiles.email` from the auth callback). Check `supabase/migrations` for an existing `handle_user_*`/`on_auth_user_updated` trigger before adding one.

Sources for the email-change behavior:
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://github.com/orgs/supabase/discussions/42520 (Secure Email Change UX, two-link confirmation)
- https://supabase.com/docs/guides/troubleshooting/change-email-associated-with-supabase-account-T5eHNT

### 3c. Notification preferences (HIGH confidence; table already exists)
`public.notification_preferences` is live (`supabase/migrations/0001_foundation.sql:185-197`), schema verified via `information_schema`:
- `id uuid PK`, `company_id uuid NOT NULL FK companies`, `user_id uuid NOT NULL`, `channel text CHECK in ('push','email','sms')`, `category text`, `enabled boolean NOT NULL default true`, `created_at`, `updated_at` (auto via `set_notif_pref_updated_at` trigger).
- UNIQUE `(user_id, channel, category)` -> perfect for upsert on conflict.
- RLS: two policies. Migration 0001 added `notif_pref_tenant` (`company_id = current_company_id()`); migration `0018_rls_lockdown.sql` added `notif_pref_own` (`is_coach() OR user_id = auth.uid()`). Live policy verified: `notif_pref_own` is `*` (ALL) with `(is_coach() OR (user_id = auth.uid()))`. So a user can read/write their OWN preference rows via the user client. (Confirm both policies coexist sanely; if `notif_pref_tenant` is still present it ANDs/ORs depending on lockdown intent — verify in 0018 during planning.)
- **Table is empty** (`select count` returned no category rows) and **NOT consulted** in the send path: `src/lib/notifications/push.ts` `sendPush` and `src/lib/notifications/triggers.ts` `notifyBroadcast` fan out unconditionally; neither reads `notification_preferences`. **Finding for the planner:** building the prefs UI gives storage but NOT enforcement. Decide scope: (A) UI + storage only (honest "we'll respect these" once enforcement lands), or (B) UI + wire `sendPush`/triggers to check prefs (default-on when no row). Recommend at least gating `sendPush` on the user's `push` prefs and force-on the `email` channel for billing-critical categories (the ai-junkies "always-on email for payment_events" pattern, `C:/Users/dre/ai-junkies-ref/src/app/(platform)/settings/notifications/page.tsx:60-68`).

Proposed categories (no DB enum; `category` is free text, so no migration needed unless we add a CHECK): `community` (broadcasts/replies), `coach` (coach messages), `reminders` (streak/check-in/plateau), `billing` (payment events — email force-on). Channels per category: `push`, `email` (sms deferred; Twilio is Phase-3/10DLC and `sms` is allowed by the CHECK but no sender wired).

Prefs read/write (sketch, new `src/lib/account/notification-preferences.ts`):
```ts
'use server';
// readMyNotificationPrefs(): select channel, category, enabled where user_id = ctx.userId
//   -> fold into a {category: {push: bool, email: bool}} map, defaulting missing rows to ON.
// setNotificationPref(category, channel, enabled): upsert onConflict 'user_id,channel,category'
//   with { company_id: ctx.companyId, user_id: ctx.userId, channel, category, enabled }.
// Use the user-session client so RLS notif_pref_own applies, OR service client (auth-gated already).
```
Client: a toggle matrix (`category` rows x `push`/`email` columns) modeled on the `LanguageToggle` `data-pending` + optimistic pattern and the ai-junkies `notifications/page.tsx` matrix. Billing/email toggle rendered as locked-on with a tooltip.

> Optional migration 0039 (only if desired): `ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_category_check CHECK (category IN ('community','coach','reminders','billing'));` Keep it optional — free-text category already works and avoids a deploy.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Cited |
|---|---|---|---|
| Email-change confirmation + double opt-in | Custom token + email | `supabase.auth.updateUser({ email }, { emailRedirectTo })` (Secure email change ON) | `signUpAction` already uses `emailRedirectTo`, `src/lib/auth/actions.ts:90` |
| Password change w/ current-pw check | Manual re-auth | `updateUser({ password, currentPassword })` (supabase-js 2.108.2 supports it) | `node_modules/@supabase/supabase-js/package.json` = 2.108.2 |
| Notif-prefs storage | New table | Existing `notification_preferences` + upsert on `(user_id,channel,category)` | `0001_foundation.sql:185-194` |
| Per-user data wipe (already done) | Manual cascade | `auth.admin.deleteUser` cascades via `profiles.id` FK | `src/lib/account/actions.ts:19-33` |
| Consent record for disclosure | New table | Existing `consent_captures` (no CHECK on consent_type) | `startCheckoutAction`, `src/lib/billing/actions.ts:77-85` |
| Money formatting in export/UI | Custom | `Intl.NumberFormat` with `_cents/100` | `account/billing/page.tsx:19-24` |

---

## Common Pitfalls

1. **Putting disclosure on `/checkout`.** `/checkout` is a `ComingSoon` stub; the real consent moment is the Subscribe button on `/account/billing`. Disclosure on `/checkout` would never be seen. (`src/app/(app)/checkout/page.tsx`.)
2. **Assuming email change is immediate.** It is NOT — Secure email change requires confirmation on both addresses. UI must say "pending confirmation," and `profiles.email` won't change until `auth.users.email` does. Verify a sync trigger exists.
3. **Notif-prefs UI implies enforcement.** The send path ignores the table today. Either wire enforcement or word the UI honestly. Force-on email for billing categories so users can't silently miss a failed-payment notice (compliance + retention).
4. **Exporting image bytes / secrets.** `progress_photos` -> paths only; redact `push_subscriptions` keys, security/audit tables. Export is a data-leak surface; keep an explicit allowlist.
5. **i18n parity.** Every new key MUST land in BOTH `en.json` and `es.json` (both currently have identical `app.*` subkey sets — 21 subkeys each, verified). No em dashes in any copy (global rule). Spanish must be real Spanish, not English fallback.
6. **Pre-existing bug to fix opportunistically:** `src/components/account/delete-account.tsx` calls `t('common.cancel')` under the `app` namespace, but `app.common.cancel` is **undefined** (only top-level `common.cancel` exists). The cancel button currently renders the raw key text. Add `app.common.cancel` (EN "Cancel" / ES "Cancelar") or fix the reference. Likely also `app.common.save` needed for the new forms.

---

## Architecture Patterns (project conventions, cited)

- **Server actions** live in `src/lib/<domain>/actions.ts`, `'use server'`, `requireAuth()` first, sanitized errors, fire-and-forget side effects via `void`. (`auth/actions.ts`, `billing/actions.ts`, `account/actions.ts`.)
- **Client form** = `'use client'` + `useActionState` + `useTranslations` + shared `inputClass`/`<Button>`/`<Card>`. (`reset-password-form.tsx`, `billing-actions.tsx`.)
- **RSC page** = `force-dynamic`, `requireAuth()`, `getTranslations('app...')`, read profile via `createClient()`. (`account/page.tsx`, `account/billing/page.tsx`.)
- **Service client everywhere** for cross-row reads/writes (auth-gated by the action). (`subscriptions.ts`, `entitlement.ts`.)
- **i18n**: namespace `app`, sub-keys per feature; persist locale to cookie + `profiles` (`i18n/actions.ts`). Add `app.account.*` (email/password/export/notif) and extend `app.billing.*` (disclosure/policy).
- **UI kit**: `Card`, `Button` (size="block"), `PageTitle`/`section`, `Icon`. Zero-border cards, pure black + olive, uppercase tracked labels. (`components/ui/*`.)

### Suggested file layout for `/account`
Keep `/account` as the hub; either inline sections or add sub-routes:
```
src/app/(app)/account/
  page.tsx                # hub: language, security (email/password), notifications, billing link, export, danger zone
  security/page.tsx?      # OR inline change-email + change-password (sub-route optional)
  notifications/page.tsx? # OR inline prefs matrix (sub-route optional)
src/components/account/
  delete-account.tsx      # exists
  change-email.tsx        # new (client form -> updateMyEmailAction)
  change-password.tsx     # new (client form -> updateMyPasswordAction)
  notification-prefs.tsx  # new (toggle matrix -> setNotificationPref)
  export-data.tsx         # new (button -> exportMyDataAction -> Blob download)
src/lib/account/
  actions.ts              # add exportMyDataAction, updateMyEmailAction, updateMyPasswordAction
  notification-preferences.ts  # new: read/upsert prefs
```
Recommendation: keep it as inline sections on a single `/account` page (matches the current single-screen account UX and the mobile-first design) rather than many sub-routes, unless the page gets long.

---

## i18n keys to add (EN + ES, both files)

New under `app.account.*`: `security` ("Security"/"Seguridad"), `changeEmail`/`changePassword` + CTAs, `currentPassword`/`newPassword`/`confirmPassword` labels, `emailChangePending` ("Check both your current and new inbox to confirm."), `exportData` ("Download my data"/"Descargar mis datos"), `exportPending`, `notifications` (section title), per-category + per-channel labels, `notifBillingLocked` tooltip. Add `app.common.cancel`/`app.common.save` (fixes the existing bug + serves new forms).

New under `app.billing.*`: `autoRenewDisclosure` (proximate to Subscribe), `autoRenewSummary` (standing), `refundPolicy`, optional `subscriptionTerms` link label.

> ES copy must be authored properly. No em dashes. Match the existing honest, plain tone of `app.billing.honestNote`.

---

## External Findings (cited)

- **Supabase email change**: default "Secure email change" sends a confirmation link to BOTH old and new email; the email changes only after confirmation. Disable to send only to the new address. (Docs + supabase/discussions#42520.)
- **Supabase password change**: `updateUser({ password })` works for a signed-in user without re-auth; optional `currentPassword` param (supabase-js >= 2.102.0; repo on 2.108.2) lets us require the old password. (Supabase passwords guide.)
- **Auto-renewal law**: ROSCA (federal) + CA ARL set the bar — clear/conspicuous, proximate disclosure of renewal + recurring price/cadence + cancel method, affirmative consent before charge, easy online cancel, retained acknowledgement. App already has easy-cancel + consent capture; gap is the proximate disclosure text + standing policy.
- **Reference repo (ai-junkies)** `src/app/(platform)/settings/notifications/page.tsx`: channel x category toggle matrix, time-of-day select, and "always-on email for payment_events (billing)" locked-toggle pattern — directly reusable design for the prefs UI.

---

## Open Questions

1. **Refund policy wording** — Stephanie's actual policy (no refund on renewal? prorated? cooling-off?) is an owner decision. Pricing is locked ($99.97 low) per memory, but refund terms are not in any file read. Needs her input before final copy.
2. **`profiles.email` sync on email change** — does an `on_auth_user_updated` trigger already mirror `auth.users.email -> profiles.email`? Grep `supabase/migrations` for a user-sync trigger during planning; if absent, plan one (trigger or callback update).
3. **Notif-prefs enforcement scope** — UI+storage only, or also wire `sendPush`/triggers to respect prefs? Recommend at least gating push + force-on billing email. Confirm with the planner whether enforcement is in-scope for WP10 or deferred.
4. **Disclosure consent strategy** — bump `CONSENT_VERSION` vs add a distinct `auto_renewal_disclosure` consent_type. Both work with zero migration (no CHECK on consent_type). Recommend a distinct type for auditability.
5. **0018 RLS interaction** — confirm `notif_pref_tenant` (0001) and `notif_pref_own` (0018) coexist correctly so a user-client upsert succeeds (or just use the service client, which the project already does everywhere).

---

## Migrations

- **0039 (optional, only if adding a category CHECK):** add `notification_preferences_category_check` constraining `category` to the agreed set. Not required for core scope — `category` is free text and upserts work today. Everything else in this WP is achievable with ZERO migrations (table exists, consent_captures has no constraint to fight).

---

## Verification Plan (in-browser, launchproof)

Role: a **subscriber** test account (`sample.sam`, pw `TFSample2026!` per MEMORY). Screen-by-screen:
1. **Account hub** — go to `/account`. See new Security (change email/password), Notifications, and "Download my data" sections plus the existing language/billing/sign-out/danger zone. Toggle UI language to ES and confirm all new copy is Spanish, no em dashes.
2. **Auto-renewal disclosure** — go to `/account/billing` as a non-subscribed user (or a fresh account). The Subscribe button shows the auto-renew disclosure (renews automatically, recurring amount/cadence, how to cancel) in visual proximity; the standing refund/cancel policy is visible on the page. In ES too.
3. **Data export** — click "Download my data," confirm a `thickandfit-my-data.json` downloads and contains the user's profile + their logs/check-ins/billing rows, and that it does NOT contain raw push keys / security/audit internals / image bytes.
4. **Change password** — submit new password (+ current password if required); confirm success and that re-login with the new password works.
5. **Change email** — submit a new email; confirm the UI shows a "confirm via both inboxes" pending state (not an immediate change). (Real email delivery needs Resend wired — verifiable in staging; in seed/test, assert the pending state + that `auth.users` shows a pending change.)
6. **Notification prefs** — toggle a category's push off; confirm the row upserts to `notification_preferences` (`node .qa-visual/sql.cjs "select * from notification_preferences where user_id='<id>'"`). Billing/email toggle is locked-on. If enforcement is in scope, trigger a broadcast and confirm push respects the off toggle.
7. **RLS regression** — after any schema touch, run `.qa-visual/rls-isolation-test.cjs` (MEMORY `rls-isolation`).

What needs real data vs seed: prefs upsert, data export, password change, and disclosure rendering are all verifiable now with seed accounts. Email-change confirmation delivery and live Stripe recurring-amount display need real Resend + Stripe config (staging); the pending-state UI and consent-record write are verifiable now.

---

## Sources

### Primary (HIGH)
- Codebase files read: `src/app/(app)/account/page.tsx`, `account/billing/page.tsx`, `checkout/page.tsx`, `src/components/account/delete-account.tsx`, `src/components/billing/billing-actions.tsx`, `src/components/auth/reset-password-form.tsx`, `src/components/i18n/language-toggle.tsx`, `src/lib/account/actions.ts`, `src/lib/auth/actions.ts`, `src/lib/auth/guards.ts`, `src/lib/auth/session.ts`, `src/lib/billing/actions.ts`, `src/lib/billing/stripe.ts`, `src/lib/billing/subscriptions.ts`, `src/lib/billing/entitlement.ts`, `src/lib/i18n/actions.ts`, `src/lib/notifications/push.ts`, `src/lib/notifications/triggers.ts`, `src/lib/notifications/types.ts`, `src/components/ui/card.tsx`, `supabase/migrations/0001_foundation.sql` (lines 185-212).
- Live DB (`node .qa-visual/sql.cjs`): `profiles`, `notification_preferences`, `notifications`, `consent_captures` columns + constraints + RLS; per-table `profile_id`/`user_id` ownership map; `consent_captures` has no CHECK on `consent_type`.
- `node_modules/@supabase/supabase-js/package.json` = 2.108.2 (current-password param available).
- Reference repo: `C:/Users/dre/ai-junkies-ref/src/app/(platform)/settings/notifications/page.tsx` (prefs matrix + always-on-billing-email pattern).

### Secondary (MEDIUM, verified across sources)
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://github.com/orgs/supabase/discussions/42520 (Secure Email Change two-link confirmation)
- https://supabase.com/docs/guides/troubleshooting/change-email-associated-with-supabase-account-T5eHNT
- https://supabase.com/docs/guides/auth/passwords (optional currentPassword)
- ROSCA + California ARL auto-renewal disclosure requirements (general legal baseline; final copy is owner/counsel's call).

## Metadata
- Standard stack: HIGH (all from files/DB).
- Architecture/patterns: HIGH (cited project conventions).
- External (Supabase email/password flow): MEDIUM-HIGH (official docs + maintainer discussion).
- Legal disclosure requirements: MEDIUM (well-established ROSCA/ARL principles; exact wording needs owner sign-off).
- Research date: 2026-06-28. Valid until ~2026-07-28 (Supabase auth API is stable; re-verify if supabase-js major bumps).
