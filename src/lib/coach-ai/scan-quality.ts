// Per-member scan-quality rollup: how often this member corrects photo-scan results, in which
// direction, and on which foods. Consumed by the nightly insights job (payload.scan_quality) and
// rendered into the coach chat context, so coaching KNOWS how reliable this member's scanned
// portions are. ONE indexed query (0066: profile_id, feature, created_at), aggregation in TS.
//
// UNITS TRAP (do not "fix"): portion error math must come ONLY from the correction payload
// (predicted vs corrected grams, both in user-visible units). food_log.grams stores the
// raw-CONVERTED effGrams and would contaminate the math for raw-stated foods.
import 'server-only';
import type { createServiceClient } from '@/lib/supabase/service';

export type CorrectedFood = { name: string; count: number; avg_delta_pct: number }; // +20 = corrected up 20%

export type ScanQuality = {
  scans_30d: number; // loggable photo-scan inferences (status ok | product)
  corrections_30d: number; // of those, at least one item corrected
  accepted_30d: number; // user_marked_correct = true (every item accepted as-is)
  correction_rate: number; // corrections / scans (floored callers decide display)
  avg_portion_error_pct: number | null; // signed mean of (corrected-predicted)/predicted * 100
  top_corrected_foods: CorrectedFood[]; // max 3, count >= 2
};

export const MIN_SCANS_FOR_QUALITY = 3;
export const MIN_CORRECTIONS_FOR_ERROR = 3;
const ROW_CAP = 500;
const DELTA_CLAMP_PCT = 200; // one absurd outlier must not wreck the mean

type GramDelta = { name: string; deltaPct: number };

// Shape-defensive correction parser, exported for the intelligence dashboard. Handles BOTH shapes:
// the legacy single object ({field:'grams', predicted_grams, corrected_grams, predicted_name}) and
// the current items array ({items:[{predicted_grams, corrected_grams, predicted_name, fields}]}).
// Returns only entries with a real gram pair; identity-only corrections carry no portion signal.
export function parseGramDeltas(correction: unknown): GramDelta[] {
  if (!correction || typeof correction !== 'object') return [];
  const c = correction as Record<string, unknown>;
  const entries: Record<string, unknown>[] = Array.isArray(c.items)
    ? (c.items.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null))
    : [c];
  const out: GramDelta[] = [];
  for (const e of entries) {
    const predicted = typeof e.predicted_grams === 'number' ? e.predicted_grams : null;
    const corrected = typeof e.corrected_grams === 'number' ? e.corrected_grams : null;
    const name = typeof e.predicted_name === 'string' ? e.predicted_name : null;
    if (predicted == null || corrected == null || predicted <= 0 || !name) continue;
    const raw = ((corrected - predicted) / predicted) * 100;
    out.push({ name, deltaPct: Math.max(-DELTA_CLAMP_PCT, Math.min(DELTA_CLAMP_PCT, raw)) });
  }
  return out;
}

type InferenceRow = {
  status: string | null;
  correction: unknown;
  user_marked_correct: boolean | null;
  corrected_at: string | null;
};

// Returns null when the member is below the signal floor or on any query error (never throws;
// insights must not fail because telemetry aggregation hiccuped).
export async function fetchScanQuality(
  sb: ReturnType<typeof createServiceClient>,
  profileId: string,
  sinceIso: string,
): Promise<ScanQuality | null> {
  try {
    const { data, error } = await sb
      .from('ai_inferences')
      .select('status, correction, user_marked_correct, corrected_at')
      .eq('profile_id', profileId)
      .eq('feature', 'photo-scan')
      .gte('created_at', `${sinceIso}T00:00:00Z`)
      .limit(ROW_CAP);
    if (error) {
      console.error('fetchScanQuality:', error.message);
      return null;
    }
    const rows = (data ?? []) as InferenceRow[];
    const scans = rows.filter((r) => r.status === 'ok' || r.status === 'product');
    if (scans.length < MIN_SCANS_FOR_QUALITY) return null;

    const correctedRows = scans.filter((r) => r.corrected_at != null && r.user_marked_correct !== true);
    const accepted = scans.filter((r) => r.user_marked_correct === true).length;

    const deltas: GramDelta[] = correctedRows.flatMap((r) => parseGramDeltas(r.correction));
    const avgError =
      deltas.length >= MIN_CORRECTIONS_FOR_ERROR
        ? Math.round((deltas.reduce((a, d) => a + d.deltaPct, 0) / deltas.length) * 10) / 10
        : null;

    const byFood = new Map<string, { count: number; sum: number }>();
    for (const d of deltas) {
      const key = d.name.toLowerCase();
      const cur = byFood.get(key) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += d.deltaPct;
      byFood.set(key, cur);
    }
    const top = [...byFood.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([name, v]) => ({ name, count: v.count, avg_delta_pct: Math.round((v.sum / v.count) * 10) / 10 }));

    return {
      scans_30d: scans.length,
      corrections_30d: correctedRows.length,
      accepted_30d: accepted,
      correction_rate: Math.round((correctedRows.length / scans.length) * 1000) / 1000,
      avg_portion_error_pct: avgError,
      top_corrected_foods: top,
    };
  } catch (e) {
    console.error('fetchScanQuality exception:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
