# PRD-B: Scan Determinism Cache
**Branch:** main | **Risk:** MEDIUM (touches the moat path) | **Migration:** 0099 (index only)
**AI time:** ~1-2h | **Depends on:** PRD-A (inferenceId on all variants) | **Unlocks:** PRD-D auto-accept trust

## Problem
Same plate, scanned twice, returns different numbers. This is the #1 trust complaint across
the entire category (research: re-scan variance destroys trust faster than being wrong;
Cal AI reviews are full of it). The repo already computes `hashInput(image)` in
`smart-scan.ts` and stores it as `ai_inferences.input_hash` — but never reads it back.
Every double-tap or retry burns a fresh gpt-5 vision call and can produce a different answer.

## Design
Before the vision call in `analyzeSmartPhoto`: look up this member's most recent successful
inference with the same `input_hash` and the same `PROMPT_VERSION` inside a 24h window. On a
hit, skip the model entirely and re-run the DETERMINISTIC half of the pipeline
(`resolvePredictedItems` for meals / the product grounding path) over the cached
`raw_output` (which stores the full `VisionOut` JSON). The foods lookup is deterministic
given DB state, so: same photo → same vision output → same answer, fresh DB macros.

Rules:
- Cache key: `(profile_id, input_hash, prompt_version)` — member-scoped on purpose. K1
  member context differs per member, and cross-member reuse would leak nothing but would
  also serve one member another's context-biased read.
- Only `status IN ('ok','product')` rows are cache-eligible. Failures re-try the model.
- Window: 24 hours. Longer risks serving stale member-context behavior; shorter misses the
  double-tap. Module constant so tuning is one diff.
- A cache hit threads the ORIGINAL `inferenceId` back onto the result, so a correction made
  on the second scan attaches to the inference that actually produced the prediction
  (eval attribution stays clean, no double-counting).
- A cache hit does NOT write a new `ai_inferences` row (it is not a new inference). Log a
  console line `[smart-scan] cache hit <inferenceId>` for latency attribution, same style
  as the existing timing logs.
- `PROMPT_VERSION` bump auto-invalidates (it's part of the key). Model chain changes don't
  need invalidation — the cached VisionOut was already accepted output.
- Ambiguity guard: `clarify` results are NOT cached (status guard covers this — clarify is
  not ok/product after PRD-A threading).

## Delta
ADDED: migration `supabase/migrations/0099_scan_cache_index.sql`
MODIFIED: `src/lib/nutrition/smart-scan.ts`
REMOVED: nothing.

## Tasks

### B1. Migration 0099 — partial index (verify 0099 is still next before writing)
```sql
-- 0099: scan determinism cache lookup. Member-scoped replay of an identical photo within
-- 24h skips the vision model (same photo -> same answer). Partial: only the moat feature's
-- successful rows are ever probed.
create index if not exists idx_ai_inferences_scan_cache
  on public.ai_inferences (profile_id, input_hash, created_at desc)
  where feature = 'photo-scan' and status in ('ok', 'product');
```
No RLS change (ai_inferences policies untouched; reads go through the service client
exactly like `buildScanContext` already does).

### B2. Cache probe in smart-scan.ts
New module-private `findCachedScan(profileId, companyId, inputHash)`: service-client select
on `ai_inferences` — `feature='photo-scan'`, `profile_id`, `input_hash`, `prompt_version =
PROMPT_VERSION`, `status in ('ok','product')`, `created_at > now()-24h`, order desc, limit 1,
returning `{ id, raw_output, model, status }`. Never throws; null on any error (a DB blip
must not block scanning — same contract as buildScanContext).

Call it right after `hashInput(image)` and ONLY when `ctx` is present (no ctx = eval
harness = must always hit the live model; a cache would poison eval runs).

### B3. Replay path
On a hit, branch into the SAME meal/product handling code that processes a fresh `VisionOut`
(refactor the post-parse block into a shared function rather than duplicating it —
`resolveVisionOut(out, locale)` — so fresh and cached paths cannot drift). Thread the cached
`inferenceId` + `model` onto the result. Skip `logInference` and skip the route's
`storeScanImage` for cache hits (image already stored under the original id — route sees
the original inferenceId; make `storeScanImage` upsert-safe idempotent, which it already is
via `upsert: true`, so no route change is strictly required).

### B4. Timing log
Extend the existing `[smart-scan]` console line with `cache hit|miss` so prod latency
attribution shows the cache's effect.

## Acceptance criteria
- AC-1: Scanning the exact same photo twice within a minute: second response returns in
  <2s (no vision latency), identical items/grams, same `inferenceId` as the first.
- AC-2: Correcting the second (cached) scan writes the correction to the ORIGINAL
  ai_inferences row (verify `correction.items` populated on that row).
- AC-3: `pnpm eval:scan` results are byte-identical before/after this PRD (ctx-less runs
  never touch the cache).
- AC-4: Bumping PROMPT_VERSION invalidates: same photo after a bump hits the live model.

## Verify
```bash
pnpm tsc --noEmit && pnpm lint && pnpm eval:scan
# manual: double-scan the same photo; check logs for "cache hit", check timing, check the
# ai_inferences table gained exactly ONE row for the two scans.
```

## Out of scope
Cross-member caching, cache warming, storage-level dedupe, any TTL cron (the window is a
query predicate, not state).
