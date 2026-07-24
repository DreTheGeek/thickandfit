import 'server-only';
// Scan Context Orchestrator (K1) — the loop that turns every meal photo into a smarter next one.
//
// Reads TWO structured signals this member has already generated and folds them into the vision
// prompt as compact hints. No embeddings, no vector DB: these are facts the SQL layer already
// stores (kb-smart-systems non-negotiable: never put facts in embeddings).
//   1. Habits — top foods this member logs, with typical grams. Biases identification when the
//      photo is ambiguous. Query hits (profile_id, food_id) with a group-by; cheap.
//   2. Corrections — the last few times this member edited a scan (renamed the food or bumped
//      the grams >5%). This is the supervised signal: "when I predicted X you actually meant Y."
//      Read from ai_inferences.correction jsonb (populated by recordItemOutcome after
//      logPhotoFoodAction detects an edit — see src/lib/ai/inferences.ts).
//
// Grounding is law (kb-smart-systems non-negotiable): render this context as guidance the model
// MAY use, and instruct it to fall back to the photo alone when the hints do not fit. Never as
// facts to output verbatim.
//
// Zero-signal members (a fresh signup with no history) get an empty context — the base prompt
// runs unchanged, so the golden-set eval score cannot regress from this wire.
import { createServiceClient } from '@/lib/supabase/service';

export type MemberHabit = {
  name: string;
  count: number;
  avgGrams: number;
};

export type MemberCorrection = {
  /** What the vision engine predicted the food was ("chicken breast"). */
  predicted: string | null;
  /** What the member changed it to ("chicken thigh"). Null when only the grams moved. */
  corrected: string | null;
  /** Predicted grams the model returned. */
  predictedGrams: number | null;
  /** Grams the member actually logged. */
  correctedGrams: number | null;
};

export type ScanContext = {
  habits: MemberHabit[];
  corrections: MemberCorrection[];
};

/** How many of each signal to retain. Kept tight on purpose — vision context bloat costs latency
 *  and tokens more than it helps, and the interesting patterns cluster in the recent tail. */
const MAX_HABITS = 5;
const MAX_CORRECTIONS = 5;
const CORRECTIONS_LOOKBACK = 10; // scan the last 10 corrected inferences to fill MAX_CORRECTIONS

// Supabase's PostgREST types a joined relation as an array even when we only expect one row per
// join, so `foods` comes back as an array (usually length 1). Read `[0]` and null-guard.
type FoodLogHabitRow = {
  grams: number | null;
  foods: { name_en: string | null; name_es: string | null }[] | null;
};

type CorrectionItem = {
  predicted_name?: string | null;
  corrected_name?: string | null;
  predicted_grams?: number | null;
  corrected_grams?: number | null;
};
type InferenceCorrectionRow = { correction: { items?: CorrectionItem[] } | null };

/**
 * Pull this member's structured history: top habitual foods + recent scan edits.
 * Both queries are indexed on profile_id + feature/source; a fresh member reads back {habits:[], corrections:[]}
 * and the caller renders nothing. Never throws — a DB blip must not break scanning.
 */
export async function buildScanContext(profileId: string, companyId: string): Promise<ScanContext> {
  const sb = createServiceClient();

  const [habitsRes, correctionsRes] = await Promise.all([
    // Habits: prefer sources that reflect the member's real choices (photo, search, manual, barcode
    // — i.e. NOT auto-generated meal-plan rows). Group at the SQL layer so a heavy eater doesn't
    // ship 500 rows over the wire.
    sb
      .from('food_log')
      .select('grams, foods(name_en, name_es)')
      .eq('profile_id', profileId)
      .eq('company_id', companyId)
      .in('source', ['photo', 'search', 'manual', 'barcode'])
      .gt('grams', 0)
      .order('logged_at', { ascending: false })
      .limit(200), // last 200 logs is enough headroom to derive top-5 habits
    sb
      .from('ai_inferences')
      .select('correction')
      .eq('profile_id', profileId)
      .eq('company_id', companyId)
      .eq('feature', 'photo-scan')
      .not('correction', 'is', null)
      .order('created_at', { ascending: false })
      .limit(CORRECTIONS_LOOKBACK),
  ]);

  if (habitsRes.error) console.error('scan-context habits:', habitsRes.error.message);
  if (correctionsRes.error) console.error('scan-context corrections:', correctionsRes.error.message);

  // Aggregate habits client-side by name (foods with same display name coalesce), then rank by count.
  const habitMap = new Map<string, { count: number; sumGrams: number }>();
  for (const row of (habitsRes.data ?? []) as FoodLogHabitRow[]) {
    const food = row.foods?.[0];
    const name = (food?.name_en ?? food?.name_es ?? '').trim().toLowerCase();
    if (!name) continue;
    const grams = Number(row.grams ?? 0);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const prev = habitMap.get(name) ?? { count: 0, sumGrams: 0 };
    prev.count += 1;
    prev.sumGrams += grams;
    habitMap.set(name, prev);
  }
  const habits: MemberHabit[] = Array.from(habitMap.entries())
    .map(([name, agg]) => ({ name, count: agg.count, avgGrams: Math.round(agg.sumGrams / agg.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_HABITS);

  // Flatten correction rows into individual item edits, most recent first, dedup by (predicted→corrected).
  const seen = new Set<string>();
  const corrections: MemberCorrection[] = [];
  for (const row of (correctionsRes.data ?? []) as InferenceCorrectionRow[]) {
    const items = row.correction?.items ?? [];
    for (const it of items) {
      const key = `${it.predicted_name ?? ''}→${it.corrected_name ?? ''}|${it.predicted_grams ?? ''}→${it.corrected_grams ?? ''}`;
      if (seen.has(key)) continue;
      // Only keep meaningful edits: a name change OR a grams delta > 5%. Trivial noise adds nothing.
      const nameChanged = it.corrected_name && it.corrected_name !== it.predicted_name;
      const pg = Number(it.predicted_grams ?? 0);
      const cg = Number(it.corrected_grams ?? 0);
      const gramsMovedMeaningfully = pg > 0 && cg > 0 && Math.abs(cg - pg) / pg > 0.05;
      if (!nameChanged && !gramsMovedMeaningfully) continue;
      seen.add(key);
      corrections.push({
        predicted: it.predicted_name ?? null,
        corrected: it.corrected_name ?? null,
        predictedGrams: Number.isFinite(pg) && pg > 0 ? pg : null,
        correctedGrams: Number.isFinite(cg) && cg > 0 ? cg : null,
      });
      if (corrections.length >= MAX_CORRECTIONS) break;
    }
    if (corrections.length >= MAX_CORRECTIONS) break;
  }

  return { habits, corrections };
}

/**
 * Render the context as a compact system-message addendum. Returns null when the member has no
 * useful history so the caller adds nothing to the prompt (an empty hints block would only cost
 * tokens and confuse the model).
 *
 * Format is tight: one line per fact, imperative framing, ends with the grounding rule. The base
 * prompt still runs, this only ADDS hints; base-prompt evals on a ctx-less run are untouched.
 */
export function renderScanContextForPrompt(ctx: ScanContext): string | null {
  if (ctx.habits.length === 0 && ctx.corrections.length === 0) return null;

  const lines: string[] = ['MEMBER CONTEXT (use to bias identification and portion when the photo genuinely supports it; ignore when it does not):'];

  if (ctx.habits.length > 0) {
    lines.push('Frequently logged foods:');
    for (const h of ctx.habits) {
      lines.push(`  - "${h.name}" (${h.count}x, typical ~${h.avgGrams}g)`);
    }
  }

  if (ctx.corrections.length > 0) {
    lines.push('Recent edits this member made to prior scans:');
    for (const c of ctx.corrections) {
      if (c.corrected && c.predicted && c.corrected !== c.predicted) {
        const gramsHint =
          c.predictedGrams && c.correctedGrams
            ? ` (portion moved ${c.predictedGrams}g → ${c.correctedGrams}g)`
            : '';
        lines.push(`  - You said "${c.predicted}"; member changed it to "${c.corrected}"${gramsHint}`);
      } else if (c.predictedGrams && c.correctedGrams) {
        const delta = Math.round(((c.correctedGrams - c.predictedGrams) / c.predictedGrams) * 100);
        const name = c.corrected ?? c.predicted ?? 'the item';
        lines.push(`  - "${name}" was ${delta > 0 ? '+' : ''}${delta}% vs your estimate (you said ${c.predictedGrams}g, member logged ${c.correctedGrams}g)`);
      }
    }
  }

  lines.push('Grounding rule: only apply these hints when they fit what you actually see; do NOT invent items to match this history.');
  return lines.join('\n');
}
