# PRD-A: Persist Every Scan (Failures Included)
**Branch:** main | **Risk:** LOW | **Migration:** none | **AI time:** ~1-2h
**Depends on:** nothing | **Unlocks:** richer replay/eval corpus for every future model swap

## Problem
`src/app/api/nutrition/photo/route.ts` persists the scan image via
`after(() => storeScanImage(inferenceId, image))` — but only when
`result.status === 'ok' || result.status === 'product'`. Two data losses:

1. **Failed scans lose their pixels.** `analyzeSmartPhoto` (src/lib/nutrition/smart-scan.ts)
   logs an `ai_inferences` row for noFood/clarify/error outcomes (when ctx is present), but the
   `inferenceId` is only threaded back onto ok/product results, so the route can never store the
   image for a failure. The photos that FAIL are exactly the replay set you want when a better
   model ships (GPT-6/Gemini 4 replay is the whole point of storing originals).
2. **Two early-return paths log no inference at all:** in `analyzeSmartPhoto`, the
   `call.status !== 'ok'` branch and the top-level `catch` both return `{status:'error'}`
   before `logInference` runs. Those scans are invisible — no provenance row, no image, no
   trace on /admin/traces.

## Delta
MODIFIED: `src/lib/nutrition/smart-scan.ts`, `src/app/api/nutrition/photo/route.ts`
ADDED: nothing. REMOVED: nothing.

## Tasks

### A1. Thread inferenceId onto ALL result variants
In `smart-scan.ts`, extend the `SmartScanResult` union so `clarify`, `noFood`, and `error`
variants also carry optional `inferenceId?: string` (and `model?: string` where a model
actually answered). After the existing `logInference` call, attach the returned id to
whatever result variant is being returned, not just ok/product.

### A2. Log inference on the silent failure paths
- `call.status !== 'ok'` branch: when `ctx` is present, `logInference` with
  `status: 'error'`, `model: 'none'` (or the last-attempted model if `callJson` exposes it),
  `inputHash`, `latencyMs: Date.now() - tVision`, `rawOutput: null` before returning.
- Top-level `catch`: same, with `status: 'error'`. Keep it inside its own try/catch —
  telemetry never throws (house contract, see inferences.ts header).
- JSON-parse failures of `call.content` currently fall into the generic catch; they now get
  a row too (that's the fallback-chain's "model returned garbage" signal the eval wants).

### A3. Store the image on every inference
In `route.ts`, change the guard from `(ok || product) && inferenceId` to simply
`result.inferenceId` — any outcome that produced a provenance row persists its pixels.
Keep the `after()` wrapper exactly as-is (the comment explains why: serverless freeze).
`storeScanImage` (src/lib/nutrition/scan-store.ts) already has sanity bounds (8MB cap,
data-URL-only) and swallows failures; no changes needed there.

### A4. Storage hygiene note (doc-only, no code)
Add one line to CLAUDE.md Tier Caps section: `ai-scans/` now grows with failed scans too;
revisit retention if the bucket approaches the Supabase storage tier cap. (At client-downscaled
JPEG sizes ~200-500KB and 256 launch clients this is years away — noting it is enough.)

## Acceptance criteria
- AC-1: A scan that returns `noFood` (photo of a desk) produces an `ai_inferences` row with
  status `noFood` AND an object at `food-photos/ai-scans/<inference_id>.jpg`.
- AC-2: A scan with OPENROUTER_API_KEY pointed at a dead endpoint (simulate provider outage)
  produces an `ai_inferences` row with status `error`. No user-facing behavior changes.
- AC-3: ok/product behavior byte-identical to today (correction capture, eval attribution,
  scan-context loop all read the same fields).

## Verify
```bash
pnpm tsc --noEmit && pnpm lint
# manual: scan a non-food photo while watching the ai_inferences table + storage bucket;
# then scan a real meal and confirm the ok path still logs + stores exactly one row/object.
```

## Out of scope
Retention/cleanup cron, storing remote-URL images (route already rejects them), any UI change.
