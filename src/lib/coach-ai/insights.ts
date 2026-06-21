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

const apiKey = process.env.OPENROUTER_API_KEY;

// Quality tier for the nightly batch extraction (low volume, runs once a day).
const INSIGHT_MODEL = 'anthropic/claude-sonnet-4-6';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const KG_TO_LB = 2.20462;
const WINDOW_DAYS = 30;

export type CoachingFlag = {
  // A short machine-stable code (e.g. 'low_protein', 'missed_workouts', 'plateau') the UI/coach
  // can branch on, plus a one-line bilingual-neutral human note for display.
  code: string;
  note: string;
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
};

export type InsightResult =
  | { status: 'ok'; ai: boolean; payload: InsightPayload }
  | { status: 'noData' }
  | { status: 'error' };

type FoodLogRow = { log_date: string; kcal: number; protein_g: number; carb_g: number; fat_g: number };
type WeightRow = { recorded_on: string; weight_kg: number };
type CompletionRow = { changed_at: string; status: string };

export type ActiveSubscriber = { profileId: string; companyId: string; locale: 'en' | 'es'; goal: string | null; name: string };

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
    .select('id, company_id, full_name, content_locale, ui_locale')
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

function rollUp(food: FoodLogRow[], weight: WeightRow[], completions: CompletionRow[]): Rollup {
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

  const completedDays = new Set(
    completions.filter((c) => c.status === 'completed').map((c) => c.changed_at.slice(0, 10)),
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
  if (!apiKey) return null;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: INSIGHT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM },
          { role: 'user', content: buildUserPrompt(sub, roll, targets) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: Usage;
    };
    const raw = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const narrative = parseNarrative(raw);
    if (!narrative) return null;
    return { narrative, usage: json.usage ?? {} };
  } catch {
    return null;
  }
}

// Best-effort usage metering. Cost is left at 0 (OpenRouter does not return per-call cost here and
// the project has no rate card wired yet); tokens are recorded so spend can be reconstructed later.
async function logUsage(sub: ActiveSubscriber, usage: Usage): Promise<void> {
  const sb = createServiceClient();
  await sb.from('ai_usage_log').insert({
    company_id: sub.companyId,
    user_id: sub.profileId,
    feature: 'nightly-insights',
    model: INSIGHT_MODEL,
    prompt_tokens: Math.max(0, Math.round(num(usage.prompt_tokens))),
    completion_tokens: Math.max(0, Math.round(num(usage.completion_tokens))),
    cost_cents: 0,
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

// --- Per-subscriber entry point --------------------------------------------------------------
// Builds the payload for one subscriber and upserts it. Idempotent: conflicts on
// (profile_id, generated_at) replace today's row instead of stacking duplicates.
export async function generateInsightForSubscriber(sub: ActiveSubscriber): Promise<InsightResult> {
  const sb = createServiceClient();
  const since30 = isoDaysAgo(WINDOW_DAYS);

  const [foodRes, weightRes, completionRes, onbRes] = await Promise.all([
    sb.from('food_log').select('log_date, kcal, protein_g, carb_g, fat_g').eq('profile_id', sub.profileId).gte('log_date', since30),
    sb.from('weight_entries').select('recorded_on, weight_kg').eq('profile_id', sub.profileId).gte('recorded_on', since30),
    sb.from('workout_completion_history').select('changed_at, status').eq('profile_id', sub.profileId).gte('changed_at', `${since30}T00:00:00Z`),
    sb.from('onboarding_responses').select('computed_targets').eq('profile_id', sub.profileId).maybeSingle(),
  ]);

  const food = (foodRes.data ?? []) as FoodLogRow[];
  const weight = (weightRes.data ?? []) as WeightRow[];
  const completions = (completionRes.data ?? []) as CompletionRow[];

  // No signal at all: skip (do not write an empty insight row).
  if (food.length === 0 && weight.length === 0 && completions.length === 0) {
    return { status: 'noData' };
  }

  const roll = rollUp(food, weight, completions);
  const targets = onbRes.data?.computed_targets ?? null;

  const ai = await extractNarrative(sub, roll, targets);
  if (ai) void logUsage(sub, ai.usage);

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
    coaching_flags: ai?.narrative.coaching_flags ?? [],
  };

  const { error } = await sb
    .from('user_insights')
    .upsert(
      { company_id: sub.companyId, profile_id: sub.profileId, generated_at: todayUtc(), payload },
      { onConflict: 'profile_id,generated_at' },
    );
  if (error) return { status: 'error' };

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
    configured: Boolean(apiKey),
    subscribers: subs.length,
    written,
    skipped,
    errors,
  };
}
