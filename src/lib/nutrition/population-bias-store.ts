import 'server-only';
// K4 storage layer: compute the population portion bias from corrected scans, and read it back on
// the scan hot path. All math lives in population-bias.ts (pure, unit-tested); this file only moves
// rows.
import { createServiceClient } from '@/lib/supabase/service';
import {
  aggregateBias,
  normalizeFoodKey,
  type BiasRow,
  type BiasSample,
} from '@/lib/nutrition/population-bias';

/** How far back the aggregate looks. A year-old bias may belong to a model that no longer runs. */
const LOOKBACK_DAYS = 120;
/** Cap the scan read. The prompt takes ~6; fetching more just to sort them again is wasted latency. */
const READ_LIMIT = 12;

type CorrectionItem = {
  predicted_name?: string | null;
  predicted_grams?: number | null;
  corrected_grams?: number | null;
};
type Row = { profile_id: string | null; correction: { items?: CorrectionItem[] } | null };

/**
 * Recompute every prior for a tenant and replace the table's contents.
 *
 * DELETE-then-insert rather than upsert: a food whose bias has decayed below the floors must
 * DISAPPEAR. Upserting alone would leave a stale prior in place forever, still being injected into
 * every scan, long after the evidence for it stopped existing. That is the worst failure this table
 * has, so the refresh is written to make it structurally impossible.
 *
 * Never throws: it runs from a cron and from an admin button, and neither should 500 over telemetry.
 */
export async function refreshPopulationBias(companyId: string): Promise<{ ok: boolean; rows: number; scanned: number }> {
  const svc = createServiceClient();
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const { data, error } = await svc
      .from('ai_inferences')
      .select('profile_id, correction')
      .eq('company_id', companyId)
      .eq('feature', 'photo-scan')
      .not('correction', 'is', null)
      .gte('created_at', since)
      .limit(5000);
    if (error) {
      console.error('refreshPopulationBias read:', error.message);
      return { ok: false, rows: 0, scanned: 0 };
    }

    const samples: BiasSample[] = [];
    for (const row of (data ?? []) as Row[]) {
      const pid = row.profile_id;
      if (!pid) continue; // no member => cannot count toward the distinct-member floor
      for (const it of row.correction?.items ?? []) {
        const food = normalizeFoodKey(it.predicted_name ?? '');
        const p = Number(it.predicted_grams ?? 0);
        const c = Number(it.corrected_grams ?? 0);
        if (!food || !(p > 0) || !(c > 0)) continue;
        samples.push({ food, predictedGrams: p, correctedGrams: c, profileId: pid });
      }
    }

    const rows = aggregateBias(samples);

    // Replace wholesale. Scoped to the tenant so this can never touch another company's priors.
    const { error: delErr } = await svc.from('scan_population_bias').delete().eq('company_id', companyId);
    if (delErr) {
      console.error('refreshPopulationBias delete:', delErr.message);
      return { ok: false, rows: 0, scanned: samples.length };
    }
    if (rows.length > 0) {
      const { error: insErr } = await svc.from('scan_population_bias').insert(
        rows.map((r) => ({
          company_id: companyId,
          food_key: r.food,
          ratio: r.ratio,
          sample_count: r.samples,
          member_count: r.members,
          computed_at: new Date().toISOString(),
        })),
      );
      if (insErr) {
        console.error('refreshPopulationBias insert:', insErr.message);
        return { ok: false, rows: 0, scanned: samples.length };
      }
    }
    return { ok: true, rows: rows.length, scanned: samples.length };
  } catch (e) {
    console.error('refreshPopulationBias:', e instanceof Error ? e.message : e);
    return { ok: false, rows: 0, scanned: 0 };
  }
}

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
