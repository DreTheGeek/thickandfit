// Shared OpenRouter client. ONE place that knows the endpoint, key gating, per-attempt timeouts,
// model fallback chains, JSON fence-stripping, and inference provenance. Callers own their prompts
// and their PROMPT_VERSION constants; the client owns the wire. Generalized from the proven
// smart-scan loop (try primary, log HTTP failures with status + body slice, fall to the next model,
// never delay the model call for telemetry). No OPENROUTER_API_KEY -> clean notConfigured.
import 'server-only';
import { createHash } from 'node:crypto';
import { logInference, type InferenceFeature, type InferenceRecord } from '@/lib/ai/inferences';
import { logAiTrace, previewMessages } from '@/lib/telemetry/ai-trace';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const apiKey = process.env.OPENROUTER_API_KEY;

export function aiConfigured(): boolean {
  return Boolean(apiKey);
}

// sha256 of a model input (image data URL, text) for ai_inferences.input_hash dedupe/eval grouping.
export function hashInput(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type ProvenanceContext = {
  feature: InferenceFeature;
  promptVersion: string;
  companyId: string;
  profileId?: string | null;
  inputHash?: string | null;
  // 'await' (default): the client awaits logInference and returns the row id (paths that thread the
  //   id to the UI for correction capture need it).
  // 'fire': the client voids the write; inferenceId stays null (batch paths where the id is unused).
  // 'defer': the client writes NOTHING; result.inference carries the prefilled record so the caller
  //   can enrich it (final pipeline status, itemCount, confidence) and call logInference itself.
  mode?: 'await' | 'fire' | 'defer';
};

export type AiUsage = { promptTokens: number; completionTokens: number };

export type AiJsonOptions = {
  models: readonly string[]; // fallback chain, tried in order; deduped here
  messages: unknown[]; // caller-shaped OpenRouter message array (passed through opaquely)
  timeoutMs?: number; // per-attempt bound (default 60s) so a slow provider fails cleanly
  signal?: AbortSignal; // optional external abort, combined with the per-attempt timeout
  responseFormat?: 'json_object' | 'text';
  reasoningEffort?: 'low' | 'medium' | 'high';
  providerSort?: 'latency' | 'price' | 'throughput';
  provenance?: ProvenanceContext;
  // Observability: a stable label when there is no provenance (provenance.feature wins if present),
  // an optional turn id to stitch multi-call agent turns, and how many RAG docs fed this call.
  traceFeature?: string;
  correlationId?: string;
  retrievalCount?: number;
};

export type AiJsonResult =
  | {
      status: 'ok';
      content: string; // fence-stripped content string
      model: string; // the chain entry that actually answered
      usage: AiUsage;
      latencyMs: number;
      inferenceId: string | null; // set in 'await' mode
      inference: InferenceRecord | null; // prefilled record in 'defer' mode
    }
  | { status: 'notConfigured' }
  | { status: 'error' };

type CompletionJson = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
}

// rawOutput should be replayable: store the parsed object when the content is JSON, else the string.
function lenientParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

export async function callJson(opts: AiJsonOptions): Promise<AiJsonResult> {
  const feature = opts.provenance?.feature ?? opts.traceFeature ?? 'unknown';
  const companyId = opts.provenance?.companyId ?? null;
  const profileId = opts.provenance?.profileId ?? null;
  const trace = (
    status: 'ok' | 'error' | 'notConfigured',
    extra: Partial<Parameters<typeof logAiTrace>[0]>,
  ): void =>
    logAiTrace({
      feature,
      operation: 'json',
      status,
      companyId,
      profileId,
      correlationId: opts.correlationId ?? null,
      retrievalCount: opts.retrievalCount ?? null,
      inputPreview: previewMessages(opts.messages),
      ...extra,
    });

  if (!apiKey) {
    trace('notConfigured', {});
    return { status: 'notConfigured' };
  }
  const chain = opts.models.filter((m, i, a) => a.indexOf(m) === i);
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const t0 = Date.now();

  let res: Response | null = null;
  let usedModel = chain[0] ?? '';
  for (const m of chain) {
    try {
      // Each attempt gets its own timeout so a fallback still fits the route ceiling.
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      const r = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: m,
          ...(opts.providerSort ? { provider: { sort: opts.providerSort } } : {}),
          ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
          ...(opts.responseFormat !== 'text' ? { response_format: { type: 'json_object' } } : {}),
          messages: opts.messages,
        }),
      });
      if (r.ok) {
        res = r;
        usedModel = m;
        break;
      }
      // Never swallow the cause: log status + body so a prod failure is diagnosable, then try the
      // next model (401 = bad key, 402 = out of credits, 429 = rate limit, 400 = bad request/model).
      const body = await r.text().catch(() => '');
      console.error(`ai-client HTTP ${r.status} (${m}):`, body.slice(0, 300));
    } catch (e) {
      console.warn(`ai-client ${m} failed, trying next:`, e instanceof Error ? e.message : String(e));
    }
  }
  if (!res) {
    trace('error', { model: usedModel, latencyMs: Date.now() - t0, error: 'all models failed' });
    return { status: 'error' };
  }

  try {
    const json = (await res.json()) as CompletionJson;
    const raw = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.error('ai-client: empty content', JSON.stringify(json).slice(0, 300));
      trace('error', { model: usedModel, latencyMs: Date.now() - t0, error: 'empty content' });
      return { status: 'error' };
    }
    const content = stripFences(raw);
    const usage: AiUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    };
    const latencyMs = Date.now() - t0;

    let inferenceId: string | null = null;
    let inference: InferenceRecord | null = null;
    if (opts.provenance) {
      const p = opts.provenance;
      const rec: InferenceRecord = {
        companyId: p.companyId,
        profileId: p.profileId ?? null,
        feature: p.feature,
        model: usedModel,
        promptVersion: p.promptVersion,
        inputHash: p.inputHash ?? null,
        rawOutput: lenientParse(content),
        latencyMs,
        status: 'ok',
      };
      const mode = p.mode ?? 'await';
      if (mode === 'await') inferenceId = await logInference(rec);
      else if (mode === 'fire') void logInference(rec);
      else inference = rec; // 'defer': the caller enriches and logs
    }

    trace('ok', {
      model: usedModel,
      latencyMs,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      outputPreview: content,
    });
    return { status: 'ok', content, model: usedModel, usage, latencyMs, inferenceId, inference };
  } catch (e) {
    console.error('ai-client parse exception:', e instanceof Error ? e.message : String(e));
    trace('error', { model: usedModel, latencyMs: Date.now() - t0, error: 'parse exception' });
    return { status: 'error' };
  }
}

// Streaming passthrough for coach chat: builds auth + body, returns the raw upstream Response (or
// null on failure). NO SSE parsing here; chat.ts keeps its proven stream loop, persistence, and
// cache_control message shaping. Deliberately thin: streaming is not generalized until a second
// streaming surface exists.
export type AiStreamOptions = {
  model: string;
  messages: unknown[];
  timeoutMs?: number;
  // Observability (chat has no provenance/JSON return, so it labels its own trace).
  traceFeature?: string;
  correlationId?: string;
  retrievalCount?: number;
  companyId?: string | null;
  profileId?: string | null;
};

export async function openChatStream(opts: AiStreamOptions): Promise<Response | null> {
  const t0 = Date.now();
  const baseTrace = {
    feature: opts.traceFeature ?? 'chat',
    operation: 'stream' as const,
    model: opts.model,
    companyId: opts.companyId ?? null,
    profileId: opts.profileId ?? null,
    correlationId: opts.correlationId ?? null,
    retrievalCount: opts.retrievalCount ?? null,
    inputPreview: previewMessages(opts.messages),
  };
  if (!apiKey) {
    logAiTrace({ ...baseTrace, status: 'notConfigured' });
    return null;
  }
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
      body: JSON.stringify({ model: opts.model, stream: true, messages: opts.messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`ai-client stream HTTP ${res.status} (${opts.model}):`, body.slice(0, 300));
      logAiTrace({ ...baseTrace, status: 'error', latencyMs: Date.now() - t0, error: `HTTP ${res.status}` });
      return null;
    }
    // Latency here is time-to-first-byte (stream opened); the full generation streams to the client.
    logAiTrace({ ...baseTrace, status: 'ok', latencyMs: Date.now() - t0 });
    return res;
  } catch (e) {
    console.error('ai-client stream exception:', e instanceof Error ? e.message : String(e));
    logAiTrace({ ...baseTrace, status: 'error', latencyMs: Date.now() - t0, error: 'stream exception' });
    return null;
  }
}

// Embeddings endpoint (same key, verified live for text-embedding-3-small). Callers validate dims.
// traceFeature lets a caller label the corpus being embedded (knowledge, food-log, voice); defaults 'embed'.
export async function embed(model: string, input: string, traceFeature = 'embed'): Promise<number[] | null> {
  const t0 = Date.now();
  const base = { feature: traceFeature, operation: 'embed' as const, model };
  if (!apiKey) {
    logAiTrace({ ...base, status: 'notConfigured' });
    return null;
  }
  try {
    const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`ai-client embed HTTP ${res.status} (${model}):`, body.slice(0, 300));
      logAiTrace({ ...base, status: 'error', latencyMs: Date.now() - t0, error: `HTTP ${res.status}` });
      return null;
    }
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vec = json?.data?.[0]?.embedding;
    logAiTrace({ ...base, status: vec ? 'ok' : 'error', latencyMs: Date.now() - t0 });
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch (e) {
    console.error('ai-client embed exception:', e instanceof Error ? e.message : String(e));
    logAiTrace({ ...base, status: 'error', latencyMs: Date.now() - t0, error: 'embed exception' });
    return null;
  }
}
