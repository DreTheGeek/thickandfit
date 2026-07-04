// Text-to-macro (the demoed headline). A natural-language meal description ("I ate 10 chicken
// nuggets and a cup of white rice") becomes loggable, macro-scaled food rows:
//   1. The text model (via the shared AI client) parses the text into [{ name, grams, confidence }].
//   2. The SAME resolve pipeline as photo-to-macro matches each name to public.foods + scales macros
//      with cooked/uncooked conversion (reused via resolvePredictedItems).
// No OPENROUTER_API_KEY => returns a clean "not configured" state. It never crashes.
import 'server-only';
import { resolvePredictedItems, type PredictedItem, type PhotoResult } from '@/lib/nutrition/photo';
import { AI_MODELS } from '@/lib/ai/models';
import { callJson, hashInput } from '@/lib/ai/client';
import { logInference } from '@/lib/ai/inferences';

// Bump when PARSE_PROMPT changes so replay/eval can group inferences by prompt generation.
const PROMPT_VERSION = 'text-macro.v1';

function clampConfidence(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0.6;
  return Math.min(1, Math.max(0, v));
}
function clampGrams(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 100;
  return Math.min(5000, Math.round(v));
}

const PARSE_PROMPT = [
  'You are a precise bilingual (English/Spanish) nutrition parser for a fitness coaching app.',
  'The user describes what they ate in natural language (e.g. "10 oz ribeye", "un plato de arroz con pollo").',
  'Break it into distinct foods. For each, estimate the edible weight in grams from the quantity/units given',
  '(convert oz/cup/tbsp/servings/counts to grams using normal food densities and typical serving sizes).',
  'Rules:',
  '- State cooked vs raw in the name when it matters ("cooked white rice", "grilled chicken breast").',
  '- Use common, searchable generic food names, not brands. Prefer the singular generic form.',
  '- If a count is given (e.g. "10 nuggets"), multiply a typical unit weight by the count.',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"items":[{"name":string,"grams":number,"confidence":number}]}',
  'confidence is 0 to 1. If you cannot identify any food, return {"items":[]}.',
].join('\n');

function parseContent(content: string): PredictedItem[] | null {
  try {
    const parsed = JSON.parse(content) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return null;
    return parsed.items
      .map((it): PredictedItem | null => {
        if (!it || typeof it !== 'object') return null;
        const o = it as Record<string, unknown>;
        const name = typeof o.name === 'string' ? o.name.trim() : '';
        if (!name) return null;
        return { name, grams: clampGrams(o.grams), confidence: clampConfidence(o.confidence) };
      })
      .filter((x): x is PredictedItem => x !== null)
      .slice(0, 12);
  } catch {
    return null;
  }
}

// Full text pipeline: parse -> resolve. Safe to call without an API key. When ctx is provided, one
// ai_inferences row is written AFTER resolution (final pipeline status, like smart-scan) and its id
// is threaded onto the ok result so a logged food links back to the prediction (correction capture).
export async function analyzeMealText(
  text: string,
  locale: string,
  ctx?: { companyId: string; profileId: string },
): Promise<PhotoResult> {
  const t0 = Date.now();
  const call = await callJson({
    models: [AI_MODELS.textMacro],
    timeoutMs: 30_000, // previously unbounded; a hung provider now fails cleanly
    traceFeature: 'text-macro', // else it aggregates under 'unknown' on /admin/traces
    ...(ctx ? { companyId: ctx.companyId, profileId: ctx.profileId } : {}),
    messages: [
      { role: 'system', content: PARSE_PROMPT },
      { role: 'user', content: text },
    ],
  });
  if (call.status === 'notConfigured') return { status: 'notConfigured' };
  if (call.status !== 'ok') return { status: 'error' };

  const items = parseContent(call.content);
  if (items === null) return { status: 'error' };
  const confidence = items.length ? items.reduce((s, it) => s + it.confidence, 0) / items.length : null;

  const resolved = await resolvePredictedItems(items, locale);
  let result: PhotoResult = resolved;

  if (ctx) {
    const inferenceId = await logInference({
      companyId: ctx.companyId,
      profileId: ctx.profileId,
      feature: 'text-macro',
      model: call.model,
      promptVersion: PROMPT_VERSION,
      inputHash: hashInput(text),
      rawOutput: { items },
      confidence,
      latencyMs: Date.now() - t0,
      status: resolved.status,
      itemCount: items.length,
    });
    if (inferenceId && result.status === 'ok') {
      result = { ...result, inferenceId, model: call.model };
    }
  }
  return result;
}
