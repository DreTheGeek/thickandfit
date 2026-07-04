// Agent observability: one trace row per model call (feature, model, latency, tokens, status,
// input/output previews, retrieval count). Written from the AI client choke point, fire-and-forget
// via after() so it never adds latency. Powers the admin trace viewer + AI-ops analytics.
import 'server-only';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AiTrace = {
  feature: string;
  operation: 'json' | 'stream' | 'embed';
  model?: string | null;
  status: 'ok' | 'error' | 'notConfigured';
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  retrievalCount?: number | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  error?: string | null;
  correlationId?: string | null;
  companyId?: string | null;
  profileId?: string | null;
};

const clip = (s: string | null | undefined, n = 500): string | null => (s ? s.slice(0, n) : null);

export function logAiTrace(t: AiTrace): void {
  const write = async (): Promise<void> => {
    try {
      const svc = createServiceClient();
      await svc.from('ai_trace').insert({
        // company_id is NOT NULL with a single-tenant default; OMIT it when unknown (embeds, eval
        // traces) so the column default applies instead of a null that would reject the insert.
        ...(t.companyId ? { company_id: t.companyId } : {}),
        profile_id: t.profileId ?? null,
        feature: t.feature,
        operation: t.operation,
        model: t.model ?? null,
        status: t.status,
        latency_ms: t.latencyMs ?? null,
        prompt_tokens: t.promptTokens ?? null,
        completion_tokens: t.completionTokens ?? null,
        retrieval_count: t.retrievalCount ?? null,
        input_preview: clip(t.inputPreview),
        output_preview: clip(t.outputPreview),
        error: clip(t.error, 400),
        correlation_id: t.correlationId ?? null,
      });
    } catch {
      // observability must never break the request
    }
  };
  try { after(write); } catch { void write(); }
}

// Pull a short preview string out of an opaque OpenRouter message array (last user message text).
export function previewMessages(messages: unknown[]): string | null {
  try {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as { role?: string; content?: unknown };
      if (m?.role === 'user' || m?.role === 'system') {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          const txt = (m.content as { type?: string; text?: string }[]).find((c) => c.type === 'text' && c.text);
          if (txt?.text) return txt.text;
          return '[multimodal input]';
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}
