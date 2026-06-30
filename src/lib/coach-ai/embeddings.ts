// Layer 3 vector memory / RAG primitives for the subscriber AI coach. SERVER-ONLY.
// One place that knows how to (a) turn text into a 1536-dim embedding via the OpenRouter pattern
// (same lazy-key style as chat.ts / insights.ts / photo.ts), and (b) recall a subscriber's most
// semantically relevant past records (their own coach_messages + food_log day summaries) for the
// chat context.
//
// Key-gating: with no OPENROUTER_API_KEY every function degrades to a no-op (embedText -> null,
// retrieval -> []). Chat and the nightly job both keep working; they simply skip RAG. tsc + build
// pass with no key and nothing throws.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { EMBED } from '@/lib/ai/models';

// Embeddings ARE served by OpenRouter's /embeddings endpoint (verified live: returns a 1536-dim vector
// for text-embedding-3-small), so this uses the same OPENROUTER_API_KEY as every other AI call. With no
// key, embedText -> null and RAG degrades to a no-op (chat + nightly job still work, minus semantic recall).
const apiKey = process.env.OPENROUTER_API_KEY;

export const EMBED_MODEL = EMBED.model;
export const EMBED_DIMS = EMBED.dims;
const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';

// A single retrieved memory: a past chat message or an embedded food_log day summary for this member.
export type CoachMemory = {
  source: 'message' | 'food_log';
  content: string;
  similarity: number;
  createdAt: string;
};

export function embeddingsConfigured(): boolean {
  return Boolean(apiKey);
}

// Embed one string. Returns the vector, or null when the key is absent or the call fails (callers
// degrade: no embedding stored / no RAG injected). Never throws.
export async function embedText(input: string): Promise<number[] | null> {
  if (!apiKey) return null;
  const text = input.trim();
  if (!text) return null;
  try {
    const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBED_DIMS) return null;
    if (!vec.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return vec;
  } catch {
    return null;
  }
}

// pgvector wants a bracketed literal ("[0.1,0.2,...]") for vector columns/params over the REST API.
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

// Recall the top `limit` memories for this subscriber nearest to `queryEmbedding`, via the
// match_coach_memory RPC (cosine, profile-scoped). Returns [] on any failure or empty result.
export async function retrieveMemories(
  profileId: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<CoachMemory[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc('match_coach_memory', {
      p_profile_id: profileId,
      query_embedding: toVectorLiteral(queryEmbedding),
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as { source: string; content: string | null; similarity: number; created_at: string }[])
      .map((r): CoachMemory | null => {
        const content = (r.content ?? '').trim();
        if (!content) return null;
        const source = r.source === 'food_log' ? 'food_log' : 'message';
        return {
          source,
          content,
          similarity: typeof r.similarity === 'number' ? r.similarity : 0,
          createdAt: r.created_at,
        };
      })
      .filter((x): x is CoachMemory => x !== null);
  } catch {
    return [];
  }
}

// Convenience: embed a question and retrieve in one step. Returns [] when unkeyed (embedText null).
export async function retrieveForQuery(
  profileId: string,
  question: string,
  limit = 5,
): Promise<CoachMemory[]> {
  const vec = await embedText(question);
  if (!vec) return [];
  return retrieveMemories(profileId, vec, limit);
}

// Render retrieved memories into a compact, bilingual block for the system prompt. Empty in -> ''.
// Kept short (each snippet trimmed) to control tokens; the model is told these are the member's own
// past records, surfaced by relevance, so it can ground replies in real history.
export function renderMemoryBlock(memories: CoachMemory[], locale: 'en' | 'es'): string {
  if (!memories.length) return '';
  const es = locale === 'es';
  const header = es
    ? 'Recuerdos relevantes de la miembro (registros pasados, por relevancia):'
    : "Relevant member memories (past records, by relevance):";
  const label = (m: CoachMemory): string => {
    if (m.source === 'food_log') return es ? 'comida' : 'meal';
    return es ? 'chat' : 'chat';
  };
  const lines = memories.map((m) => {
    const day = (m.createdAt ?? '').slice(0, 10);
    const snippet = m.content.length > 280 ? `${m.content.slice(0, 277)}...` : m.content;
    return `- [${label(m)} ${day}] ${snippet}`;
  });
  return [header, ...lines].join('\n');
}
