// K10, layer 1: weighted retrieval reranking over member_memory.
//
// The problem with the retrieval this replaces: it ranked purely by vector similarity and took the
// top 6. Cosine similarity does not know that "she is allergic to shellfish" outranks "she mentioned
// shellfish tacos last March", and it does not know that a coach's correction is worth more than a
// passing line in a chat. So the coach could fill its whole memory budget with near-duplicate
// chatter and miss the one durable fact that should change its answer.
//
// This scores four signals instead of one:
//
//   semantic   - the vector similarity we already had
//   recency    - how recent, decayed on a half-life that DEPENDS ON KIND (the key idea below)
//   importance - what type of record this is and where it came from
//   behavior   - whether it matches what she is doing or asking right now
//
// THE KEY IDEA: decay must differ by kind. An episodic memory ("felt exhausted after leg day")
// should fade in about a week, because last month's tiredness is not today's. A durable fact
// ("allergic to shellfish", "no overhead pressing, shoulder") must NOT fade at all, because a
// safety-relevant fact that ages out of the context window is how a coach gives dangerous advice.
// A single global half-life cannot express both, which is exactly why similarity-only retrieval kept
// surfacing chatter over constraints.
//
// PURE: no DB, no clock inside (`now` is injected), so it is unit-testable and safe to call from
// anywhere. The caller over-fetches a wide candidate pool and this reorders it.

export type RerankCandidate = {
  source: string;
  kind: string;
  content: string;
  /** Cosine similarity from the vector search, 0-1. */
  similarity: number;
  /** ISO timestamp of when the remembered thing happened. */
  occurredAt: string;
};

export type RerankedMemory = RerankCandidate & {
  score: number;
  /** Per-signal breakdown, kept for debugging and for the ai_trace record. */
  signals: { semantic: number; recency: number; importance: number; behavior: number };
};

/** Weights sum to 1. Semantic still dominates: the other signals reorder, they do not override. */
const W = { semantic: 0.5, recency: 0.2, importance: 0.2, behavior: 0.1 };

/**
 * Half-life in days, by kind.
 *   fact     - durable. Allergies, injuries, hard constraints. Effectively never decays.
 *   summary  - a rolled-up period. Stays useful for a season.
 *   episodic - a single moment. Fades in about a week.
 */
const HALF_LIFE_DAYS: Record<string, number> = {
  fact: 3650,
  summary: 120,
  episodic: 7,
};
const DEFAULT_HALF_LIFE = 30;

/**
 * Importance by where the memory came from. A coach correction is the strongest signal in the system
 * (a human deliberately fixed something), an intake answer is a stated constraint, and a passing chat
 * line is the weakest. Unknown sources sit in the middle rather than at either extreme.
 */
const SOURCE_IMPORTANCE: Record<string, number> = {
  correction: 1,
  intake: 0.95,
  health_profile: 0.95,
  coach_note: 0.9,
  check_in: 0.7,
  food_log: 0.5,
  workout_log: 0.5,
  chat: 0.35,
};
const DEFAULT_IMPORTANCE = 0.6;

/** Kind carries its own weight on top of source: a fact is structurally more valuable than a moment. */
const KIND_IMPORTANCE: Record<string, number> = { fact: 1, summary: 0.75, episodic: 0.5 };

const DAY_MS = 86_400_000;

/** Exponential decay to a 0-1 score. */
export function recencyScore(occurredAt: string, kind: string, now: Date): number {
  const t = Date.parse(occurredAt);
  if (!Number.isFinite(t)) return 0.5; // unknown date: neutral, never a bonus or a penalty
  const ageDays = Math.max(0, (now.getTime() - t) / DAY_MS);
  const halfLife = HALF_LIFE_DAYS[kind] ?? DEFAULT_HALF_LIFE;
  return Math.pow(0.5, ageDays / halfLife);
}

export function importanceScore(source: string, kind: string): number {
  const s = SOURCE_IMPORTANCE[source] ?? DEFAULT_IMPORTANCE;
  const k = KIND_IMPORTANCE[kind] ?? 0.6;
  // Geometric mean so a weak signal on either axis pulls the result down rather than being averaged
  // away: a chat message that happens to be tagged 'fact' should not score like an intake answer.
  return Math.sqrt(s * k);
}

/**
 * Overlap between the memory and what she is doing right now (the foods in today's log, the exercise
 * on screen, the words of her question). Token containment, not embeddings: this signal only needs to
 * catch "this memory names the thing she is asking about", and a second embedding call per candidate
 * would cost more than the signal is worth.
 */
export function behaviorScore(content: string, behaviorTerms: string[]): number {
  if (!behaviorTerms.length) return 0;
  const hay = content.toLowerCase();
  let hits = 0;
  for (const term of behaviorTerms) {
    const t = term.trim().toLowerCase();
    if (t.length >= 3 && hay.includes(t)) hits++;
  }
  return Math.min(1, hits / Math.min(behaviorTerms.length, 3));
}

/**
 * Rerank a candidate pool and return the best `limit`.
 *
 * Call this with a POOL WIDER than you need (the caller over-fetches ~5x). Reranking the top 6 of a
 * similarity-only search cannot rescue an important memory that similarity ranked 12th, which is the
 * whole failure this exists to fix.
 */
export function rerankMemories(
  candidates: RerankCandidate[],
  opts: { now: Date; behaviorTerms?: string[]; limit?: number },
): RerankedMemory[] {
  const terms = opts.behaviorTerms ?? [];
  const limit = opts.limit ?? 6;

  const scored = candidates.map((c): RerankedMemory => {
    const semantic = Math.max(0, Math.min(1, c.similarity));
    const recency = recencyScore(c.occurredAt, c.kind, opts.now);
    const importance = importanceScore(c.source, c.kind);
    const behavior = behaviorScore(c.content, terms);
    const score =
      W.semantic * semantic + W.recency * recency + W.importance * importance + W.behavior * behavior;
    return { ...c, score, signals: { semantic, recency, importance, behavior } };
  });

  scored.sort((a, b) => b.score - a.score);

  // Near-duplicate suppression. The memory budget is small, and two rows saying the same thing waste
  // half of it. Compared on a normalized prefix, which is enough to catch the re-indexed duplicates
  // this pipeline actually produces without the cost of pairwise similarity.
  const seen = new Set<string>();
  const out: RerankedMemory[] = [];
  for (const m of scored) {
    const fingerprint = m.content.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/** Pull behavior terms out of the member's live context (her question + what she logged today). */
export function behaviorTermsFrom(input: { question?: string | null; recentFoods?: string[] }): string[] {
  const terms: string[] = [];
  for (const f of input.recentFoods ?? []) {
    const t = f.trim();
    if (t) terms.push(t);
  }
  // Content words from the question. Short tokens are dropped: "the" matching everything would make
  // the behavior signal fire on every candidate and stop discriminating.
  const q = (input.question ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  for (const w of q.split(/\s+/)) if (w.length >= 4) terms.push(w);
  return terms.slice(0, 12);
}
