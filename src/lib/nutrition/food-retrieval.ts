import 'server-only';

import { embed } from '@/lib/ai/client';
import { EMBED } from '@/lib/ai/models';
import type { FoodLite } from '@/lib/nutrition/macros';
import { createClient } from '@/lib/supabase/server';

export type FoodMatchMethod = 'exact' | 'lexical' | 'trigram' | 'vector' | 'hybrid' | 'legacy' | 'external';

export type ResolvedFoodMatch = {
  food: FoodLite;
  source: string;
  verified: boolean;
  lexicalScore: number;
  trigramScore: number;
  vectorScore: number;
  authorityScore: number;
  matchScore: number;
  dbMatchConfidence: number;
  nutritionConfidence: number;
  method: FoodMatchMethod;
};

type RpcFoodRow = {
  id: string;
  name_en: string;
  name_es: string | null;
  brand: string | null;
  category: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  density_g_per_ml: number | null;
  source: string;
  is_verified: boolean;
  lexical_score: number;
  trigram_score: number;
  vector_score: number;
  authority_score: number;
  match_score: number;
};

const MIN_MATCH_SCORE = 0.64;
const MIN_MARGIN = 0.06;
const STRONG_VECTOR = 0.78;
const STRONG_AUTHORITY = 0.78;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function toFood(row: RpcFoodRow, locale: string): FoodLite {
  const name = (locale === 'es' ? row.name_es || row.name_en : row.name_en || row.name_es) || row.name_en;
  return {
    id: row.id,
    name,
    brand: row.brand,
    category: row.category,
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbG: Number(row.carb_g),
    fatG: Number(row.fat_g),
    densityGPerMl: row.density_g_per_ml,
  };
}

function methodFor(row: RpcFoodRow): FoodMatchMethod {
  const lexical = clamp01(Number(row.lexical_score));
  const trigram = clamp01(Number(row.trigram_score));
  const vector = clamp01(Number(row.vector_score));
  if (lexical >= 0.98) return 'exact';
  const active = [lexical >= 0.55, trigram >= 0.55, vector >= 0.55].filter(Boolean).length;
  if (active >= 2) return 'hybrid';
  if (lexical >= trigram && lexical >= vector) return 'lexical';
  if (trigram >= vector) return 'trigram';
  return 'vector';
}

function nutritionConfidence(row: RpcFoodRow): number {
  if (row.is_verified && row.source === 'coach_override') return 1;
  if (row.is_verified && row.source === 'usda') return 0.99;
  if (row.is_verified && row.source === 'off') return 0.97;
  if (row.is_verified) return 0.94;
  if (row.source === 'usda') return 0.88;
  if (row.source === 'off') return 0.84;
  if (row.source === 'ai' || row.source === 'ai_estimate') return 0.55;
  return 0.7;
}

function isUnverifiedAi(row: RpcFoodRow): boolean {
  return !row.is_verified && (row.source === 'ai' || row.source === 'ai_estimate');
}

/**
 * Decide whether the top database row is strong enough to become nutrition truth.
 *
 * Absolute score alone is insufficient. "Chicken breast" with two nearly tied rows is materially
 * different from a 0.72 winner whose runner-up is 0.41. We therefore require both evidence strength
 * and separation from the runner-up, except for near-exact lexical identity.
 */
function acceptedMatch(rows: RpcFoodRow[]): { row: RpcFoodRow; confidence: number } | null {
  const best = rows[0];
  if (!best) return null;

  const bestScore = clamp01(Number(best.match_score));
  const lexical = clamp01(Number(best.lexical_score));
  const trigram = clamp01(Number(best.trigram_score));
  const vector = clamp01(Number(best.vector_score));
  const authority = clamp01(Number(best.authority_score));
  const secondScore = rows[1] ? clamp01(Number(rows[1].match_score)) : 0;
  const margin = clamp01(bestScore - secondScore);
  const exact = lexical >= 0.98;

  // A model-transcribed/unverified AI row cannot win from semantic similarity alone. It is useful as
  // a cache for a label the member just scanned, but not as a fuzzy source of truth for somebody else's
  // visually similar food. Only near-exact lexical identity is allowed to select it.
  if (isUnverifiedAi(best) && !exact) return null;

  // Exact identity is allowed through even if duplicate rows make the top-two score margin tiny. The
  // source-authority term still determines which duplicate wins.
  if (exact) {
    const confidence = clamp01(0.92 + authority * 0.08);
    return { row: best, confidence };
  }

  if (bestScore < MIN_MATCH_SCORE) return null;
  if (margin < MIN_MARGIN) return null;

  const vectorLed = vector > lexical && vector > trigram;
  if (vectorLed && (vector < STRONG_VECTOR || authority < STRONG_AUTHORITY)) return null;

  // Confidence reflects both the winner's evidence and how decisively it beat the runner-up. This is
  // what downstream verification gating needs, not a raw fused score with no ambiguity signal.
  const marginQuality = clamp01(margin / 0.15);
  const confidence = clamp01(bestScore * 0.82 + marginQuality * 0.13 + authority * 0.05);
  return { row: best, confidence };
}

/**
 * Resolve each predicted food name through the database's hybrid matcher.
 *
 * The embedding is recall evidence, never nutritional truth. The RPC fuses exact/FTS/trigram/vector
 * similarity with source authority, while the returned macros remain the values stored on the chosen
 * food row. If embeddings are unavailable, the RPC still runs with lexical + trigram + authority.
 * If migration 0145 is not deployed yet, callers get null and can use the old local/USDA fallback.
 */
export async function matchFoodsHybrid(names: string[], locale: string): Promise<(ResolvedFoodMatch | null)[]> {
  const sb = await createClient();

  return Promise.all(
    names.map(async (rawName): Promise<ResolvedFoodMatch | null> => {
      const name = rawName.trim();
      if (name.length < 2) return null;

      let vector: number[] | null = null;
      try {
        const candidate = await embed(EMBED.model, name, 'food-resolution');
        if (candidate?.length === EMBED.dims) vector = candidate;
      } catch {
        vector = null;
      }

      try {
        const { data, error } = await sb.rpc('match_food_candidates', {
          p_query: name,
          p_query_embedding: vector ? JSON.stringify(vector) : null,
          p_limit: 8,
        });
        if (error) {
          console.warn('hybrid food resolver unavailable:', error.message);
          return null;
        }

        const rows = (data ?? []) as unknown as RpcFoodRow[];
        const accepted = acceptedMatch(rows);
        if (!accepted) return null;
        const best = accepted.row;
        const score = clamp01(Number(best.match_score));

        return {
          food: toFood(best, locale),
          source: best.source,
          verified: Boolean(best.is_verified),
          lexicalScore: clamp01(Number(best.lexical_score)),
          trigramScore: clamp01(Number(best.trigram_score)),
          vectorScore: clamp01(Number(best.vector_score)),
          authorityScore: clamp01(Number(best.authority_score)),
          matchScore: score,
          dbMatchConfidence: accepted.confidence,
          nutritionConfidence: nutritionConfidence(best),
          method: methodFor(best),
        };
      } catch (error) {
        console.warn('hybrid food resolver failed:', error instanceof Error ? error.message : String(error));
        return null;
      }
    }),
  );
}
