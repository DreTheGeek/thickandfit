# Scan Pipeline Delta Build — Claude Code Handoff
**Repo:** DreTheGeek/thickandfit | **Branch:** `main` | **Date:** 2026-07-31
**Companion doc:** SCAN-PIPELINE-GAP-ANALYSIS.md (the why behind every PRD)

## What this is
Four small PRDs closing the ONLY remaining gaps in the photo-scan pipeline. The 15-stage
FitnessOS pipeline is otherwise already live on main (see gap analysis). Total scope:
~8-12 hours of AI execution. No new runtimes, no n8n, no edge functions. Everything rides
the existing Next.js route handlers + server libs + pg_cron pattern.

## Before ANY code (get-up-to-speed ritual)
1. Read `CLAUDE.md` (conventions, hooks, branch map — note: `main` IS the launch branch,
   phase-2/phase-3 branches are historical, see `.planning/STATE.md` CURRENT STATUS).
2. Read `.planning/STATE.md` + `.planning/FitnessOS-Architecture-v1.md` section 8.1
   (Intelligence Layer build log — these PRDs extend that work).
3. `git log --oneline -15` and `pnpm build` to confirm green baseline.
4. **Migration number:** STATE.md's "next migration" notes are STALE. The on-disk ladder
   runs to `0098_support_triage.sql`. Next migration is **0099**. Verify with
   `ls supabase/migrations/ | sort | tail -3` before writing any migration.

## Execution order
```
PRD-A (scan images, all outcomes)   — independent, do first, ~1-2h
PRD-B (determinism cache)           — independent, ~1-2h (owns migration 0099)
PRD-C (post-scan coach moment)      — independent, ~3-5h
PRD-D (fat-bias eval + auto-accept) — eval half independent; auto-accept half is
                                       FLAG-OFF until the eval half reports, ~2-4h
```
One PRD per session/commit-group. Run each PRD's Verify block before moving on.

## House rules that bite here (from CLAUDE.md, enforced by .claude/hooks/)
- Blocking hooks: check-rls-enabled, check-tenant-column, check-use-client, typecheck,
  lint. Exit 2 blocks the write. Never disable a hook.
- ESLint + Prettier (NOT Biome). Single quotes, semicolons, 100-char lines, kebab-case files.
- Telemetry NEVER breaks a request: fire-and-forget with swallowed errors
  (see `src/lib/events/emit.ts`, `src/lib/ai/inferences.ts` for the contract).
- `"use client"` first line on any interactive component.
- All model routing through `src/lib/ai/models.ts` AI_MODELS. Never hardcode a model id.
- Bilingual EN/ES: any user-facing string goes in `src/messages/en.json` + `es.json`
  via next-intl. No hardcoded copy.
- No new tables without company_id + RLS (PRD-B's migration is an index only).

## Global verification (after all 4 PRDs)
```bash
pnpm tsc --noEmit          # exit 0
pnpm lint                  # exit 0
pnpm build                 # green prod build
pnpm eval:scan             # eval harness still passes; new fat-bias axis reports
```
Manual: one real photo scan end-to-end in the browser (scan → confirm → coach moment
renders → correction on a second scan attaches to the ORIGINAL inference when the
cache serves it).

## Explicitly out of scope (do not build, the repo's own gates are correct)
K10 layers 2-4, per-user portion bias (F4, eval-gated), KG LLM triple extraction,
domain_events subscribers/projections, depth-sensor volume estimation, any n8n or
workflow engine, any new edge function.
