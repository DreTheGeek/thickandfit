// Central AI model routing for Thick & Fit. ONE source of truth so the eval can swap models and the
// routing rationale lives in one place instead of scattered string literals.
//
// Slugs use the canonical OpenRouter ids. Anthropic ids canonically use DOTS (claude-haiku-4.5). The
// codebase previously used dashed ids (claude-haiku-4-5); OpenRouter ALIASES those to the dotted models
// (verified live: the dashed ids return 200), so they were never broken, but we standardize on the
// canonical ids here. The real value of this module is the cost/quality RE-ROUTING below, chosen from
// the model research. Pricing (input/output per 1M tokens, mid-2026) is noted per choice so the
// tradeoff is auditable.

export const AI_MODELS = {
  // PHOTO-TO-MACRO, the moat. Flagship vision paired with the structured-context portion step (the
  // proven ~50% portion-error reduction). The owner will not sacrifice accuracy on photos. gpt-5 is
  // image-capable and the model from the best published macro study. $1.25/$10.
  photoMacro: 'openai/gpt-5',

  // PHYSIQUE read on progress photos. Same flagship vision; low frequency so a flagship is cheap in
  // aggregate. $1.25/$10.
  physique: 'openai/gpt-5',

  // TEXT-TO-MACRO. A simple structured parse, high volume -> cheap + reliable + strong bilingual JSON.
  // Re-routed from claude-haiku to gemini-2.5-flash $0.30/$2.50.
  textMacro: 'google/gemini-2.5-flash',

  // AI COACH CHAT. Highest-volume surface AND voice fidelity is the product (it must sound like
  // Stephanie). Haiku 4.5 is cheap for a persona-strong model and keeps her voice. $1/$5. The eval can
  // compare against gemini-2.5-flash if cost needs trimming (the research leaned Gemini Flash on cost).
  chat: 'anthropic/claude-haiku-4.5',

  // NIGHTLY INSIGHTS. Batch across many users -> cheap + reliable; a short personalized insight does
  // not need a flagship. Re-routed from claude-sonnet to gemini-2.5-flash $0.30/$2.50.
  insights: 'google/gemini-2.5-flash',

  // PLAN GENERATION. Rare + quality-critical (PCOS-aware structured JSON). Flagship reasoning; gpt-5
  // beats the prior Sonnet 4.6 on BOTH quality and cost ($1.25/$10 vs $3/$15).
  planGen: 'openai/gpt-5',

  // SMART SCAN (photo: classify meal-vs-product, read items + portion grams / transcribe a label). The
  // moat path. This was gemini-2.5-flash on the assumption gpt-5 was ~40s/scan - but that was gpt-5 at
  // DEFAULT (heavy) reasoning. Benchmarked 2026-07 with reasoning:{effort:'low'} (which smart-scan.ts
  // already sends): gpt-5 avg ~400ms vs gemini ~4,600ms over 6 real food photos, two runs, and gpt-5
  // detected foods equal-or-better. So the flagship is BOTH faster and more accurate here - it wins on
  // accuracy (the #1 need) and speed. Cost $1.25/$10 vs $0.30/$2.50 is pennies/scan and worth it.
  smartScan: 'openai/gpt-5',

  // SMART SCAN FALLBACK. The scan is the highest-volume user-facing surface, so a single-model outage
  // (gpt-5 5xx/429, or a model-specific 400) would fail every meal log. Gemini 2.5 Flash is the proven
  // prior model - the scan tries smartScan first, then this, so a provider blip degrades instead of dies.
  smartScanFallback: 'google/gemini-2.5-flash',
} as const;

export type AiTask = keyof typeof AI_MODELS;

// EMBEDDINGS for RAG memory. Served by OpenRouter's /embeddings endpoint (verified live: returns a
// 1536-dim vector for text-embedding-3-small), so it uses the same OPENROUTER_API_KEY as everything
// else. 1536 dims matches the coach_memory pgvector column. embeddings.ts no-ops cleanly with no key.
export const EMBED = {
  model: 'openai/text-embedding-3-small',
  dims: 1536,
} as const;
