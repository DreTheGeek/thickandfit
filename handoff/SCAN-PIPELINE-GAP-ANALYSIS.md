# Thick & Fit Photo Scan Pipeline — Gap Analysis & Delta Plan
**Date:** 2026-07-31 | **Repo:** DreTheGeek/thickandfit @ main | **Verdict first: no n8n. Anywhere.**

---

## 1. The Verdict

The 15-stage pipeline you were pitched is not a plan. It's a description of what's already in your repo. Whoever wrote those docs was describing a build you mostly finished. The real question isn't "how do I build this," it's "which 4 remaining gaps are worth closing before Sept 27 launch."

**On n8n:** the repo already answers this. The entire intelligence path runs as TypeScript in Next.js route handlers (maxDuration 300s) + pg_cron nightly jobs + fire-and-forget server code. Not even Supabase edge functions carry the pipeline (only mux-webhook and resend-webhook live there). It works, it's evaled, it's instrumented. Adding n8n would add a runtime, a deploy surface, and a failure point to a proven path. For integrations, your own build standard makes Composio the backbone. n8n has zero jobs here.

---

## 2. Stage-by-Stage: Pitched Pipeline vs Repo Reality

| # | Pitched stage | Status | Where it lives |
|---|---|---|---|
| 1 | Image ingestion, store original forever | ⚠️ PARTIAL | `route.ts` stores scan image via `after(() => storeScanImage(...))` keyed by inference id — but ONLY on ok/product outcomes. Failed/error scans store nothing. |
| 2 | Image processing (resize, EXIF, blur) | ✅ DONE | Client-side downscale + re-encode (strips EXIF), `image-quality.ts` (K2) cheap blur/quality gate |
| 3 | Vision analysis (ID only, no macros) | ✅ DONE | `smart-scan.ts` — golden rule enforced in the prompt: "Do NOT output calories or macros for meal items" |
| 4 | Portion estimation + basis | ✅ DONE | Same call: grams via plate/fork reference + area×height×density, `basis` field captured. Adds "cooking oil" item on pan-fried looks (this is the NIH fat-bias mitigation, already in) |
| 5 | Confidence engine | ✅ DONE | Per-item confidence, confidence-tiered scan UX (0.9/0.7 tiers), `clarify` questions for ambiguity |
| 6 | Nutrition resolution (DB, never AI) | ✅ DONE | `photo.ts` batched local corpus → `external-foods.ts` USDA (re-ranked, cached, 6s timeout) → OFF barcode → label transcription (reading, not inventing). Micros panel (0064). Cooked/uncooked ratios. |
| 7 | Canonical meal object | ✅ DONE | `ai_inferences`: input_hash, raw_output, PROMPT_VERSION, model attribution (incl. mid-run fallback), latency, status |
| 8 | User confirmation | ✅ DONE | Snap-your-meal modal, editable candidates, product clarify flow |
| 9 | Correction capture | ✅ DONE | 0061 + item-level merge, identity swaps, accepted-as-is, predicted vs corrected grams written back to `ai_inferences.correction`. Corrected scans auto-become silver eval cases. |
| 10 | Knowledge graph | ✅ DONE (deterministic) | 0080 `kg_rebuild()` — coach/client/goal/injury/dietary/food/plan nodes, EATS/HAS_GOAL/etc edges, nightly + admin refresh. LLM triple-extraction over free text deliberately deferred. |
| 11 | Behavioral memory | ✅ DONE (layer 1) | 0087 `member_memory` (12 sources, HNSW, supersedence) + K10 reranker (per-KIND decay: fact 3650d / summary 120d / episodic 7d). Layers 2-4 gated on prod traffic — correctly. |
| 12 | Embeddings | ✅ DONE | 0030 food_log embeddings, member_memory 1536-dim, locked model + chunking |
| 13 | Prediction engine | ⚠️ PARTIAL | K7 `prediction/engine.ts` — deterministic goal-date projection + 30d pace. NO intra-day prediction ("7:30pm, 132g of 180g protein → likely miss"). |
| 14 | Coach response post-scan | ⚠️ VERIFY/PARTIAL | Coach chat has full context (memories, scan_quality, predictions, K8 lift-based meal recs). But the scan itself returns macros, not a coaching line. The "one more serving of lean meat puts you over target" moment at log time appears missing. |
| 15 | Population learning | ⚠️ PARTIAL | Eval harness (gold + silver from corrections), calibration dashboard, scan_quality per member. Per-user portion bias (F4) deferred eval-gated. No automated aggregate-bias detection. |

**Also already done that the pitch didn't even ask for:** domain_events emitted live (food_logged, food_corrected, protein_goal_hit, micronutrient_low...), scan-context loop (K1: member habits + past corrections injected into the vision prompt — this is per-user learning at inference time, which SnapCalorie is the only competitor doing), K8 lift-not-frequency meal recs, model A/B chain with clean eval attribution.

---

## 3. What the Research Says (2 agents, 25+ sources, July 2026)

1. **NIH/NIDDK July 2026:** every tested competitor (MyFitnessPal, Lose It, Cal AI) underestimates by 250-345 kcal/meal, ~30g fat/meal. It's a bias, not noise — cameras can't see oil. Your prompt already adds a cooking-oil item; nobody measures whether it's enough. Your eval harness can.
2. **Portion is the whole game.** Food ID is commoditized (85-95%). Pure-LLM portion/energy MAPE plateaus ~35%; grounded-DB pipelines like yours do better; depth adds ~10pts but isn't worth v1 infra. Your architecture (LLM names+grams, DB macros) is the MacroFactor-class defensible one.
3. **Nobody ships confidence-gated auto-accept.** Cal AI logs-then-fix, MacroFactor is review-first. Your 0.9/0.7 tiers already exist — auto-accept above threshold with an undo toast is open lane.
4. **Determinism is a trust-killer when absent.** Same plate re-scanned → different numbers is the top review complaint category-wide. You have input_hash — a scan cache is one index away.
5. **Correction flywheel is the moat and you already have the best one:** (image + prediction + truth) triples stored per scan, per-user context injection live, silver evals auto-mined. Cal AI collects corrections at 15M-download scale with zero personalization. You personalize at 256 clients. Caution from SnappyMeal's field study: apply corrections field-scoped, not whole-record — your item-level merge already does this right.
6. **Cal AI got pulled from the App Store in April over billing dark patterns.** "Honest billing" is in your repo's one-liner. That's a marketing weapon for Stephanie's launch, not just ethics.

---

## 4. Delta PRDs (the only ones worth writing)

AI execution time, not human time. All on the existing stack, no new runtimes.

**PRD-A: Store every scan image, including failures. (~1-2 hrs)**
Move `storeScanImage` to fire on ALL outcomes (error/noFood/clarify too), keyed by inference id; log an inference row on failures. The scans that fail are exactly the replay set you'll want when a better model ships. Cheap insurance, and Stage 1 of the pitch was right about this one thing.

**PRD-B: Scan determinism cache. (~1-2 hrs)**
`input_hash` already computed. Before the vision call, look up a recent identical-hash inference for this member and return the resolved result. Same photo → same answer. Kills the #1 category trust complaint for free, and cuts OpenRouter spend on double-taps.

**PRD-C: Post-scan coach moment + intra-day pace. (~3-5 hrs)**
Extend K7 with an intra-day view: at scan-confirm time, compute remaining protein/kcal vs target and time of day (user_state has targets, diary has today). Return one deterministic coaching line with the scan result ("that puts you at 132g — one more palm of lean meat hits your 180g"). Deterministic first, Stephanie-voice LLM polish later via the existing coach-ai path. This is Stage 13-14's actual missing piece and it's the moment users screenshot.

**PRD-D: Fat-bias eval + auto-accept gate. (~2-4 hrs)**
Add a fat-MAPE axis to `scan-scoring.ts`, seed 10-15 gold cases of oily/pan-fried/dressed meals, measure whether the cooking-oil prompt line actually closes the NIH gap. Separately: flip the ≥0.9 tier to auto-accept + 3s undo (config-flagged, eval-gated). Both ride the existing harness.

**Explicitly NOT now (repo's own gates are correct, keep them):** K10 layers 2-4 (needs prod traffic), per-user portion bias F4 (eval-gated), LLM triple extraction on the KG (10k+ events trigger), event subscribers/projections (telemetry-only by design), depth-sensor volume estimation (not worth v1 infra), n8n (never).

---

## 5. Bottom Line

You were sold a 15-stage architecture as if it needed building. Thirteen of fifteen stages are live in your repo with evals, provenance, RLS, and a calibration dashboard — several stages deeper than what the pitch described. The whole remaining delta is ~8-12 hours of AI execution across 4 small PRDs, and the highest-leverage one (PRD-C, the post-scan coach moment) is the one the pitch called "the secret sauce" — it's the only piece of sauce actually missing.

Launch gates remain non-engineering (per STATE.md): Stephanie's content, external keys, domain cutover, the 256-client Lenus entitlement decision, Stripe API-version pin.
