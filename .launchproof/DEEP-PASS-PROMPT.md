# The Deep-Pass Prompt (paste into Claude Code alongside a launchproof run)

Scaling line - pick ONE and prepend it:
- Quick pass: `Be concise; single-vote verification.`
- Launch audit: `ultracode` (triggers the multi-agent workflow path: parallel dimension auditors,
  3+ independent refuters per finding, loop until two passes find nothing new).

---

ROLE: Senior staff engineer doing a launch-readiness hardening pass on this app. Get it to
"complete, hardened, safe to ship" - VERIFIED at the observed-behavior level, not assumed.
FIRST read `.launchproof/PLAYBOOK.md` (the method + this app's known traps + tools of record)
and obey it over anything generic below. Work in atomic commits (house style). Deploy only at
verified-stable points via `vercel deploy --prod`.

GROUND RULE: every claim backed by reading real code OR querying the live system, on the
three-level ladder: code conformance -> live schema/config -> observed behavior in prod. Nothing
is done below level 3. Adversarially verify every finding before reporting it (independent
refuter, default-refute); re-verify every fix by re-driving the flow.

PHASE A - INSPECT THE LIVE STATE (first, always; this is where real gaps hide):
1. DB: tables + row counts; classify seeded / real / empty-expected / empty-but-should-have-content.
2. RLS: run the isolation test as a real low-privilege user (`node .qa-visual/rls-isolation-test.cjs`).
   Watch the single-tenant trap (PLAYBOOK #2). Every new table goes INTO the test's list.
3. Migrations: repo files vs applied state (query information_schema via `.qa-visual/sql.cjs`).
4. Crons: `select * from cron.job` + recent `cron_job_log` rows. A registered job with no log rows
   has NEVER fired. Probe each internal route with the real CRON_SECRET (200 + log row = proven).
5. Zero-caller sweep: grep every exported server action / lib fn for UI callers. No caller = not built.
6. Env/config: Management API for auth config (email confirm, OAuth providers); `vercel env ls` for
   what exists per environment (values are encrypted - to align a secret, rotate it).

PHASE B - AUDIT EVERY DIMENSION (cite file:line): secrets, auth/session (server-verified),
authz (ownership + role on every mutation), input validation (Zod everywhere), CSRF posture,
rate limits (auth, public, anything that costs money or sends email), payments (webhook signature,
idempotency, 3DS, integer cents), data integrity (FKs, NOT NULL tenant/owner), error handling
(no leak, no swallow), fire-and-forget correctness (after(), PLAYBOOK #1), performance (build,
hydration, N+1), UX completeness (dead controls, unreachable routes, empty/error/loading states,
golden path), copy/i18n/a11y/SEO (parity check, no "AI" in user copy, no em dashes), legal/consent,
observability (Sentry wired AND keyed), headers/CSP, metrics-without-sources (PLAYBOOK #6).

PHASE C - ADVERSARIALLY VERIFY each candidate finding (independent refuters; drop what you
cannot substantiate with the exact code or a live probe).

PHASE D - FIX. Smallest correct change, one fix = one commit. Close the operational layer too:
register crons (rotate + align CRON_SECRET if needed), apply migrations to prod + verify, wire
zero-caller features or remove their dead UI. Gate for explicit approval: destructive/outward
actions, schema drops, key rotation beyond CRON_SECRET, anything sending real email/SMS to real
people, legal copy (wire the capture, flag the content - never fabricate it).

PHASE E - RE-VERIFY + SHIP: tsc + build + isolation test + i18n parity + the golden-path e2e
against the DEPLOYED target as a real member (per PLAYBOOK gate) -> `vercel deploy --prod` ->
confirm READY + ping 200 + one real flow. Then run the launchproof breadth sweep
(`/launchproof <url>`) and work its safe findings; confirm authed surfaces actually crawled
(ledger rows > 0, not runs: 0).

OUTPUT: (1) confirmed findings table (severity, file:line, evidence, fix); (2) what was fixed WITH
the re-verification proof for each; (3) the HUMAN PUNCH-LIST - every item needing my decision, a
credential, a dashboard toggle, legal copy, or content, with the exact step. Do not report "100%"
unless build + isolation + deploy-verify all pass AND the punch-list is empty or acknowledged.
