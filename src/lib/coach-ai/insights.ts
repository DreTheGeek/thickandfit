// Nightly insight engine. SERVER-ONLY.
// For one subscriber, pulls their last 30 days of food_log + workouts + weight, asks
// claude-sonnet-4-6 (via the OpenRouter pattern, same as chat.ts / photo.ts) to extract a
// structured coaching snapshot, and upserts it into user_insights (one row per profile per day,
// idempotent on (profile_id, generated_at) via the 0029 unique index).
//
// Key-gating: with no OPENROUTER_API_KEY the AI step is skipped and we persist a deterministic
// snapshot (the numbers we can compute ourselves) with ai: false, so the coach context still
// improves and the table is populated. tsc + build pass with no key; nothing throws.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { embedText, toVectorLiteral, embeddingsConfigured } from '@/lib/coach-ai/embeddings';
import { createNotification } from '@/lib/notifications/create';
import { notifText } from '@/lib/notifications/i18n';
import { AI_MODELS } from '@/lib/ai/models';
import { aiConfigured, callJson } from '@/lib/ai/client';
import { emitEvent } from '@/lib/events/emit';
import { localDay } from '@/lib/datetime/local-day';
import { fetchScanQuality, type ScanQuality } from '@/lib/coach-ai/scan-quality';
import { estimateCostCents } from '@/lib/ai/pricing';

// Cheap, reliable tier for the nightly batch extraction (runs once a day across all users).
const INSIGHT_MODEL = AI_MODELS.insights;
// Bump when EXTRACT_SYSTEM changes so replay/eval can group inferences by prompt generation.
const PROMPT_VERSION = 'insights.v1';

const KG_TO_LB = 2.20462;
const WINDOW_DAYS = 30;

// --- Plateau detection thresholds ------------------------------------------------------------
// A plateau = weight flat (|delta| < band) over a span of at least MIN_DAYS, backed by at least
// MIN_ENTRIES weigh-ins, while the member is still active (logging food or workouts). Tuned to be
// conservative so we never nag someone who is genuinely still trending.
const PLATEAU_BAND_KG = 0.5; // |newest - oldest| must be under this to count as "flat"
const PLATEAU_MIN_DAYS = 14; // the flat window must span at least this many days
const PLATEAU_MIN_ENTRIES = 4; // ...with at least this many weigh-ins inside it
const PLATEAU_LOOKBACK_DAYS = 21; // we evaluate the most recent ~3 weeks of weigh-ins
const PLATEAU_MIN_ACTIVITY = 4; // member must have >= this many logged-or-workout days recently to count as "active"

export type CoachingFlag = {
  // A short machine-stable code (e.g. 'low_protein', 'missed_workouts', 'plateau') the UI/coach
  // can branch on, plus a one-line bilingual-neutral human note for display.
  code: string;
  note: string;
};

// Deterministic weight-plateau detection result. Stored as a structured field in the payload so
// the dashboard banner + the coach context can both read it without re-deriving. status === 'plateau'
// means the member's weight has been flat (within PLATEAU_BAND_KG) over >= PLATEAU_MIN_DAYS days
// with >= PLATEAU_MIN_ENTRIES weigh-ins while still active. No AI needed; pure math over weight_entries.
export type PlateauStatus = 'none' | 'plateau';

export type PlateauInsight = {
  status: PlateauStatus;
  days_flat: number; // span in days between the oldest + newest entry in the flat window (0 when none)
  delta_kg: number | null; // newest minus oldest over the flat window (null when none)
  entries: number; // number of weigh-ins in the flat window
  // A short machine-stable suggestion code the UI/coach can branch on (e.g. 'refeed_or_recompute').
  suggestion: string | null;
};

// The open-shaped insight payload stored in user_insights.payload. buildCoachContext reads this
// JSON straight into the coach context, so keep keys stable and additive.
export type InsightPayload = {
  ai: boolean; // true when claude-sonnet produced the narrative fields; false = deterministic only
  window_days: number;
  avg_macros_7d: { kcal: number; proteinG: number; carbG: number; fatG: number } | null;
  weight_trend_7d_kg: number | null;
  weight_trend_30d_kg: number | null;
  logged_days_30d: number;
  workout_days_30d: number;
  best_pattern: string | null;
  worst_pattern: string | null;
  streak_breaker_pattern: string | null;
  on_pace: boolean | null;
  projected_goal_date: string | null; // YYYY-MM-DD or null
  coaching_flags: CoachingFlag[];
  plateau: PlateauInsight; // deterministic plateau detection (always present; status 'none' when not flat)
  scan_quality?: ScanQuality; // photo-scan correction rollup; absent below the signal floor (additive)
};

export type InsightResult =
  | { status: 'ok'; ai: boolean; payload: InsightPayload }
  | { status: 'noData' }
  | { status: 'error' };

type FoodLogRow = { log_date: string; kcal: number; protein_g: number; carb_g: number; fat_g: number };
type WeightRow = { recorded_on: string; weight_kg: number };
type CompletionRow = { changed_at: string; status: string };

export type ActiveSubscriber = { profileId: string; companyId: string; locale: 'en' | 'es'; goal: string | null; name: string; timezone: string | null };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --- Active subscriber discovery -------------------------------------------------------------
// "Active" = role 'subscriber'. The coach is subscriber-facing; free/coach/assistant/operator
// are excluded. We also pull locale + goal so the AI prompt can speak the member's language.
export async function listActiveSubscribers(): Promise<ActiveSubscriber[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('profiles')
    .select('id, company_id, full_name, content_locale, ui_locale, timezone')
    .eq('role', 'subscriber');
  if (error || !data) return [];

  // Goals live in onboarding_responses; fetch them in one pass and map by profile.
  const ids = data.map((p) => p.id as string);
  const goalById = new Map<string, string | null>();
  if (ids.length) {
    const { data: onb } = await sb
      .from('onboarding_responses')
      .select('profile_id, predicted_goal')
      .in('profile_id', ids);
    for (const r of (onb ?? []) as { profile_id: string; predicted_goal: string | null }[]) {
      goalById.set(r.profile_id, r.predicted_goal ?? null);
    }
  }

  return data.map((p) => {
    const localeRaw = (p.content_locale as string | null) ?? (p.ui_locale as string | null) ?? 'en';
    return {
      profileId: p.id as string,
      companyId: p.company_id as string,
      locale: localeRaw === 'es' ? 'es' : 'en',
      goal: goalById.get(p.id as string) ?? null,
      name: ((p.full_name as string | null) ?? '').trim(),
      timezone: (p.timezone as string | null) ?? null,
    };
  });
}

// --- Deterministic rollups (always available, no key required) -------------------------------
type Rollup = {
  days: { date: string; kcal: number; proteinG: number; carbG: number; fatG: number }[];
  avg7: InsightPayload['avg_macros_7d'];
  loggedDays30: number;
  workoutDays30: number;
  weightTrend7Kg: number | null;
  weightTrend30Kg: number | null;
  latestWeightKg: number | null;
  weightRows: WeightRow[];
};

function rollUp(food: FoodLogRow[], weight: WeightRow[], completions: CompletionRow[], tz: string | null): Rollup {
  const byDay = new Map<string, { kcal: number; proteinG: number; carbG: number; fatG: number }>();
  for (const r of food) {
    const cur = byDay.get(r.log_date) ?? { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };
    cur.kcal += num(r.kcal);
    cur.proteinG += num(r.protein_g);
    cur.carbG += num(r.carb_g);
    cur.fatG += num(r.fat_g);
    byDay.set(r.log_date, cur);
  }
  const days = [...byDay.entries()]
    .map(([date, m]) => ({
      date,
      kcal: Math.round(m.kcal),
      proteinG: Math.round(m.proteinG),
      carbG: Math.round(m.carbG),
      fatG: Math.round(m.fatG),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const last7Cut = isoDaysAgo(7);
  const last7 = days.filter((d) => d.date >= last7Cut);
  const avg7 = last7.length
    ? {
        kcal: Math.round(last7.reduce((a, d) => a + d.kcal, 0) / last7.length),
        proteinG: Math.round(last7.reduce((a, d) => a + d.proteinG, 0) / last7.length),
        carbG: Math.round(last7.reduce((a, d) => a + d.carbG, 0) / last7.length),
        fatG: Math.round(last7.reduce((a, d) => a + d.fatG, 0) / last7.length),
      }
    : null;

  // Weight trends: newest minus the closest entry at/just before the window start (negative = lost).
  const weightSorted = [...weight].sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1)); // newest first
  const latestWeightKg = weightSorted.length ? num(weightSorted[0].weight_kg) : null;
  const trendOver = (cutDays: number): number | null => {
    if (weightSorted.length < 2 || latestWeightKg === null) return null;
    const cut = isoDaysAgo(cutDays);
    // oldest entry within the window (last in newest-first order that is >= cut), else the very oldest.
    const inWindow = weightSorted.filter((w) => w.recorded_on >= cut);
    const base = inWindow.length > 1 ? inWindow[inWindow.length - 1] : weightSorted[weightSorted.length - 1];
    return Math.round((latestWeightKg - num(base.weight_kg)) * 10) / 10;
  };

  // changed_at is a timestamptz instant: bucket into the member's LOCAL day, consistent with
  // log_date/recorded_on (which already store local days). UTC slicing shifted evening workouts.
  const completedDays = new Set(
    completions.filter((c) => c.status === 'completed').map((c) => localDay(tz, new Date(c.changed_at))),
  );

  return {
    days,
    avg7,
    loggedDays30: days.length,
    workoutDays30: completedDays.size,
    weightTrend7Kg: trendOver(7),
    weightTrend30Kg: trendOver(30),
    latestWeightKg,
    weightRows: weightSorted,
  };
}

// --- Deterministic plateau detection ---------------------------------------------------------
// No AI: pure math over the rollup. Evaluates the 14-day and 21-day windows; flags a plateau when
// the most recent window is flat (|delta| < band) over >= MIN_DAYS, has >= MIN_ENTRIES weigh-ins,
// and the member is still active (>= MIN_ACTIVITY of logged days + workout days). We prefer the
// 14-day window and widen to 21 days if 14 alone lacks enough entries.
function detectPlateau(roll: Rollup): PlateauInsight {
  const none: PlateauInsight = { status: 'none', days_flat: 0, delta_kg: null, entries: 0, suggestion: null };

  // Newest-first weigh-ins, normalized to {date, kg}. rollUp already sorted weightRows newest-first.
  const entries = roll.weightRows
    .map((w) => ({ date: w.recorded_on.slice(0, 10), kg: num(w.weight_kg) }))
    .filter((w) => w.date && Number.isFinite(w.kg));
  if (entries.length < PLATEAU_MIN_ENTRIES) return none;

  // Member must still be active; a plateau on someone who stopped logging is not a coaching moment.
  const active = roll.loggedDays30 + roll.workoutDays30 >= PLATEAU_MIN_ACTIVITY;
  if (!active) return none;

  const evaluateWindow = (cutDays: number): PlateauInsight | null => {
    const cut = isoDaysAgo(cutDays);
    const inWindow = entries.filter((w) => w.date >= cut);
    if (inWindow.length < PLATEAU_MIN_ENTRIES) return null;

    const newest = inWindow[0]; // newest first
    const oldest = inWindow[inWindow.length - 1];
    const daysFlat = Math.round(
      (Date.parse(`${newest.date}T00:00:00Z`) - Date.parse(`${oldest.date}T00:00:00Z`)) / 86_400_000,
    );
    if (daysFlat < PLATEAU_MIN_DAYS) return null;

    const delta = Math.round((newest.kg - oldest.kg) * 10) / 10;
    if (Math.abs(delta) >= PLATEAU_BAND_KG) return null;

    return {
      status: 'plateau',
      days_flat: daysFlat,
      delta_kg: delta,
      entries: inWindow.length,
      suggestion: 'refeed_or_recompute',
    };
  };

  // Prefer the tighter 14-day signal; fall back to the 21-day window if 14 lacks enough entries.
  return evaluateWindow(PLATEAU_MIN_DAYS) ?? evaluateWindow(PLATEAU_LOOKBACK_DAYS) ?? none;
}

// Read the member's most recent insight snapshot from a PRIOR day and report whether it already had
// an active plateau. Used to fire the nudge only on the transition into a plateau (not every night).
// Excludes today's row (we may have already upserted it). Returns false on any error/no data.
async function wasPlateauPreviously(
  sb: ReturnType<typeof createServiceClient>,
  profileId: string,
): Promise<boolean> {
  const { data } = await sb
    .from('user_insights')
    .select('payload')
    .eq('profile_id', profileId)
    .neq('generated_at', todayUtc())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = (data?.payload ?? null) as { plateau?: { status?: string } } | null;
  return payload?.plateau?.status === 'plateau';
}

// Deliver the bilingual plateau nudge to one subscriber. Copy is static (no AI) and localized at
// send time via the notification i18n catalog, linking to the AI coach chat to discuss next steps.
async function notifyPlateau(sub: ActiveSubscriber, plateau: PlateauInsight): Promise<void> {
  await createNotification(sub.companyId, sub.profileId, {
    type: 'plateau',
    title: notifText(sub.locale, 'plateauTitle'),
    body: notifText(sub.locale, 'plateauBody', { days: String(plateau.days_flat) }),
    link: '/coach-chat',
  });
}

// --- AI narrative extraction (claude-sonnet-4-6) ---------------------------------------------
const EXTRACT_SYSTEM = [
  'You are a precise fitness-coaching analyst for a bilingual (English/Spanish) coaching app.',
  'You receive a single member\'s last 30 days of nutrition, workouts, and body-weight data, plus',
  'their goal. Extract concise, evidence-grounded coaching insights. Do not invent data: if a',
  'pattern is not supported by the numbers, return null for that field.',
  'Return ONLY minified JSON of this exact shape, no prose, no markdown fences:',
  '{"best_pattern":string|null,"worst_pattern":string|null,"streak_breaker_pattern":string|null,',
  '"on_pace":boolean|null,"projected_goal_date":string|null,',
  '"coaching_flags":[{"code":string,"note":string}]}',
  'projected_goal_date is an ISO date (YYYY-MM-DD) or null. coaching_flags codes are short snake_case',
  '(e.g. low_protein, weekend_overeat, missed_workouts, plateau, strong_adherence). Each note is one',
  'short sentence in the member\'s language. Keep coaching_flags to at most 4, most important first.',
].join('\n');

type AiNarrative = {
  best_pattern: string | null;
  worst_pattern: string | null;
  streak_breaker_pattern: string | null;
  on_pace: boolean | null;
  projected_goal_date: string | null;
  coaching_flags: CoachingFlag[];
};

type Usage = { prompt_tokens?: number; completion_tokens?: number };

function buildUserPrompt(sub: ActiveSubscriber, roll: Rollup, targets: unknown): string {
  const compactDays = roll.days
    .slice(0, 30)
    .map((d) => `${d.date}: ${d.kcal}kcal P${d.proteinG} C${d.carbG} F${d.fatG}`);
  const weightLines = roll.weightRows
    .slice(0, 30)
    .map((w) => `${w.recorded_on}: ${Math.round(num(w.weight_kg) * KG_TO_LB * 10) / 10}lb`);
  return [
    `Member goal: ${sub.goal ?? 'not set'}`,
    `Language: ${sub.locale === 'es' ? 'Spanish' : 'English'}`,
    `Daily targets: ${targets ? JSON.stringify(targets) : 'not set'}`,
    `Days logged (30d): ${roll.loggedDays30}, workout days (30d): ${roll.workoutDays30}`,
    `7d avg macros: ${roll.avg7 ? JSON.stringify(roll.avg7) : 'none'}`,
    `Weight trend 7d: ${roll.weightTrend7Kg ?? 'n/a'}kg, 30d: ${roll.weightTrend30Kg ?? 'n/a'}kg`,
    '',
    'Per-day nutrition (newest first):',
    compactDays.length ? compactDays.join('\n') : '(none)',
    '',
    'Body weight (newest first):',
    weightLines.length ? weightLines.join('\n') : '(none)',
  ].join('\n');
}

function parseNarrative(raw: string): AiNarrative | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const o = JSON.parse(cleaned) as Record<string, unknown>;
    const flagsRaw = Array.isArray(o.coaching_flags) ? o.coaching_flags : [];
    const coaching_flags: CoachingFlag[] = flagsRaw
      .map((f): CoachingFlag | null => {
        if (!f || typeof f !== 'object') return null;
        const r = f as Record<string, unknown>;
        const code = typeof r.code === 'string' ? r.code.trim() : '';
        const note = typeof r.note === 'string' ? r.note.trim() : '';
        if (!code) return null;
        return { code, note };
      })
      .filter((x): x is CoachingFlag => x !== null)
      .slice(0, 4);
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return {
      best_pattern: str(o.best_pattern),
      worst_pattern: str(o.worst_pattern),
      streak_breaker_pattern: str(o.streak_breaker_pattern),
      on_pace: typeof o.on_pace === 'boolean' ? o.on_pace : null,
      projected_goal_date: str(o.projected_goal_date),
      coaching_flags,
    };
  } catch {
    return null;
  }
}

// Calls the model. Returns the narrative + token usage, or null on any failure (caller degrades).
async function extractNarrative(
  sub: ActiveSubscriber,
  roll: Rollup,
  targets: unknown,
): Promise<{ narrative: AiNarrative; usage: Usage } | null> {
  try {
    const res = await callJson({
      models: [INSIGHT_MODEL],
      timeoutMs: 60_000,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: buildUserPrompt(sub, roll, targets) },
      ],
      // fire: batch path, the inference id has no consumer. ai_usage_log metering stays separate.
      provenance: {
        feature: 'insights',
        promptVersion: PROMPT_VERSION,
        companyId: sub.companyId,
        profileId: sub.profileId,
        mode: 'fire',
      },
    });
    if (res.status !== 'ok') return null;
    const narrative = parseNarrative(res.content);
    if (!narrative) return null;
    return {
      narrative,
      usage: { prompt_tokens: res.usage.promptTokens, completion_tokens: res.usage.completionTokens },
    };
  } catch {
    return null;
  }
}

// Best-effort usage metering. K6 (2026-07-24): cost is now computed from the model + token counts
// via src/lib/ai/pricing.ts — no more hardcoded 0. Historic rows keep their 0; new rows carry real
// cents. /admin/usage aggregation immediately becomes accurate for insights spend.
async function logUsage(sub: ActiveSubscriber, usage: Usage): Promise<void> {
  const sb = createServiceClient();
  const promptTokens = Math.max(0, Math.round(num(usage.prompt_tokens)));
  const completionTokens = Math.max(0, Math.round(num(usage.completion_tokens)));
  await sb.from('ai_usage_log').insert({
    company_id: sub.companyId,
    user_id: sub.profileId,
    feature: 'nightly-insights',
    model: INSIGHT_MODEL,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_cents: estimateCostCents(INSIGHT_MODEL, promptTokens, completionTokens) ?? 0,
  });
}

// --- Layer 3: vector memory backfill (RAG) ---------------------------------------------------
// All embedding work below is key-gated via embeddings.ts (embedText returns null when unkeyed).
// These functions are safe to call always; they no-op without an OPENROUTER_API_KEY.

const EMBED_DAYS = 7; // embed the most recent N days' summaries each night (keeps the batch small)
const EMBED_MESSAGES_PER_RUN = 40; // cap message backfill per subscriber per run

// A short, natural-language recap of one day, suitable for embedding + later human display. English
// is fine here: the embedding model is multilingual enough for retrieval, and the coach reading the
// snippet re-expresses it in the member's language. Numbers come straight from the deterministic
// rollup (never invented).
export function buildDaySummary(
  day: { date: string; kcal: number; proteinG: number; carbG: number; fatG: number },
  goal: string | null,
): string {
  const goalPart = goal ? ` Goal: ${goal}.` : '';
  return (
    `On ${day.date} the member logged ${day.kcal} kcal: ` +
    `${day.proteinG}g protein, ${day.carbG}g carbs, ${day.fatG}g fat.${goalPart}`
  );
}

type FoodLogIdRow = { id: string; log_date: string; logged_at: string };

// For one subscriber: write a day-summary + embedding onto one representative food_log row per
// recent day (the latest logged_at that day). Idempotent-ish: we only (re)embed rows whose
// log_summary is null, so re-runs do not re-spend tokens. Returns the count of days embedded.
async function embedRecentDaySummaries(
  sb: ReturnType<typeof createServiceClient>,
  sub: ActiveSubscriber,
  days: Rollup['days'],
): Promise<number> {
  if (!embeddingsConfigured() || days.length === 0) return 0;

  const sinceEmbed = isoDaysAgo(EMBED_DAYS);
  const recent = days.filter((d) => d.date >= sinceEmbed).slice(0, EMBED_DAYS);
  if (recent.length === 0) return 0;

  // Pull candidate rows (id + date) for the recent window, only those not yet summarized.
  const { data } = await sb
    .from('food_log')
    .select('id, log_date, logged_at')
    .eq('profile_id', sub.profileId)
    .gte('log_date', sinceEmbed)
    .is('log_summary', null)
    .order('logged_at', { ascending: false });
  const rows = (data ?? []) as FoodLogIdRow[];
  if (rows.length === 0) return 0;

  // One representative row per day: the first (latest logged_at) we see for each date.
  const repByDate = new Map<string, string>();
  for (const r of rows) {
    if (!repByDate.has(r.log_date)) repByDate.set(r.log_date, r.id);
  }

  let embedded = 0;
  for (const day of recent) {
    const rowId = repByDate.get(day.date);
    if (!rowId) continue;
    const summary = buildDaySummary(day, sub.goal);
    const vec = await embedText(summary);
    if (!vec) continue;
    const { error } = await sb
      .from('food_log')
      .update({ log_summary: summary, embedding: toVectorLiteral(vec) })
      .eq('id', rowId);
    if (!error) embedded += 1;
  }
  return embedded;
}

type MessageEmbedRow = { id: string; content: string };

// Backfill embeddings on this subscriber's coach_messages that lack one (capped per run). Lets the
// chat RAG recall older conversations the moment the key is added, without a one-shot mega-batch.
async function embedMissingMessages(
  sb: ReturnType<typeof createServiceClient>,
  sub: ActiveSubscriber,
): Promise<number> {
  if (!embeddingsConfigured()) return 0;

  const { data } = await sb
    .from('coach_messages')
    .select('id, content')
    .eq('profile_id', sub.profileId)
    .is('embedding', null)
    .order('created_at', { ascending: false })
    .limit(EMBED_MESSAGES_PER_RUN);
  const rows = (data ?? []) as MessageEmbedRow[];
  if (rows.length === 0) return 0;

  let embedded = 0;
  for (const r of rows) {
    const vec = await embedText(r.content);
    if (!vec) continue;
    const { error } = await sb
      .from('coach_messages')
      .update({ embedding: toVectorLiteral(vec) })
      .eq('id', r.id);
    if (!error) embedded += 1;
  }
  return embedded;
}

// --- Derived behavioral events (0063) ---------------------------------------------------------
// Deterministic signals computed nightly from the same window, emitted fire-and-forget with
// per-day natural keys (re-runs are idempotent). micronutrient_low only fires when >=50% of the
// week's logged grams carry micro data, so it activates organically as 0064-parsed foods
// accumulate and stays silent (never wrong) before that.
const MICRO_RDA_MG = {
  magnesium_mg: 310, // adult women RDAs; the audience baseline
  potassium_mg: 2600,
  iron_mg: 18,
  calcium_mg: 1000,
} as const;
type MicroCol = keyof typeof MICRO_RDA_MG;
type MicroFoodRow = { grams: number | null; foods: Record<MicroCol, number | null> | null };

async function emitDerivedNutritionEvents(
  sb: ReturnType<typeof createServiceClient>,
  sub: ActiveSubscriber,
  roll: Rollup,
  targets: unknown,
): Promise<void> {
  try {
    // protein_goal_hit: the 7d average meets the member's computed onboarding target.
    const t = targets as { macros?: { protein_g?: number } } | null;
    const proteinTarget = typeof t?.macros?.protein_g === 'number' ? t.macros.protein_g : null;
    if (proteinTarget && proteinTarget > 0 && roll.avg7 && roll.avg7.proteinG >= proteinTarget) {
      emitEvent({
        companyId: sub.companyId,
        profileId: sub.profileId,
        type: 'protein_goal_hit',
        aggregateType: 'user_insight',
        idempotencyKey: `protein_goal_hit:${sub.profileId}:${todayUtc()}`,
        source: 'cron',
        payload: { avg_protein_7d: roll.avg7.proteinG, target_g: proteinTarget },
      });
    }

    // micronutrient_low: 7d average intake under 70% RDA for the deficiency set, computed from
    // food_log grams x the food's per-100g micros (0064 columns).
    const { data } = await sb
      .from('food_log')
      .select('grams, foods(magnesium_mg, potassium_mg, iron_mg, calcium_mg)')
      .eq('profile_id', sub.profileId)
      .gte('log_date', isoDaysAgo(7))
      .limit(400);
    const rows = (data ?? []) as unknown as MicroFoodRow[];
    if (!rows.length) return;
    let totalGrams = 0;
    let coveredGrams = 0;
    const totals: Record<MicroCol, number> = { magnesium_mg: 0, potassium_mg: 0, iron_mg: 0, calcium_mg: 0 };
    for (const r of rows) {
      const g = num(r.grams);
      if (g <= 0) continue;
      totalGrams += g;
      const f = r.foods;
      if (!f || Object.values(f).every((v) => v == null)) continue;
      coveredGrams += g;
      for (const col of Object.keys(totals) as MicroCol[]) {
        const per100 = f[col];
        if (typeof per100 === 'number' && Number.isFinite(per100)) totals[col] += (g / 100) * per100;
      }
    }
    if (totalGrams <= 0 || coveredGrams / totalGrams < 0.5) return; // not enough micro coverage yet
    // One event max per night: the nutrient furthest below its RDA (under the 70% line).
    let worst: { col: MicroCol; ratio: number } | null = null;
    for (const col of Object.keys(totals) as MicroCol[]) {
      const ratio = totals[col] / 7 / MICRO_RDA_MG[col];
      if (ratio < 0.7 && (!worst || ratio < worst.ratio)) worst = { col, ratio };
    }
    if (worst) {
      emitEvent({
        companyId: sub.companyId,
        profileId: sub.profileId,
        type: 'micronutrient_low',
        aggregateType: 'user_insight',
        idempotencyKey: `micronutrient_low:${sub.profileId}:${worst.col}:${todayUtc()}`,
        source: 'cron',
        payload: {
          nutrient: worst.col,
          avg_daily_mg: Math.round((totals[worst.col] / 7) * 10) / 10,
          rda_mg: MICRO_RDA_MG[worst.col],
          coverage_pct: Math.round((coveredGrams / totalGrams) * 100),
        },
      });
    }
  } catch (e) {
    // Derived telemetry must never fail the insight write.
    console.error('emitDerivedNutritionEvents:', e instanceof Error ? e.message : String(e));
  }
}

// --- Per-subscriber entry point --------------------------------------------------------------
// Builds the payload for one subscriber and upserts it. Idempotent: conflicts on
// (profile_id, generated_at) replace today's row instead of stacking duplicates.
export async function generateInsightForSubscriber(sub: ActiveSubscriber): Promise<InsightResult> {
  const sb = createServiceClient();
  const since30 = isoDaysAgo(WINDOW_DAYS);

  const [foodRes, weightRes, completionRes, onbRes, scanQuality] = await Promise.all([
    sb.from('food_log').select('log_date, kcal, protein_g, carb_g, fat_g').eq('profile_id', sub.profileId).gte('log_date', since30),
    sb.from('weight_entries').select('recorded_on, weight_kg').eq('profile_id', sub.profileId).gte('recorded_on', since30),
    sb.from('workout_completion_history').select('changed_at, status').eq('profile_id', sub.profileId).gte('changed_at', `${since30}T00:00:00Z`),
    sb.from('onboarding_responses').select('computed_targets').eq('profile_id', sub.profileId).maybeSingle(),
    // Photo-scan correction rollup (one indexed query; null below the signal floor, never throws).
    fetchScanQuality(sb, sub.profileId, since30),
  ]);

  const food = (foodRes.data ?? []) as FoodLogRow[];
  const weight = (weightRes.data ?? []) as WeightRow[];
  const completions = (completionRes.data ?? []) as CompletionRow[];

  // No signal at all: skip (do not write an empty insight row).
  if (food.length === 0 && weight.length === 0 && completions.length === 0) {
    return { status: 'noData' };
  }

  const roll = rollUp(food, weight, completions, sub.timezone);
  const targets = onbRes.data?.computed_targets ?? null;

  // Deterministic plateau detection (no AI). Computed before the AI call so it is always present.
  const plateau = detectPlateau(roll);

  const ai = await extractNarrative(sub, roll, targets);
  if (ai) void logUsage(sub, ai.usage);

  // Merge a deterministic 'plateau' coaching_flag into whatever the AI returned (de-duped by code),
  // so the coach context surfaces it even when the AI step is skipped/unkeyed.
  const aiFlags = ai?.narrative.coaching_flags ?? [];
  const coaching_flags: CoachingFlag[] =
    plateau.status === 'plateau' && !aiFlags.some((f) => f.code === 'plateau')
      ? [
          {
            code: 'plateau',
            note:
              sub.locale === 'es'
                ? `Peso estable (${plateau.days_flat} dias). Considera un refeed o recalcular metas.`
                : `Weight flat for ${plateau.days_flat} days. Consider a refeed or recomputing targets.`,
          },
          ...aiFlags,
        ].slice(0, 4)
      : aiFlags;

  const payload: InsightPayload = {
    ai: Boolean(ai),
    window_days: WINDOW_DAYS,
    avg_macros_7d: roll.avg7,
    weight_trend_7d_kg: roll.weightTrend7Kg,
    weight_trend_30d_kg: roll.weightTrend30Kg,
    logged_days_30d: roll.loggedDays30,
    workout_days_30d: roll.workoutDays30,
    best_pattern: ai?.narrative.best_pattern ?? null,
    worst_pattern: ai?.narrative.worst_pattern ?? null,
    streak_breaker_pattern: ai?.narrative.streak_breaker_pattern ?? null,
    on_pace: ai?.narrative.on_pace ?? null,
    projected_goal_date: ai?.narrative.projected_goal_date ?? null,
    coaching_flags,
    plateau,
    ...(scanQuality ? { scan_quality: scanQuality } : {}),
  };

  // Was the member already in a plateau as of their previous snapshot? If so this is not "newly
  // detected" and we must not re-nudge them every night. We read the most recent OTHER row.
  const wasPlateau = await wasPlateauPreviously(sb, sub.profileId);

  const { error } = await sb
    .from('user_insights')
    .upsert(
      { company_id: sub.companyId, profile_id: sub.profileId, generated_at: todayUtc(), payload },
      { onConflict: 'profile_id,generated_at' },
    );
  if (error) return { status: 'error' };

  // Behavioral events (fire-and-forget; natural keys make nightly re-runs idempotent per day).
  emitEvent({
    companyId: sub.companyId,
    profileId: sub.profileId,
    type: 'insight_generated',
    aggregateType: 'user_insight',
    idempotencyKey: `insight_generated:${sub.profileId}:${todayUtc()}`,
    source: 'cron',
    payload: {
      generated_at: todayUtc(),
      ai: payload.ai,
      plateau: plateau.status,
      flags: coaching_flags.length,
    },
  });
  void emitDerivedNutritionEvents(sb, sub, roll, targets);

  // Newly-detected plateau -> one encouraging bilingual nudge linking to the coach chat. Best-effort:
  // a notification failure must not fail the insight write (already persisted above).
  if (plateau.status === 'plateau' && !wasPlateau) {
    try {
      await notifyPlateau(sub, plateau);
    } catch {
      // Nudge is best-effort enrichment; the insight is already saved.
    }
  }

  // Layer 3 RAG: embed recent day summaries + backfill message embeddings. Fully key-gated (no-op
  // without OPENROUTER_API_KEY); failures here must not fail the insight write, so they are isolated.
  try {
    await embedRecentDaySummaries(sb, sub, roll.days);
    await embedMissingMessages(sb, sub);
  } catch {
    // Embedding is best-effort enrichment; the insight row is already persisted above.
  }

  return { status: 'ok', ai: Boolean(ai), payload };
}

// --- Batch entry point (the cron calls this) -------------------------------------------------
export type BatchResult = {
  ok: boolean;
  configured: boolean; // whether the AI key was present (narrative fields populated)
  subscribers: number;
  written: number; // insight rows upserted
  skipped: number; // subscribers with no data in the window
  errors: number;
};

export async function generateAllInsights(): Promise<BatchResult> {
  const subs = await listActiveSubscribers();
  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const sub of subs) {
    try {
      const r = await generateInsightForSubscriber(sub);
      if (r.status === 'ok') written += 1;
      else if (r.status === 'noData') skipped += 1;
      else errors += 1;
    } catch {
      errors += 1;
    }
  }

  return {
    ok: errors === 0,
    configured: aiConfigured(),
    subscribers: subs.length,
    written,
    skipped,
    errors,
  };
}
