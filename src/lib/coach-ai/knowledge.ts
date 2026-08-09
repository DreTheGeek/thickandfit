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
//
// What a null embedding COSTS, and why reembedMissing exists: match_coach_knowledge filters
// `embedding is not null`, so a chunk stored without a vector is permanently unretrievable and looks
// identical to a good one in the sources list. A save is only real when it is embedded, so every
// write path reports `embedded` alongside `chunks`, and reembedMissing() is the repair path for rows
// that were written while the key was absent or the embeddings endpoint was failing.
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
// A discriminated result, NOT a counts-only object. The old shape returned { chunks: 0 } on a failed
// insert, which every caller read as "nothing to save" rather than "the save failed", so a database
// error surfaced to the coach as a success. Failure now has to be handled to compile.
export type IngestResult =
  | { ok: true; sourceId: string; chunks: number; embedded: number }
  | { ok: false; error: string };

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
  if (chunks.length === 0) return { ok: false, error: 'empty' };

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

  const { error } = await sb.from('coach_knowledge').insert(rows);
  if (error) {
    console.error('ingestKnowledge insert:', error.message);
    return { ok: false, error: 'insert_failed' };
  }
  return { ok: true, sourceId, chunks: chunks.length, embedded };
}

// --- Source listing + delete (for the coach UI) -----------------------------
export type KnowledgeSource = {
  sourceId: string;
  title: string;
  chunks: number;
  embedded: number;
  createdAt: string;
};

// List the company's knowledge documents (grouped by source_id) for the coach page. Newest source
// first.
//
// Two reads, deliberately. The single read this replaced pulled the `embedding` column just to test
// it for null, which ships a 1536-float vector per row (~20KB each) over the wire on every page load
// purely to compute a count. The second query fetches ONLY the ids of the unembedded rows, which is
// the rare case, so the common path moves kilobytes instead of megabytes and the "not searchable"
// count stays exact.
export async function listKnowledgeSources(companyId: string): Promise<KnowledgeSource[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('coach_knowledge')
    .select('id, source_id, title, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error || !Array.isArray(data)) return [];

  const { data: nullRows, error: nullErr } = await sb
    .from('coach_knowledge')
    .select('id')
    .eq('company_id', companyId)
    .is('embedding', null)
    .limit(5000);
  if (nullErr) console.error('listKnowledgeSources null-scan:', nullErr.message);
  const unembedded = new Set((Array.isArray(nullRows) ? nullRows : []).map((r) => (r as { id: string }).id));

  const bySource = new Map<string, KnowledgeSource>();
  for (const r of data as { id: string; source_id: string; title: string | null; created_at: string }[]) {
    const cur =
      bySource.get(r.source_id) ??
      { sourceId: r.source_id, title: r.title ?? 'Untitled', chunks: 0, embedded: 0, createdAt: r.created_at };
    cur.chunks += 1;
    if (!unembedded.has(r.id)) cur.embedded += 1;
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

// --- Repair: re-embed rows that were stored without a vector ----------------
export type ReembedResult = { missing: number; fixed: number; failed: number };

// How many of this company's chunks are stored but unretrievable (embedding is null).
export async function countUnembedded(companyId: string): Promise<number> {
  const sb = createServiceClient();
  const { count, error } = await sb
    .from('coach_knowledge')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('embedding', null);
  if (error) {
    console.error('countUnembedded:', error.message);
    return 0;
  }
  return count ?? 0;
}

// Backfill embeddings for rows saved without one. This is the ONLY way a document written while the
// key was missing (or while the embeddings endpoint was erroring) ever becomes retrievable again:
// match_coach_knowledge skips null-embedding rows, so re-saving is otherwise the only repair and
// re-saving is exactly what a coach will not think to do. Bounded per call so one click cannot run
// unbounded; the caller can click again while `missing` is still above zero.
export async function reembedMissing(companyId: string, batch = 100): Promise<ReembedResult> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('coach_knowledge')
    .select('id, content')
    .eq('company_id', companyId)
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(batch, 500)));
  if (error || !Array.isArray(data)) {
    if (error) console.error('reembedMissing select:', error.message);
    return { missing: 0, fixed: 0, failed: 0 };
  }

  const rows = data as { id: string; content: string | null }[];
  let fixed = 0;
  let failed = 0;
  for (const row of rows) {
    const content = (row.content ?? '').trim();
    if (!content) {
      failed += 1;
      continue;
    }
    const vec = await embedText(content);
    if (!vec) {
      failed += 1;
      continue;
    }
    const { error: upErr } = await sb
      .from('coach_knowledge')
      .update({ embedding: toVectorLiteral(vec) })
      .eq('id', row.id)
      .eq('company_id', companyId);
    if (upErr) {
      console.error('reembedMissing update:', upErr.message);
      failed += 1;
      continue;
    }
    fixed += 1;
  }
  return { missing: rows.length, fixed, failed };
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

// --- Prompt budget ----------------------------------------------------------
// The old renderer clipped EVERY hit at 397 characters. Against a corpus whose chunks reach 2,400
// characters that threw away up to 83% of the retrieved text, mid-word, which is the likeliest reason
// the coach did not seem to know what she had taught it. The cap was never derived from anything.
//
// Derivation. The chat model is AI_MODELS.chat = anthropic/claude-haiku-4.5, a 200,000-token context
// window. The rest of the turn is small and bounded: the persona is ~1.2K tokens (static, prompt
// cached), the live context block a few hundred, the member memory block 6 records x 280 chars
// (~450 tokens), history 12 turns capped at 2,000 chars each (~6K tokens worst case). Her documented
// method is the single most valuable thing in the prompt and it was the only block being starved.
//
// 12,000 characters is ~3,000 tokens: 1.5% of the window, and ~$0.003 of input at haiku's $1/1M. At
// the default limit of 5 hits it is 2,400 characters each, which is exactly the longest chunk in the
// corpus, so today's knowledge base passes through whole and nothing is cut at all. The budget is a
// ceiling that protects the prompt from a future 50-chunk retrieval, not a routine trim.
const KNOWLEDGE_CHAR_BUDGET = 12_000;
// Floor reserved for each hit still to come, so one long first chunk cannot starve the rest.
const MIN_CHARS_PER_HIT = 600;

// Cut `text` to at most `max` characters WITHOUT ending mid-sentence. Prefers the last sentence
// terminator in the allowed range, then the last line break, then the last word boundary. A cut that
// lands mid-word turns a fact into a different fact ("do not eat after 8" from "do not eat after 8pm
// unless..."), which is worse than saying less.
function clipAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentence = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('.\n'),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('\n'),
  );
  // Only honour a boundary that keeps at least half the allowance, otherwise we would throw away more
  // than the truncation itself does.
  if (sentence >= Math.floor(max * 0.5)) return `${window.slice(0, sentence + 1).trim()} ...`;
  const space = window.lastIndexOf(' ');
  if (space > 0) return `${window.slice(0, space).trim()} ...`;
  return `${window.trim()} ...`;
}

// Render retrieved knowledge into a bilingual system block. Empty in -> ''. Hits arrive in similarity
// order, so the budget is spent best-match first. The model is told this is Stephanie's documented
// method / voice and to treat it as the source of truth, distinct from the member's own past records
// (the memory block).
export function renderKnowledgeBlock(hits: KnowledgeHit[], locale: 'en' | 'es'): string {
  if (!hits.length) return '';
  const header =
    locale === 'es'
      ? "Método y voz de la coach Stephanie (tu fuente de verdad; usa este enfoque, no inventes):"
      : "Coach Stephanie's documented method and voice (your source of truth; use this approach, do not invent):";

  const lines: string[] = [];
  let remaining = KNOWLEDGE_CHAR_BUDGET;
  for (let i = 0; i < hits.length; i += 1) {
    if (remaining < MIN_CHARS_PER_HIT) break; // no room left to say anything useful
    const stillToCome = hits.length - 1 - i;
    const allowance = Math.max(MIN_CHARS_PER_HIT, remaining - stillToCome * MIN_CHARS_PER_HIT);
    const snippet = clipAtBoundary(hits[i].content, allowance);
    lines.push(`- ${snippet}`);
    remaining -= snippet.length;
  }
  return [header, ...lines].join('\n');
}
