// Text-to-macro (the demoed headline). A natural-language meal description ("I ate 10 chicken
// nuggets and a cup of white rice") becomes loggable, macro-scaled food rows:
//   1. claude-haiku-4-5 (via the lazy OpenRouter client) parses the text into [{ name, grams, confidence }].
//   2. The SAME resolve pipeline as photo-to-macro matches each name to public.foods + scales macros
//      with cooked/uncooked conversion (reused via resolvePredictedItems).
// No OPENROUTER_API_KEY => returns a clean "not configured" state. It never crashes.
import 'server-only';
import { resolvePredictedItems, type PredictedItem, type PhotoResult } from '@/lib/nutrition/photo';
import { AI_MODELS } from '@/lib/ai/models';

const apiKey = process.env.OPENROUTER_API_KEY;
const TEXT_MODEL = AI_MODELS.textMacro;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

// Calls the text model and parses its prediction. Returns null on any failure (caller degrades).
async function parseItems(text: string): Promise<PredictedItem[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TEXT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PARSE_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { items?: unknown };
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

// Full text pipeline: parse -> resolve. Pure orchestration; safe to call without an API key.
export async function analyzeMealText(text: string, locale: string): Promise<PhotoResult> {
  const items = await parseItems(text);
  if (items === null) return apiKey ? { status: 'error' } : { status: 'notConfigured' };
  return resolvePredictedItems(items, locale);
}
