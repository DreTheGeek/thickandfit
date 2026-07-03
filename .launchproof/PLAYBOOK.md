# Launch-Hardening Playbook (Thick & Fit)

This is the operating method for ANY launch-readiness pass on this app - launchproof runs, deep
prompts, or a fresh Claude session. It encodes how the deep passes that actually found things were
run. Read this FIRST; the SOP governs launchproof mechanics, this governs judgment.

## The one governing rule

**Every claim must be backed by reading the real code OR querying the live system.** "It builds"
is not "it works." "The commit says X" is not "X happens in prod." The three-level ladder:

1. **Code conformance** - the file does what the spec says (grep/read, cite file:line).
2. **Schema/live state** - the DB/config actually has it (query prod, never assume).
3. **Observed behavior** - drive the real flow end to end and watch the data land.

Nothing is DONE below level 3. A finding is only REAL after an adversarial verify pass (spawn an
independent skeptic told to REFUTE it; default-refute on uncertainty). A fix is only FIXED after
re-driving the flow.

## Tools of record (this app)

| Task | How |
|---|---|
| Any SQL vs prod (incl. non-public schemas) | `node .qa-visual/sql.cjs "select ..."` (Management API) |
| Apply a migration to prod | same Management API pattern; then verify columns/RLS landed |
| RLS isolation proof | `node .qa-visual/rls-isolation-test.cjs` - must PASS n/n; ADD every new table to its FORBIDDEN list |
| Auth config (email confirm, OAuth providers) | Management API `GET /v1/projects/{ref}/config/auth` |
| Drive prod as a real user | puppeteer-core from `~/.launchproof/runtime`, Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` |
| Test accounts | sample.casey (coach) / sample.sam (subscriber) / sample.faye (free), pw in memory/test-accounts |
| Deploy | `vercel deploy --prod` (git push does NOT deploy); verify: READY + ping 200 + drive one real flow |
| i18n parity | flatten en.json/es.json key sets; counts must be EQUAL and mutual |
| Internal jobs | CRON_SECRET bearer POST to /api/internal/*; a 200 + cron_job_log row = proven |

## Known traps (each one burned us once)

1. **Frozen lambda kills floating promises.** A bare `void asyncFn()` after the response dies on
   Vercel. Wrap post-response side effects in `next/server` `after()`. In dev they complete, so a
   dev-only e2e will falsely pass - verify fire-and-forget writes IN PROD.
2. **Single-tenant RLS trap.** Every user shares one company_id, so a `company_id = current_company_id()`
   policy isolates NOBODY between members. Per-user tables must gate on the user's own id; privileged
   tables on role. Service-client reads BYPASS RLS and hide holes - the only proof is the isolation
   test as a low-privilege user.
3. **Paywall is PER-PAGE.** `(app)/layout.tsx` only authenticates. Every new (app) page must call
   requireEntitled/requireAuth/requireCoach itself. Check this on every new page.
4. **"Wired" is not "scheduled."** A cron route + a registration SQL file is nothing until the job
   exists in `cron.job` AND a run lands in `cron_job_log`. Probe with the real secret.
5. **Zero-caller features.** An action/lib with no UI caller is NOT built (comp grants, habit assign,
   form assign were all zero-caller). Grep for callers before marking anything live.
6. **Metrics without sources.** Never offer an option the system cannot compute (challenge steps/
   water/points had no data source; boards sat at 0 forever).
7. **Model choices need benchmarks, not vibes.** gpt-5 at reasoning-effort low was 10x FASTER and
   more accurate than the "fast" model. Probe live with the exact production prompt.
8. **puppeteer must use localhost, not 127.0.0.1** in dev (Next blocks cross-origin dev assets ->
   SSR-only pages -> buttons dead). Windows paths with spaces: never bash heredocs for scripts with
   backslash paths - Write the file.
9. **E2E assertions must target the exact element.** Ambient page text ("logged" elsewhere) produced
   a false positive that wasted a whole diagnosis cycle. Assert on the specific card/row/DB row.
10. **vercel env pull does not decrypt.** To align a secret across Vercel + DB jobs, ROTATE it (you
    control the new value); a redeploy is required before the running lambdas see it.
11. **recharts is blank on React 19** - pure-SVG charts only.
12. **Two subscription tables.** `client_subscriptions` = CRM import (ghl-sync); `subscriptions` =
    native Stripe webhook. Any billing view must consider BOTH (union, dedupe on contact.profile_id).

## House rules that gate every fix

- Brand: user-facing copy NEVER says "AI" (EN or ES). Em dashes do not exist in this codebase.
- i18n: en/es lockstep - same commit, parity check after.
- Money: bigint cents. Every table: company_id + RLS + the isolation-test entry.
- Commits: atomic, `fix(scope): what was broken and what fixed it`. Migrations: additive, applied
  to prod via the Management API workflow, then verified.
- Never `git push` = deployed. Never claim green without re-running the check.

## The verification gate (before calling anything launch-ready)

1. `pnpm exec tsc --noEmit` + eslint on touched files (hooks enforce anyway).
2. `pnpm build` green.
3. RLS isolation test green, INCLUDING new tables.
4. i18n parity exact.
5. Golden-path e2e against the deployed target as a REAL member (sign in, log food by text + photo
   with a >5% gram edit, check data landed: food_log link, ai_inferences correction, domain_events).
6. Deploy + verify: READY, ping 200, one real flow driven post-deploy.
7. Write the HUMAN PUNCH-LIST: everything needing a key, an account, legal copy, content, or an
   owner decision - with the exact step. Never report "100%" while the punch-list is non-empty
   and unacknowledged.
