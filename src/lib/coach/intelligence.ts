// Scan-intelligence data layer for the coach dashboard: how accurate the scans are, whether the
// members' corrections are trending down, and whether confidence is calibrated (high-confidence
// items should rarely be corrected). Two bounded selects + TS aggregation, mirroring overview.ts.
//
// UNITS TRAP: portion error comes ONLY from the correction payload (visible vs visible grams,
// parsed by scan-quality.ts's shared parser). food_log.grams is raw-converted and never used for
// gram math here; the food_log query below feeds the yes/no calibration buckets only.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { parseGramDeltas } from '@/lib/coach-ai/scan-quality';

const ROW_CAP = 20_000;
const WINDOW_DAYS = 90;

export type DayCount = { date: string; scans: number; corrected: number };
export type CalibrationBucket = { decile: string; items: number; correctedPct: number };
export type WeeklyRate = {
  weekStart: string;
  scans: number;
  correctionRatePct: number | null;
  portionMapePct: number | null;
};
export type FeatureBreakdown = {
  feature: string;
  model: string;
  promptVersion: string;
  count: number;
  avgConfidence: number | null;
  avgLatencyMs: number | null;
  errorPct: number; // share of rows with status error/notConfigured
};
export type CorrectedFoodStat = { name: string; count: number; avgDeltaPct: number };

export type ScanIntelligence = {
  windowDays: number;
  totals: {
    scans30d: number;
    scansPerDay: number;
    correctionRatePct: number | null;
    portionMapePct: number | null;
    acceptedPct: number | null;
  };
  scansByDay: DayCount[]; // last 30 days, oldest first
  weeklyCorrection: WeeklyRate[]; // last 12 weeks, oldest first
  calibration: CalibrationBucket[]; // item-level, confidence deciles
  byFeature: FeatureBreakdown[];
  topCorrectedFoods: CorrectedFoodStat[];
};

type InferenceRow = {
  feature: string;
  model: string;
  prompt_version: string | null;
  status: string | null;
  confidence: number | null;
  latency_ms: number | null;
  correction: unknown;
  user_marked_correct: boolean | null;
  corrected_at: string | null;
  created_at: string;
};

type FoodLogRow = { confidence_score: number | null; corrected_at: string | null };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); // back to Monday
  return d.toISOString().slice(0, 10);
}

const isLoggable = (r: InferenceRow): boolean => r.status === 'ok' || r.status === 'product';
const isCorrected = (r: InferenceRow): boolean => r.corrected_at != null && r.user_marked_correct !== true;

export async function getScanIntelligence(companyId: string): Promise<ScanIntelligence> {
  const svc = createServiceClient();
  const since90 = isoDaysAgo(WINDOW_DAYS);
  const since30 = isoDaysAgo(30);

  const [infRes, logRes] = await Promise.all([
    svc
      .from('ai_inferences')
      .select('feature, model, prompt_version, status, confidence, latency_ms, correction, user_marked_correct, corrected_at, created_at')
      .eq('company_id', companyId)
      .gte('created_at', `${since90}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
    svc
      .from('food_log')
      .select('confidence_score, corrected_at')
      .eq('company_id', companyId)
      .eq('source', 'photo')
      .not('confidence_score', 'is', null)
      .gte('log_date', since90)
      .limit(ROW_CAP),
  ]);

  const inferences = (infRes.data ?? []) as InferenceRow[];
  const foodLogs = (logRes.data ?? []) as FoodLogRow[];

  // --- Photo-scan slice (the moat metrics) ----------------------------------------------------
  const scans = inferences.filter((r) => r.feature === 'photo-scan' || r.feature === 'text-macro');
  const scans30 = scans.filter((r) => r.created_at >= `${since30}T00:00:00Z` && isLoggable(r));
  const corrected30 = scans30.filter(isCorrected);
  const accepted30 = scans30.filter((r) => r.user_marked_correct === true);
  const deltas30 = corrected30.flatMap((r) => parseGramDeltas(r.correction));
  const mape30 = deltas30.length
    ? Math.round((deltas30.reduce((a, d) => a + Math.abs(d.deltaPct), 0) / deltas30.length) * 10) / 10
    : null;

  // Scans per day, last 30 days (fill missing days with zero so the chart reads as a timeline).
  const byDay = new Map<string, { scans: number; corrected: number }>();
  for (let i = 29; i >= 0; i--) byDay.set(isoDaysAgo(i), { scans: 0, corrected: 0 });
  for (const r of scans30) {
    const day = r.created_at.slice(0, 10);
    const cur = byDay.get(day);
    if (!cur) continue;
    cur.scans += 1;
    if (isCorrected(r)) cur.corrected += 1;
  }
  const scansByDay: DayCount[] = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  // Weekly correction rate + portion MAPE, last 12 weeks.
  const byWeek = new Map<string, { scans: number; corrected: number; absDeltas: number[] }>();
  for (const r of scans) {
    if (!isLoggable(r)) continue;
    const wk = weekStartOf(r.created_at.slice(0, 10));
    const cur = byWeek.get(wk) ?? { scans: 0, corrected: 0, absDeltas: [] };
    cur.scans += 1;
    if (isCorrected(r)) {
      cur.corrected += 1;
      for (const d of parseGramDeltas(r.correction)) cur.absDeltas.push(Math.abs(d.deltaPct));
    }
    byWeek.set(wk, cur);
  }
  const weeklyCorrection: WeeklyRate[] = [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([weekStart, v]) => ({
      weekStart,
      scans: v.scans,
      correctionRatePct: v.scans ? Math.round((v.corrected / v.scans) * 100) : null,
      portionMapePct: v.absDeltas.length
        ? Math.round((v.absDeltas.reduce((a, b) => a + b, 0) / v.absDeltas.length) * 10) / 10
        : null,
    }));

  // Confidence calibration from item-level food_log rows: per confidence decile, % corrected.
  // Well-calibrated = corrections get rare as confidence rises.
  const buckets = Array.from({ length: 10 }, (_, i) => ({ items: 0, corrected: 0, lo: i / 10 }));
  for (const r of foodLogs) {
    const c = Number(r.confidence_score);
    if (!Number.isFinite(c)) continue;
    const idx = Math.min(9, Math.max(0, Math.floor(c * 10)));
    buckets[idx].items += 1;
    if (r.corrected_at != null) buckets[idx].corrected += 1;
  }
  const calibration: CalibrationBucket[] = buckets.map((b, i) => ({
    decile: `${i * 10}-${i * 10 + 10}`,
    items: b.items,
    correctedPct: b.items ? Math.round((b.corrected / b.items) * 100) : 0,
  }));

  // Feature x model x prompt_version breakdown over the whole window (all AI features).
  const byKey = new Map<string, { count: number; conf: number[]; lat: number[]; errors: number; feature: string; model: string; pv: string }>();
  for (const r of inferences) {
    const pv = r.prompt_version ?? 'unversioned';
    const key = `${r.feature}|${r.model}|${pv}`;
    const cur = byKey.get(key) ?? { count: 0, conf: [], lat: [], errors: 0, feature: r.feature, model: r.model, pv };
    cur.count += 1;
    if (typeof r.confidence === 'number') cur.conf.push(r.confidence);
    if (typeof r.latency_ms === 'number') cur.lat.push(r.latency_ms);
    if (r.status === 'error' || r.status === 'notConfigured') cur.errors += 1;
    byKey.set(key, cur);
  }
  const avg = (xs: number[]): number | null =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;
  const byFeature: FeatureBreakdown[] = [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .map((v) => ({
      feature: v.feature,
      model: v.model,
      promptVersion: v.pv,
      count: v.count,
      avgConfidence: avg(v.conf),
      avgLatencyMs: v.lat.length ? Math.round(v.lat.reduce((a, b) => a + b, 0) / v.lat.length) : null,
      errorPct: v.count ? Math.round((v.errors / v.count) * 100) : 0,
    }));

  // Most-corrected foods over the window (signed average direction).
  const byFood = new Map<string, { count: number; sum: number }>();
  for (const r of scans) {
    if (!isCorrected(r)) continue;
    for (const d of parseGramDeltas(r.correction)) {
      const key = d.name.toLowerCase();
      const cur = byFood.get(key) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += d.deltaPct;
      byFood.set(key, cur);
    }
  }
  const topCorrectedFoods: CorrectedFoodStat[] = [...byFood.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, v]) => ({ name, count: v.count, avgDeltaPct: Math.round((v.sum / v.count) * 10) / 10 }));

  return {
    windowDays: WINDOW_DAYS,
    totals: {
      scans30d: scans30.length,
      scansPerDay: Math.round((scans30.length / 30) * 10) / 10,
      correctionRatePct: scans30.length ? Math.round((corrected30.length / scans30.length) * 100) : null,
      portionMapePct: mape30,
      acceptedPct: scans30.length ? Math.round((accepted30.length / scans30.length) * 100) : null,
    },
    scansByDay,
    weeklyCorrection,
    calibration,
    byFeature,
    topCorrectedFoods,
  };
}
