# PRD-D: Fat-Bias Eval Axis + Confidence-Gated Auto-Accept
**Branch:** main | **Risk:** MEDIUM (eval half LOW; auto-accept touches the moat UX)
**Migration:** none | **AI time:** ~2-4h
**Depends on:** PRD-B recommended first (determinism makes auto-accept trustworthy)
**Gate:** auto-accept ships FLAG-OFF and stays off until the eval half reports numbers.

## Problem (two halves, one PRD because the second is gated on the first)

**Half 1 — fat bias.** The July 2026 NIH/NIDDK controlled-kitchen study: every tested
competitor underestimates ~250-345 kcal/meal, driven by ~30g/meal of invisible fat (oil,
butter, dressing). It is a BIAS, not noise. The smart-scan prompt already mandates a
"cooking oil" item on pan-fried/roasted plates — but nothing measures whether that line
actually closes the gap. `scan-scoring.ts` scores food-ID F1 + portion MAPE only; a scan
can pass while systematically missing 25g of fat.

**Half 2 — auto-accept.** Research: NO mainstream app ships confidence-gated auto-logging
(Cal AI logs-then-fix, MacroFactor is review-first). The repo already has confidence tiers
(0.9/0.7) in the scan UX. Auto-accepting high-confidence scans with an undo toast is an
open competitive lane — but only defensible once the eval says high-confidence scans are
actually right, hence the gate.

## Delta
MODIFIED: `src/lib/ai/eval/scan-scoring.ts`, `src/lib/ai/eval/run-scan-eval.ts`,
eval gold manifest (wherever `pnpm eval:seed` reads it — locate it, likely under scripts/
or a fixtures dir), `src/components/nutrition/photo-scan.tsx`
ADDED: gold cases (10-15 high-fat meal photos + labels), one env flag
REMOVED: nothing.

## Tasks

### D1. Extend scoring with a fat axis (pure, deterministic — keep the module IO-free)
- `ExpectedItem` gains optional `fat_g?: number` (label-level fat for that item, when known)
  and `ExpectedCase` gains optional `total_fat_g?: number` (whole-plate label when per-item
  isn't practical — oily plates are exactly where per-item attribution is hard).
- `CaseScore` gains `fatBiasG: number | null` — SIGNED (predicted_total_fat - expected_total_fat)
  in grams. Signed on purpose: the NIH failure is directional underestimation; MAPE would
  hide the direction. Null when the case carries no fat labels.
- Predicted total fat: the runner already resolves predictions through the foods corpus
  (`run-scan-eval.ts`); sum resolved `fat_g`-scaled macros per predicted item. If the runner
  currently scores on names+grams only, extend it to carry the resolved macros through to
  scoring — resolution stays in the runner (IO), scoring stays pure.
- Do NOT change pass/fail bars in this PRD (PASS_F1/PASS_MAPE untouched). fatBiasG is
  REPORTED per-case and aggregated (mean signed bias across fat-labeled cases) in the run
  summary + stored in the `ai_eval_runs` row's detail JSON. A pass-bar for fat comes after
  a baseline exists — never tune a threshold and the metric in the same change.

### D2. Seed the high-fat gold set
10-15 gold cases weighted to the NIH failure modes: pan-fried protein, dressed salad,
restaurant plates, avocado/nuts, visible-oil stir fry. Label total fat from known recipes or
weighed/label data — approximate labels are fine if honest (the metric is bias across the
set, not any single case). Follow the existing manifest format `pnpm eval:seed` consumes.
Note in each case whether oil was visibly used, so the report can split "oil plates" vs
"dry plates" bias.

### D3. Run + report baseline
`pnpm eval:scan` across the extended set; record mean fatBiasG overall and for the oil-plate
subset, per model (the harness already A/Bs the SCAN_CHAIN models). Write the numbers into
the PRD completion notes + `.planning/FitnessOS-Architecture-v1.md` build log. Decision
rule for the FUTURE prompt-tuning PRD (not this one): |mean bias| > 8g fat/meal on oil
plates = the cooking-oil prompt line isn't enough.

### D4. Auto-accept behind a flag (build now, enable later)
In `photo-scan.tsx`:
- Flag: `NEXT_PUBLIC_SCAN_AUTO_ACCEPT` (default absent = OFF). Client-readable env is fine —
  this is a UX switch, not a secret.
- When ON and a meal result arrives where EVERY candidate has `confidence >= 0.9` AND
  `matched === true` (no unresolved items) AND status is not clarify/product: skip the
  confirm screen, call `logPhotoFoodAction` per item immediately with predicted values
  (predictedFoodId = foodId, predictedGrams = grams — accepted-as-is flows through the
  existing correction capture as `fields: []`, which is exactly the confirmed-correct
  training signal `recordItemOutcome` already handles).
- Render a persistent-until-dismissed toast: localized "Logged: <items summary>" +
  **Undo** button (5s prominence, then collapses into the diary entry). Undo calls the
  existing `deleteFoodLogAction` for each created log id — the actions must return their
  log ids for this (extend `LogResult` if PRD-C hasn't already).
- PRD-C interplay: the coach moment renders inside this toast when present (one surface,
  not two competing toasts).
- Product scans, clarify flows, and any item below 0.9 fall through to today's confirm UI
  unchanged.

### D5. Enablement criteria (documented in the PRD, executed later by a human decision)
Flip the flag in Vercel only when: eval F1 >= 0.8 AND portion MAPE <= 0.25 AND |fat bias|
baseline known, measured on the expanded gold set for the ACTIVE smartScan model. Log the
decision + numbers in CLAUDE.md when flipped.

## Acceptance criteria
- AC-1: `pnpm eval:scan` reports fatBiasG per fat-labeled case + aggregate, and legacy cases
  without fat labels still score identically to before (regression-free).
- AC-2: With the flag OFF, scan UX is byte-identical to today.
- AC-3: With the flag ON locally: an all-high-confidence scan logs immediately, toast +
  Undo works (undo removes the rows AND the correction record remains accepted-as-is
  history is fine to keep), a mixed-confidence scan falls through to confirm UI.
- AC-4: Auto-accepted logs carry full provenance (ai_inference_id, predicted_grams,
  confidence_score) — verify a row in food_log.

## Verify
```bash
pnpm tsc --noEmit && pnpm lint && pnpm eval:scan
# manual: flag on in .env.local, scan a clear single-food photo (high confidence) -> auto log
# + undo; scan a messy plate -> normal confirm UI.
```

## Out of scope
Changing pass bars, prompt tuning to fix the measured bias (next PRD, informed by D3's
numbers), per-user portion bias (F4 stays eval-gated), server-side auto-accept.
