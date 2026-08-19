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
        // Embeddings are an additive retrieval signal. They must never make food logging unavailable.
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
        const best = rows[0];
        if (!best) return null;

        const score = clamp01(Number(best.match_score));
        // Do not silently convert a weak semantic neighbor into nutrition facts. Below this floor the
        // caller grounds against USDA instead. Exact names and verified sources naturally clear it.
        if (score < 0.58) return null;

        return {
          food: toFood(best, locale),
          source: best.source,
          verified: Boolean(best.is_verified),
          lexicalScore: clamp01(Number(best.lexical_score)),
          trigramScore: clamp01(Number(best.trigram_score)),
          vectorScore: clamp01(Number(best.vector_score)),
          authorityScore: clamp01(Number(best.authority_score)),
          matchScore: score,
          dbMatchConfidence: score,
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
