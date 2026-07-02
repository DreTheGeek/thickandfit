// AI provenance / gold-dataset writer (FitnessOS Architecture v1, section 5). ai_usage_log is metering;
// this is the AUDIT + REPLAY layer. One row per inference: model, prompt version, raw output, confidence,
// latency, status - and, once the user edits the result, the {predicted, corrected} correction that is
// the supervised learning signal. Everything here is fire-and-forget: telemetry must NEVER break a
// request, so every function swallows its own errors and returns a safe value.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

export type InferenceFeature =
  | 'photo-scan'
  | 'text-macro'
  | 'coach-chat'
  | 'plan-gen'
  | 'physique'
  | 'insights';

export type InferenceRecord = {
  companyId: string;
  profileId?: string | null;
  feature: InferenceFeature;
  model: string;
  promptVersion?: string | null;
  inputHash?: string | null;
  rawOutput?: unknown;
  confidence?: number | null;
  latencyMs?: number | null;
  status?: string | null;
  itemCount?: number | null;
};

// Insert a provenance row and return its id so a produced record (e.g. a food_log entry) can link back
// to the inference that made it. Returns null on any failure - callers treat a null id as "unlinked".
export async function logInference(rec: InferenceRecord): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from('ai_inferences')
      .insert({
        company_id: rec.companyId,
        profile_id: rec.profileId ?? null,
        feature: rec.feature,
        model: rec.model,
        prompt_version: rec.promptVersion ?? null,
        input_hash: rec.inputHash ?? null,
        raw_output: rec.rawOutput ?? null,
        confidence: rec.confidence ?? null,
        latency_ms: rec.latencyMs ?? null,
        status: rec.status ?? null,
        item_count: rec.itemCount ?? null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('logInference:', error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.error('logInference exception:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Record the user's correction to a prior inference (prediction vs user-truth). markedCorrect=true means
// the user accepted the inference as-is (also a valuable signal: a confirmed-correct prediction).
// LOW-LEVEL single-shot primitive (plain overwrite). For multi-item scans use recordItemOutcome below,
// which merges per-item outcomes instead of clobbering the row.
export async function recordInferenceCorrection(
  inferenceId: string,
  correction: Record<string, unknown> | null,
  markedCorrect = false,
): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc
      .from('ai_inferences')
      .update({
        correction,
        user_marked_correct: markedCorrect,
        corrected_at: new Date().toISOString(),
      })
      .eq('id', inferenceId);
  } catch (e) {
    console.error('recordInferenceCorrection:', e instanceof Error ? e.message : String(e));
  }
}

// One logged item's outcome against the prediction that produced it. fields=[] means the user
// accepted this item exactly as predicted (a confirmed-correct prediction, also training signal).
export type ItemOutcome = {
  foodId: string; // the food actually logged
  predictedFoodId?: string | null; // the food the scan matched; differs from foodId on an identity swap
  predictedName: string;
  correctedName?: string | null; // set when the identity was swapped
  predictedGrams?: number | null;
  correctedGrams?: number | null; // set when the portion changed meaningfully
  fields: ReadonlyArray<'grams' | 'food_identity'>;
};

type ItemOutcomeRow = {
  food_id: string;
  predicted_food_id: string | null;
  predicted_name: string;
  corrected_name: string | null;
  predicted_grams: number | null;
  corrected_grams: number | null;
  fields: string[];
  at: string;
};

// Merge one logged item's outcome into the scan's SINGLE ai_inferences row. One scan produces one
// inference covering up to 12 items, so per-item writes must merge, not overwrite (the old overwrite
// meant logging item B clobbered item A's correction). correction jsonb becomes { items: [...] },
// keyed by (food_id, predicted_name): re-logging the same item replaces its entry. user_marked_correct
// is recomputed as "every recorded item accepted as-is". Read-modify-write is safe in practice (the UI
// logs sequentially); this is telemetry, so a lost concurrent-tab race is acceptable and swallowed.
export async function recordItemOutcome(inferenceId: string, item: ItemOutcome): Promise<void> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from('ai_inferences')
      .select('correction')
      .eq('id', inferenceId)
      .maybeSingle();
    if (error) {
      console.error('recordItemOutcome read:', error.message);
      return;
    }
    const prior = (data?.correction ?? null) as { items?: unknown } | null;
    const items: ItemOutcomeRow[] = Array.isArray(prior?.items)
      ? (prior.items.filter(
          (x): x is ItemOutcomeRow => typeof x === 'object' && x !== null && 'food_id' in x,
        ) as ItemOutcomeRow[])
      : [];
    const row: ItemOutcomeRow = {
      food_id: item.foodId,
      predicted_food_id: item.predictedFoodId ?? null,
      predicted_name: item.predictedName,
      corrected_name: item.correctedName ?? null,
      predicted_grams: item.predictedGrams ?? null,
      corrected_grams: item.correctedGrams ?? null,
      fields: [...item.fields],
      at: new Date().toISOString(),
    };
    const idx = items.findIndex(
      (r) => r.food_id === row.food_id && r.predicted_name === row.predicted_name,
    );
    if (idx >= 0) items[idx] = row;
    else items.push(row);

    const { error: upErr } = await svc
      .from('ai_inferences')
      .update({
        correction: { items },
        user_marked_correct: items.every((r) => r.fields.length === 0),
        corrected_at: new Date().toISOString(),
      })
      .eq('id', inferenceId);
    if (upErr) console.error('recordItemOutcome write:', upErr.message);
  } catch (e) {
    console.error('recordItemOutcome:', e instanceof Error ? e.message : String(e));
  }
}
