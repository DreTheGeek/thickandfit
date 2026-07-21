// Unified per-member learning memory (Layer 3, v2). SERVER-ONLY.
// One place to (a) embed + upsert a memory from ANY source into member_memory, and (b) recall a
// member's most relevant memories across everything they've done (meals/photos, chat, check-ins,
// meal plans, weights, intake, coach notes, progress). Supersedes the two-source match_coach_memory
// union. Key-gated: with no OPENROUTER_API_KEY every function degrades to a no-op / [] and never
// throws, so chat and the ingestion jobs keep working without embeddings.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { embedText, toVectorLiteral } from '@/lib/coach-ai/embeddings';

export type MemorySource =
  | 'food_day'
  | 'message'
  | 'meal_plan'
  | 'checkin'
  | 'weight'
  | 'intake'
  | 'coach_note'
  | 'physique'
  | 'measurement'
  | 'habit'
  | 'community'
  | 'workout';

export type MemoryKind = 'episodic' | 'fact' | 'summary';

export type IndexMemoryInput = {
  companyId: string;
  profileId?: string | null;
  contactId?: string | null;
  source: MemorySource;
  sourceId: string; // stable logical key of the origin row (idempotent upsert target)
  content: string; // the natural-language text to embed + store
  kind?: MemoryKind;
  occurredAt?: string; // ISO; when the underlying event happened
};

// Embed + upsert one memory. Idempotent per (company, source, sourceId): re-indexing a changed row
// updates it in place. Best-effort + key-gated: returns false (never throws) when unkeyed, the embed
// fails, or there is no member link. Callers fire this in after() so a miss just means that item is
// not recalled yet, never a broken write path.
export async function indexMemory(input: IndexMemoryInput): Promise<boolean> {
  const content = input.content.trim();
  if (!content) return false;
  if (!input.profileId && !input.contactId) return false;
  const vec = await embedText(content);
  if (!vec) return false;
  const svc = createServiceClient();
  const { error } = await svc.from('member_memory').upsert(
    {
      company_id: input.companyId,
      profile_id: input.profileId ?? null,
      contact_id: input.contactId ?? null,
      source: input.source,
      source_id: input.sourceId,
      kind: input.kind ?? 'episodic',
      content,
      embedding: toVectorLiteral(vec),
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,source,source_id' },
  );
  if (error) {
    console.error('indexMemory:', error.message);
    return false;
  }
  return true;
}

export type MemberMemory = {
  source: string;
  kind: string;
  content: string;
  similarity: number;
  occurredAt: string;
};

type MatchRow = {
  source: string;
  kind: string;
  content: string | null;
  similarity: number | null;
  occurred_at: string;
};

// Recall the top `limit` memories nearest to `queryEmbedding` for this member (by profile_id and/or
// contact_id, so claimed migrated clients recall their Lenus history too). [] on any failure.
export async function retrieveMemberMemories(
  profileId: string | null,
  contactId: string | null,
  queryEmbedding: number[],
  limit = 6,
): Promise<MemberMemory[]> {
  if (!profileId && !contactId) return [];
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.rpc('match_member_memory', {
      p_profile_id: profileId,
      p_contact_id: contactId,
      query_embedding: toVectorLiteral(queryEmbedding),
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as MatchRow[])
      .map((r): MemberMemory | null => {
        const content = (r.content ?? '').trim();
        if (!content) return null;
        return {
          source: r.source,
          kind: r.kind,
          content,
          similarity: typeof r.similarity === 'number' ? r.similarity : 0,
          occurredAt: r.occurred_at,
        };
      })
      .filter((x): x is MemberMemory => x !== null);
  } catch {
    return [];
  }
}

// Compact bilingual prompt block. The model is told these are the member's own past records across
// her whole history, surfaced by relevance, so it grounds replies in what she has actually done.
export function renderMemberMemoryBlock(memories: MemberMemory[], locale: 'en' | 'es'): string {
  if (!memories.length) return '';
  const es = locale === 'es';
  const header = es
    ? 'Recuerdos relevantes de la miembro (de todo su historial, por relevancia):'
    : "Relevant member memories (from her whole history, by relevance):";
  const lines = memories.map((m) => {
    const day = (m.occurredAt ?? '').slice(0, 10);
    const snip = m.content.length > 280 ? `${m.content.slice(0, 277)}...` : m.content;
    return `- [${m.source} ${day}] ${snip}`;
  });
  return [header, ...lines].join('\n');
}
