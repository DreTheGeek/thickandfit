import 'server-only';
// K4 read path: load the population portion priors on the scan hot path.
//
// The WRITE half of this file is gone. Recomputing the priors is now `public.refresh_population_bias()`
// in Postgres (migration 0102), because the job read from Supabase, did arithmetic on Vercel, and
// wrote back to Supabase: the data never needed to leave the database. On 2026-08-01 Vercel was
// soft-blocked and every scheduled run got a 402, so an aggregation Postgres could do by itself
// stopped happening because a different vendor was unavailable.
//
// The arithmetic still has a single definition in population-bias.ts. The SQL is a translation of it,
// and .qa-visual/population-bias-sql-parity-test.mjs runs both over the same corpus and requires
// identical output, so the two cannot drift silently.
import { createServiceClient } from '@/lib/supabase/service';
import type { BiasRow } from '@/lib/nutrition/population-bias';

/** Cap the scan read. The prompt takes ~6; fetching more just to sort them again is wasted latency. */
const READ_LIMIT = 12;

/**
 * Read the priors for a scan. Returns [] on any failure so a missing table, an empty tenant, or a DB
 * blip degrades to exactly today's behavior rather than breaking the scan.
 */
export async function readPopulationBias(companyId: string): Promise<BiasRow[]> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from('scan_population_bias')
      .select('food_key, ratio, sample_count, member_count')
      .eq('company_id', companyId)
      .limit(READ_LIMIT);
    if (error) {
      console.error('readPopulationBias:', error.message);
      return [];
    }
    const rows = (data ?? []) as { food_key: string; ratio: number; sample_count: number; member_count: number }[];
    return rows
      .map((r) => ({ food: r.food_key, ratio: Number(r.ratio), samples: r.sample_count, members: r.member_count }))
      .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
  } catch (e) {
    console.error('readPopulationBias:', e instanceof Error ? e.message : e);
    return [];
  }
}
