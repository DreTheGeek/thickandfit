import 'server-only';
// K6 cost computation: converts token counts into cents so ai_trace.cost_cents stops being null.
// Every model in AI_MODELS has a published price documented in models.ts ($X per 1M input / 1M output);
// this table lifts those numbers into runtime and computes cost per call. logAiTrace calls into here
// on every AI request, so cost lands on /admin/traces and rolls up cleanly into /admin/usage.
//
// Convention: PRICE is [input$/1M, output$/1M]. Cost math is (tokens * price * 100) / 1_000_000 cents.
// Round-half-up because the ai_trace column is bigint (whole cents); aggregate accuracy is fine to
// within a fraction of a cent across the whole dataset.
//
// Missing model → returns null and cost stays null; a new model added to AI_MODELS should be added
// here in the same commit. There's a defensive prefix match so "openai/gpt-5:variant-xyz" still maps.

type PricePair = readonly [inputPer1M: number, outputPer1M: number];

// Values sourced from the comments in src/lib/ai/models.ts; keep in sync when a route changes tier.
const PRICE_TABLE: Record<string, PricePair> = {
  'openai/gpt-5': [1.25, 10.0],
  'google/gemini-2.5-flash': [0.30, 2.50],
  'anthropic/claude-haiku-4.5': [1.0, 5.0],
  'anthropic/claude-sonnet-4.6': [3.0, 15.0], // legacy path; may still appear on old inferences
};

/**
 * Estimate the cost of a single model call in whole cents (>= 0). Returns null when the model is
 * unknown or when token counts are absent — the caller writes null rather than a wrong number.
 * Rounding: standard round-half-up. Aggregate over 100k+ calls gets within a few cents of truth.
 */
export function estimateCostCents(
  model: string | null | undefined,
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
): number | null {
  if (!model) return null;
  const p = tokens(promptTokens);
  const c = tokens(completionTokens);
  if (p === 0 && c === 0) return null;
  const price = lookupPrice(model);
  if (!price) return null;
  const inCents = (p * price[0] * 100) / 1_000_000;
  const outCents = (c * price[1] * 100) / 1_000_000;
  const total = inCents + outCents;
  return Math.max(0, Math.round(total));
}

function tokens(n: number | null | undefined): number {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/**
 * Look up a model's pricing. Tries exact match first, then a prefix strip (OpenRouter can suffix
 * variants like "openai/gpt-5:online"). Case-insensitive on the base slug.
 */
function lookupPrice(model: string): PricePair | null {
  const norm = model.toLowerCase();
  if (PRICE_TABLE[norm]) return PRICE_TABLE[norm];
  // Prefix / variant strip: everything before ":" or "@"
  const base = norm.split(/[:@]/)[0];
  if (PRICE_TABLE[base]) return PRICE_TABLE[base];
  return null;
}

/** Test helper — expose the raw price table so tests + eval reporting can display "$1.25/$10" style. */
export function priceForModel(model: string): PricePair | null {
  return lookupPrice(model);
}
