# The tenant boundary is not enforced on 21 policies

Found 2026-08-12 auditing the member portal. **Not exploitable today. It becomes exploitable the
day a second company exists**, which is a direction CLAUDE.md states the architecture supports
("company (Stephanie is tenant 1, architecture supports white-label later)").

Written down because it is the kind of thing that is invisible until it is urgent, and because the
fix is in `supabase/migrations/`, which agents are blocked from touching.

## What is wrong

`public.is_coach()` (0018) resolves to a role claim and nothing else:

```sql
select coalesce((auth.jwt() ->> 'user_role'), '') in ('coach', 'assistant_coach', 'operator');
```

There is no company in it. 21 policies grant access on `is_coach()` alone, with no `company_id`
predicate anywhere in the policy. Two current examples:

```sql
-- profiles (last set in 0034_rls_hardening.sql)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coach());

-- form_responses (last set in 0027_rls_lockdown_2.sql) -- note FOR ALL, and the same WITH CHECK
create policy form_responses_own on public.form_responses for all to authenticated
  using      (public.is_coach() or profile_id = auth.uid())
  with check (public.is_coach() or profile_id = auth.uid());
```

So a coach role in company A can read every profile in company B, and can read AND WRITE every
`form_responses` row in company B. Since the August sweep, that table holds her members' weight,
circumferences, sleep, mood and their "why".

## Why other policies do not save it

**Every policy in the schema is PERMISSIVE.** `grep -i "as restrictive" supabase/migrations/*.sql`
returns nothing. Permissive policies are OR'd, so a tenant-scoped policy sitting beside one of these
does not narrow it: if either grants, access is granted. Adding a correct policy next to a broad one
achieves nothing; the broad one has to change.

## The 21

Resolved to each policy's LATEST definition, since several are dropped and recreated across
migrations and the historical versions are noise.

| table | policy | last set in |
|---|---|---|
| `public.profiles` | `profiles_select` | 0034 |
| `public.form_responses` | `form_responses_own` | 0027 |
| `public.form_assignments` | `form_assignments_own` | 0027 |
| `public.plan_assignments` | `plan_assignments_own` | 0027 |
| `public.onboarding_responses` | `onboarding_own` | 0018 |
| `public.workout_logs` | `workout_logs_own` | 0018 |
| `public.set_logs` | `set_logs_own` | 0018 |
| `public.workout_completion_history` | `wch_own` | 0018 |
| `public.consent_captures` | `consent_own` | 0018 |
| `public.notification_preferences` | `notif_pref_own` | 0018 |
| `public.community_posts` | `community_posts_delete` | 0026 |
| `public.post_comments` | `post_comments_delete` | 0026 |
| `public.challenge_participants` | `challenge_participants_delete` | 0026 |
| `public.exercise_substitutions` | `subs_modify` | 0028 |
| `public.waitlist_leads` | `waitlist_coach_read` | 0034 |
| `public.email_send_log` | `email_send_coach` | 0027 |
| `public.ai_usage_log` | `ai_usage_coach` | 0027 |
| `public.api_usage_log` | `api_usage_coach` | 0034 |
| `public.webhook_events` | `webhook_events_coach_read` | 0025 |
| `storage.objects` | `progress_photos_obj_read` | 0032 |
| `storage.objects` | `chat_attachments_obj_read` | 0072 |

The two `storage.objects` rows are the most sensitive: progress photos and chat attachments are
members' bodies and their private conversations. Their comments are explicit that
`storage.objects` has no company column and ownership is the profile-id folder, which is a correct
statement of the constraint and also exactly why the coach arm of those policies is unbounded.

## Two things this is NOT

- **Not a live breach.** One company exists. There is no second tenant to cross into, so nothing is
  reachable today that should not be.
- **Not the ROADMAP-MERGED findings.** Those named the profiles self-scope and the missing
  `WITH CHECK`, and 0028/0034 genuinely fixed them. The tenant dimension was simply never part of
  that pass. A policy can be correct about *which user* and still silent about *which company*.

## The shape of the fix

Not attempted here: `supabase/migrations/` is on the agent guard's blocked list, correctly, because
these run against production member data.

Two options, and the second is the one that scales:

1. Add `company_id = public.current_company_id()` to all 19 public-schema policies. Correct, and
   nineteen chances to forget one on the next table.
2. Make the helper carry the tenant, e.g. `is_coach_here()` = role check `AND` company match, and
   use it everywhere `is_coach()` is used as an access grant. One definition, one thing to get
   right, and a name that says what it means. The existing `is_coach()` stays for the few places
   that genuinely want "is this person staff anywhere", if any exist.

For `storage.objects`, where there is no company column, the tenant has to come from the object path
(the bucket is already namespaced by profile id, so a company segment or a join against `profiles`
is the available route).

**Verify by observation, not by the policy reading correctly.** CLAUDE.md notes RLS has leaked three
times historically and that `.qa-visual/rls-isolation-test.cjs` exists for exactly this: prove a
company-B JWT sees zero company-A rows, per table, before calling it fixed.

---

## Written 2026-08-19: `0142_tenant_boundary.sql`

**Not applied yet.** The migration exists; it has to be run and then verified in a browser, exactly
like 0140 and 0141. Applying it is step 1 of `.planning/RUNBOOK-2026-08-14.md`.

**It took option 2, with a correction.** The plan above suggested a helper carrying the tenant. The
migration keeps `is_coach()` as-is and adds `public.auth_company_id()`, then writes
`public.is_coach() and company_id = public.auth_company_id()` at each of the 20 tables that carry
the column. Same number of edit sites as option 1, which is a real cost — but the alternative, a
combined `is_coach_here()` with no argument, cannot see the row's `company_id` and so would have had
to read the caller's company and compare against nothing. The predicate needs the row.

**The trap that would have taken the console down.** `current_company_id()` (0001) reads
`auth.jwt() ->> 'company_id'` — a CUSTOM CLAIM, injected by an auth hook that CLAUDE.md lists under
"Manual / Post-Deploy Steps", i.e. something a human has to have done. If that hook was never set,
the claim is absent, the function returns null, `company_id = null` evaluates to NULL rather than
true, and this migration denies every coach read in the product. Locking Stephanie out of her own
console to close a hole that requires a second tenant to exist is not a trade worth making.

`auth_company_id()` prefers the claim and falls back to the caller's own `profiles` row, so it is
right either way. It is `SECURITY DEFINER` because `profiles_select` is a policy ON profiles calling
a function that READS profiles; running as the owner is what stops that recursing, and no table here
sets `FORCE ROW LEVEL SECURITY`, so the owner does bypass RLS.

**Blast radius is small and was measured, not assumed.** Only 3 files under `src/app/(app)/coach`
and `src/lib/coach` use the RLS-bound client; 49 use the BYPASSRLS service client. And only the
`is_coach()` branch is narrowed — every `= auth.uid()` branch is copied through untouched, so no
member's access to her own data is affected. With one company, `company_id = auth_company_id()` is
true for every row a coach can already see, so this should change nothing today.

**`webhook_events` is the 21st and could not be scoped.** It is the Stripe idempotency ledger (0025)
keyed on `stripe_event_id`, with no company column. Rather than invent a tenant column on an ops
ledger, the policy was narrowed from `is_coach()` to a new `is_operator()`. That is the one thing in
the migration that changes who can see something today: a coach or assistant coach loses read access
to raw Stripe event payloads, which they had no reason to have.

**The audit is now a test.** `node .qa-visual/tenant-boundary-test.mjs` parses every migration in
order, resolves each policy to its final definition, and fails if any grants on `is_coach()` without
constraining the company. Run against the pre-0142 schema it reports exactly the 21 above. It also
catches the NEXT one: a new table shipping a copy-pasted
`using (public.is_coach() or profile_id = auth.uid())` fails in the diff rather than a year later.
`webhook_events` is exempted by name, with its reason in the file, so the gap is a decision on the
record rather than a silent omission.

**Still true: this is static analysis, not observation.** The migration has not run, and a passing
parser is not a company-B JWT seeing zero company-A rows. `storage.objects` is also still untouched
— there is no company column there and the tenant has to come from the object path.
