// Coach Knowledge Base ingestion + retrieval (Layer 4 RAG). SERVER-ONLY.
// A coach pastes Stephanie's voice / method / FAQ text; we chunk it, embed each chunk via the
// existing key-gated embedText(), and store the chunks in coach_knowledge under one source_id. At
// chat time we embed the member's question and recall the top-K knowledge chunks for the company via
// match_coach_knowledge, then inject them as a distinct system block (her method, separate from the
// member's own memories).
//
// Key-gating / graceful degradation: with NO OPENROUTER_API_KEY, embedText() returns null, so ingest
// stores every chunk with embedding = null (still listed + readable; RAG simply finds nothing until a
// key + a backfill arrive). retrieveKnowledge returns [] when unkeyed. Nothing here ever throws on a
// missing key; tsc + build pass without it.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { embedText, toVectorLiteral } from '@/lib/coach-ai/embeddings';

// --- Chunking ---------------------------------------------------------------
// Paragraph-boundary splitter, ~500-token target with ~50-token overlap (1 token ~= 4 chars). Adapted
// from ai-junkies-ref/src/lib/ai/chunking.ts (chunkByParagraph). Pure function, no key needed.
const TARGET_CHARS = 500 * 4;
const OVERLAP_CHARS = 50 * 4;

export function chunkKnowledge(text: string): string[] {
  if (!text || !text.trim()) return [];

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) {
    // No blank-line structure: fall back to the whole (trimmed) text as a single chunk, split only
    // if it blows past the target so we never store one giant chunk that defeats retrieval.
    const t = text.trim();
    if (t.length <= TARGET_CHARS) return [t];
    const out: string[] = [];
    for (let i = 0; i < t.length; i += TARGET_CHARS - OVERLAP_CHARS) {
      out.push(t.slice(i, i + TARGET_CHARS).trim());
    }
    return out.filter(Boolean);
  }

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const combined = current ? `${current}\n\n${paragraph}` : paragraph;
    if (combined.length > TARGET_CHARS && current) {
      chunks.push(current.trim());
      // Keep the tail of the current chunk for context continuity (overlap).
      current = `${current.slice(-OVERLAP_CHARS)}\n\n${paragraph}`;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// --- Ingestion --------------------------------------------------------------
export type IngestResult = { sourceId: string; chunks: number; embedded: number };

// Ingest one pasted document: chunk -> embed each chunk (key-gated) -> insert rows under one
// source_id. embedded counts how many chunks got a real vector (0 when unkeyed). Returns the source
// id + counts. The caller (a coach action) has already authorized companyId + createdBy.
export async function ingestKnowledge(
  companyId: string,
  createdBy: string,
  title: string,
  text: string,
): Promise<IngestResult> {
  const sb = createServiceClient();
  const sourceId = crypto.randomUUID();
  const chunks = chunkKnowledge(text);

  let embedded = 0;
  const rows: {
    company_id: string;
    source_id: string;
    title: string;
    chunk_index: number;
    content: string;
    embedding: string | null;
    created_by: string;
  }[] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const vec = await embedText(chunks[i]); // null when no key OR the call fails; ingest still proceeds
    if (vec) embedded += 1;
    rows.push({
      company_id: companyId,
      source_id: sourceId,
      title: title.trim() || 'Untitled',
      chunk_index: i,
      content: chunks[i],
      embedding: vec ? toVectorLiteral(vec) : null,
      created_by: createdBy,
    });
  }

  if (rows.length) {
    const { error } = await sb.from('coach_knowledge').insert(rows);
    if (error) {
      console.error('ingestKnowledge insert:', error.message);
      return { sourceId, chunks: 0, embedded: 0 };
    }
  }
  return { sourceId, chunks: chunks.length, embedded };
}

// --- Source listing + delete (for the coach UI) -----------------------------
export type KnowledgeSource = {
  sourceId: string;
  title: string;
  chunks: number;
  embedded: number;
  createdAt: string;
};

// List the company's knowledge documents (grouped by source_id) for the coach page. One read, grouped
// in memory. Newest source first.
export async function listKnowledgeSources(companyId: string): Promise<KnowledgeSource[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('coach_knowledge')
    .select('source_id, title, embedding, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error || !Array.isArray(data)) return [];

  const bySource = new Map<string, KnowledgeSource>();
  for (const r of data as { source_id: string; title: string | null; embedding: unknown; created_at: string }[]) {
    const cur =
      bySource.get(r.source_id) ??
      { sourceId: r.source_id, title: r.title ?? 'Untitled', chunks: 0, embedded: 0, createdAt: r.created_at };
    cur.chunks += 1;
    if (r.embedding != null) cur.embedded += 1;
    // created_at: keep the earliest (the order is newest-first, so the last seen is earliest).
    cur.createdAt = r.created_at;
    bySource.set(r.source_id, cur);
  }
  return [...bySource.values()];
}

// Delete one knowledge document (all chunks under a source_id) for this company. Company-scoped so a
// coach can only delete their own tenant's knowledge.
export async function deleteKnowledgeSource(companyId: string, sourceId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('coach_knowledge')
    .delete()
    .eq('company_id', companyId)
    .eq('source_id', sourceId);
  if (error) {
    console.error('deleteKnowledgeSource:', error.message);
    return false;
  }
  return true;
}

// --- Retrieval (for the chat prompt) ----------------------------------------
export type KnowledgeHit = { title: string | null; content: string; similarity: number };

// Recall the top-K knowledge chunks for this company nearest to the question. Key-gated: embedText
// returns null when unkeyed -> []. Returns [] on any RPC error too (chat keeps working without RAG).
export async function retrieveKnowledge(
  companyId: string,
  question: string,
  limit = 5,
): Promise<KnowledgeHit[]> {
  const vec = await embedText(question);
  if (!vec) return [];
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc('match_coach_knowledge', {
      p_company_id: companyId,
      query_embedding: toVectorLiteral(vec),
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as { title: string | null; content: string | null; similarity: number }[])
      .map((h): KnowledgeHit | null => {
        const content = (h.content ?? '').trim();
        if (!content) return null;
        return {
          title: h.title ?? null,
          content,
          similarity: typeof h.similarity === 'number' ? h.similarity : 0,
        };
      })
      .filter((x): x is KnowledgeHit => x !== null);
  } catch {
    return [];
  }
}

// Render retrieved knowledge into a compact bilingual system block. Empty in -> ''. Each snippet is
// trimmed to control tokens. The model is told this is Stephanie's documented method / voice and to
// treat it as the source of truth, distinct from the member's own past records (the memory block).
export function renderKnowledgeBlock(hits: KnowledgeHit[], locale: 'en' | 'es'): string {
  if (!hits.length) return '';
  const header =
    locale === 'es'
      ? "Metodo y voz de la coach Stephanie (tu fuente de verdad; usa este enfoque, no inventes):"
      : "Coach Stephanie's documented method and voice (your source of truth; use this approach, do not invent):";
  const lines = hits.map((h) => {
    const snippet = h.content.length > 400 ? `${h.content.slice(0, 397)}...` : h.content;
    return `- ${snippet}`;
  });
  return [header, ...lines].join('\n');
}
