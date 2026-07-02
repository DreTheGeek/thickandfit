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
