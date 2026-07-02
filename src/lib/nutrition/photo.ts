// Photo-to-macro pipeline (the wedge). A meal photo becomes loggable, macro-scaled food rows:
//   1. Gemini (via the lazy OpenRouter client) predicts [{ name, grams, confidence }] from the image.
//   2. Each predicted name is matched to the shared public.foods corpus via FTS (ilike on search_text).
//   3. cooked_uncooked_ratios + per-100g scaling produce real macros for the predicted grams.
// No OPENROUTER_API_KEY => the route returns a clean "not configured" state. It never crashes.
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { macrosForGrams, foodStateFromName, type FoodLite, type MacroTotals } from '@/lib/nutrition/macros';
import { AI_MODELS } from '@/lib/ai/models';
import { groundFoodByName } from '@/lib/nutrition/external-foods';

const apiKey = process.env.OPENROUTER_API_KEY;

// The moat. Flagship vision (routed centrally) + the structured-context portion step below; the owner
// will not sacrifice accuracy on photos. Portion estimation, not food ID, is the weak link to beat.
const VISION_MODEL = AI_MODELS.photoMacro;

export type PredictedItem = { name: string; grams: number; confidence: number; basis?: string };

// A predicted item resolved against the foods corpus, with macros scaled to the predicted grams.
export type PhotoCandidate = {
  predictedName: string;
  grams: number;
  confidence: number;
  matched: boolean;
  food: FoodLite | null;
  macros: MacroTotals | null;
  basis?: string; // the model's area/volume/density portion reasoning (structured-context step)
};

export type PhotoResult =
  // inferenceId/model are set by provenance-aware callers (text-to-macro) so a logged food can link
  // back to the ai_inferences row that predicted it (correction capture + eval attribution).
  | { status: 'ok'; candidates: PhotoCandidate[]; totals: MacroTotals; inferenceId?: string; model?: string }
  | { status: 'notConfigured' }
  | { status: 'noFood' }
  | { status: 'error' };

function clampConfidence(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

function clampGrams(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 100;
  return Math.min(5000, Math.round(v));
}

// The STRUCTURED-CONTEXT portion step (the single highest-impact accuracy lever from the research:
// roughly halves portion error, model-agnostic). Portion estimation, not food ID, is the weak link in
// every nutrition app. Instead of letting the model guess grams directly, we force an explicit
// reference -> area/volume -> density -> grams chain, and capture the reasoning so it can be audited
// and graded by the eval. The scaffolding is what improves the number; the captured "basis" is the proof.
const VISION_PROMPT = [
  'You are a precise bilingual (English/Spanish) nutrition vision model for a fitness coaching app.',
  'Accurate PORTION estimation is the hardest and most important part. Do NOT guess grams directly.',
  'Reason through these steps for the image before answering:',
  '1. SCALE: find a real-world size reference in the frame and state it. Typical sizes: dinner plate 26-28cm wide, salad/side plate ~20cm, dinner fork ~19cm long, soup spoon bowl ~4.5cm, soda can ~6.6cm wide x 12cm tall, smartphone ~14.7cm tall, a credit card 8.6cm. Pick the clearest one.',
  '2. For EACH distinct food: estimate the area it covers relative to that reference and its average height/thickness, to get an approximate volume in milliliters.',
  '3. Convert volume to edible weight in grams using the food\'s typical density (cooked rice/pasta ~0.8 g/mL, cooked meat/poultry/fish ~1.05 g/mL, dense stew/beans ~1.0 g/mL, leafy greens ~0.2 g/mL, bread ~0.3 g/mL, oils/butter ~0.92 g/mL, liquids ~1.0 g/mL).',
  'Critical rules:',
  '- Account for hidden cooking oil and butter: if a food looks pan-fried, sauteed, roasted, or glistening, add a separate "cooking oil" item with its estimated grams (a typical restaurant saute adds 7-15g of oil).',
  '- State whether each item is cooked or raw in its name when it matters (for example "cooked white rice", "grilled chicken breast", "raw spinach").',
  '- Use common, searchable food names, not brand names. Prefer the singular generic form (for example "chicken breast", not "Tyson chicken").',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"reference":string,"items":[{"name":string,"grams":number,"confidence":number,"basis":string}]}',
  'reference = the size reference and its assumed real size you used for scale.',
  'basis = a short note of your area/volume/density reasoning for that item (for example "covers ~half a 26cm plate, ~1.5cm deep, ~310mL rice @0.8 g/mL = ~250g").',
  'confidence is 0 to 1. If you cannot identify any food, return {"reference":"","items":[]}.',
].join('\n');

// Calls the vision model and parses its prediction. Returns null on any failure (caller degrades).
async function predictItems(image: string): Promise<PredictedItem[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: VISION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Estimate the foods and their portions in grams for this meal photo. Use a size reference and show your area/volume/density basis for each item.' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`photo predictItems HTTP ${res.status} (${VISION_MODEL}):`, body.slice(0, 400));
      return null;
    }
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
        const basis = typeof o.basis === 'string' && o.basis.trim() ? o.basis.trim() : undefined;
        return { name, grams: clampGrams(o.grams), confidence: clampConfidence(o.confidence), basis };
      })
      .filter((x): x is PredictedItem => x !== null)
      .slice(0, 12);
  } catch {
    return null;
  }
}

type FoodRaw = {
  id: string;
  name_en: string;
  name_es: string | null;
  brand: string | null;
  category: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  density_g_per_ml: number | null;
};

const COLS = 'id, name_en, name_es, brand, category, kcal, protein_g, carb_g, fat_g, density_g_per_ml';

function mapFood(r: FoodRaw, locale: string): FoodLite {
  const name = (locale === 'es' ? r.name_es || r.name_en : r.name_en || r.name_es) || r.name_en;
  return {
    id: r.id,
    name,
    brand: r.brand,
    category: r.category,
    kcal: Number(r.kcal),
    proteinG: Number(r.protein_g),
    carbG: Number(r.carb_g),
    fatG: Number(r.fat_g),
    densityGPerMl: r.density_g_per_ml,
  };
}

// Stopwords stripped so "cooked white rice" still matches a "rice" row when the exact phrase misses.
const STOP = new Set(['cooked', 'raw', 'dry', 'fresh', 'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed', 'cocido', 'cocida', 'crudo', 'cruda', 'seco', 'seca', 'a', 'de', 'la', 'el', 'and', 'with', 'con', 'of']);

function keywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// FTS-style match: try the full lowercased phrase first, then fall back to the strongest keyword.
// Uses ilike on search_text, which works today without embeddings.
async function matchFood(
  sb: Awaited<ReturnType<typeof createClient>>,
  predictedName: string,
  locale: string,
): Promise<FoodLite | null> {
  const phrase = predictedName.trim().toLowerCase();
  if (!phrase) return null;

  const tryQuery = async (term: string): Promise<FoodLite | null> => {
    const { data } = await sb.from('foods').select(COLS).ilike('search_text', `%${term}%`).limit(1).maybeSingle();
    return data ? mapFood(data as unknown as FoodRaw, locale) : null;
  };

  const full = await tryQuery(phrase);
  if (full) return full;

  // Longest keyword first (most specific), then shorter ones.
  const words = keywords(predictedName).sort((a, b) => b.length - a.length);
  for (const w of words) {
    const hit = await tryQuery(w);
    if (hit) return hit;
  }
  return null;
}

// Apply the deterministic cooked/uncooked yield so per-100g macros (stated for one state) apply to
// the grams the photo estimated (the visible, cooked form). cooked = raw * factor.
async function effectiveGramsForFood(
  sb: Awaited<ReturnType<typeof createClient>>,
  food: FoodLite,
  predictedName: string,
  grams: number,
): Promise<number> {
  if (!food.category) return grams;
  const listed = foodStateFromName(`${food.name} ${predictedName}`);
  // The photo measures the visible (cooked) portion. If the food row is stated raw, convert down.
  if (listed !== 'raw') return grams;
  const { data } = await sb
    .from('cooked_uncooked_ratios')
    .select('factor')
    .eq('category', food.category)
    .eq('state_from', 'raw')
    .eq('state_to', 'cooked')
    .limit(1)
    .maybeSingle();
  const factor = data ? Number((data as { factor: number }).factor) : 0;
  if (factor <= 0) return grams;
  // grams here are cooked (as seen); the row is per-100g raw, so convert cooked -> raw.
  return Math.round(grams / factor);
}

// Resolve predicted items (from a photo OR a text description) against the foods corpus and scale
// macros with cooked/uncooked conversion. Shared by analyzeMealPhoto + the text-to-macro pipeline.
export async function resolvePredictedItems(
  items: PredictedItem[],
  locale: string,
): Promise<PhotoResult> {
  if (items.length === 0) return { status: 'noFood' };

  const sb = await createClient();
  // Resolve items in PARALLEL - each is a local DB match + optional USDA grounding + cook/raw
  // conversion. Sequential resolution was the latency killer on a multi-item plate (N serial lookups).
  const candidates: PhotoCandidate[] = await Promise.all(
    items.map(async (item): Promise<PhotoCandidate> => {
      // 1) local corpus. 2) if it misses, ground against USDA + cache the hit so the next log is a
      // local hit. The model's grams still scale the DB's per-100g macros (golden rule).
      let food = await matchFood(sb, item.name, locale);
      if (!food) food = await groundFoodByName(item.name, locale);
      if (!food) {
        return { predictedName: item.name, grams: item.grams, confidence: item.confidence, matched: false, food: null, macros: null, basis: item.basis };
      }
      const effGrams = await effectiveGramsForFood(sb, food, item.name, item.grams);
      // Report the grams the user weighs/sees (the estimate), not the raw-equivalent.
      return { predictedName: item.name, grams: item.grams, confidence: item.confidence, matched: true, food, macros: macrosForGrams(food, effGrams), basis: item.basis };
    }),
  );

  const totals = candidates.reduce<MacroTotals>(
    (a, c) => (c.macros ? { kcal: a.kcal + c.macros.kcal, proteinG: a.proteinG + c.macros.proteinG, carbG: a.carbG + c.macros.carbG, fatG: a.fatG + c.macros.fatG } : a),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );

  return { status: 'ok', candidates, totals };
}

// LEGACY, superseded by smart-scan.ts analyzeSmartPhoto (which classifies meal-vs-product and adds
// label transcription). No live callers; kept for API compatibility until the next cleanup pass.
// Deliberately NOT converted to the shared AI client: no risk budget on dead code.
export async function analyzeMealPhoto(image: string, locale: string): Promise<PhotoResult> {
  const items = await predictItems(image);
  if (items === null) return apiKey ? { status: 'error' } : { status: 'notConfigured' };
  return resolvePredictedItems(items, locale);
}
