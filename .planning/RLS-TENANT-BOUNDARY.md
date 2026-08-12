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
