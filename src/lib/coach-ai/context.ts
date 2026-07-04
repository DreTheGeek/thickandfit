// Coach context builder. Server-only, uses the service client so it can read across the
// subscriber's own data (the route that calls this MUST itself authorize the profileId/companyId).
// Pulls profile + goal + locale, the last 14 days of food-log rollups, workout count + streak +
// missed days, the latest weight + trend, the latest user_insights payload, and the last 7 days of
// chat. Returns a structured object AND a compact bilingual text block for the system prompt.
// Pure data assembly: no AI key required, never throws (each source degrades to a neutral default).
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const KG_TO_LB = 2.20462;

export type CoachLocale = 'en' | 'es';

export type DayMacro = {
  date: string; // YYYY-MM-DD
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
};

export type WorkoutSummary = {
  total: number; // completed workouts on record
  streak: number; // consecutive recent days with a completion
  missedDays7: number; // days in the last 7 with no completion
};

export type WeightSummary = {
  latestKg: number;
  latestLb: number;
  recordedOn: string;
  trendKg: number | null; // latest minus oldest in the window (negative = lost)
  entries: number;
} | null;

export type CoachContext = {
  profile: {
    name: string;
    goal: string | null; // lose | gain | maintain | recomp | ...
    locale: CoachLocale;
    targets: { kcal: number; proteinG: number; carbG: number; fatG: number } | null;
  };
  // Migrated Lenus intake: health context the coach knows, so the AI never suggests a food they
  // cannot eat or an exercise their injury forbids.
  health: {
    goalType: string | null;
    targetWeightKg: number | null;
    injuries: string[] | null;
    dietaryExclusions: string[] | null;
    medicalConditions: string | null;
  } | null;
  // Knowledge-graph neighborhood (kg_client_facts): the relational facts the flat intake misses -
  // the foods this client actually eats most and the plan they're on. Grounds the coach in what
  // they really do, not just what they declared at intake. Null when the client isn't in the graph.
  graph: { foods: string[]; plans: string[] } | null;
  nutrition: { days: DayMacro[]; avgKcal: number | null; avgProteinG: number | null };
  workouts: WorkoutSummary;
  weight: WeightSummary;
  insights: Record<string, unknown> | null;
  recentMessages: { role: 'user' | 'assistant'; content: string; createdAt: string }[];
};

type FoodLogRow = { log_date: string; kcal: number; protein_g: number; carb_g: number; fat_g: number };
type WeightRow = { recorded_on: string; weight_kg: number };
type CompletionRow = { changed_at: string; status: string };
type MessageRow = { role: 'user' | 'assistant'; content: string; created_at: string };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Roll up raw food_log rows (one per item) into per-day macro totals, newest first.
function rollUpDays(rows: FoodLogRow[]): DayMacro[] {
  const byDay = new Map<string, DayMacro>();
  for (const r of rows) {
    const key = r.log_date;
    const cur =
      byDay.get(key) ?? { date: key, kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };
    cur.kcal += num(r.kcal);
    cur.proteinG += num(r.protein_g);
    cur.carbG += num(r.carb_g);
    cur.fatG += num(r.fat_g);
    byDay.set(key, cur);
  }
  return [...byDay.values()]
    .map((d) => ({
      date: d.date,
      kcal: Math.round(d.kcal),
      proteinG: Math.round(d.proteinG),
      carbG: Math.round(d.carbG),
      fatG: Math.round(d.fatG),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Consecutive-day completion streak ending today/yesterday, from a set of completed-day strings.
function computeStreak(completedDays: Set<string>): number {
  let streak = 0;
  // Start from today; allow the streak to "start" yesterday if today has no log yet.
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!completedDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!completedDays.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (completedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function buildCoachContext(
  profileId: string,
  _companyId: string,
): Promise<CoachContext> {
  const sb = createServiceClient();
  const since14 = isoDaysAgo(14);
  const since7 = isoDaysAgo(7);

  const [profileRes, onbRes, foodRes, weightRes, completionRes, insightRes, msgRes] =
    await Promise.all([
      sb.from('profiles').select('full_name, content_locale, ui_locale').eq('id', profileId).maybeSingle(),
      sb
        .from('onboarding_responses')
        .select('predicted_goal, computed_targets')
        .eq('profile_id', profileId)
        .maybeSingle(),
      sb
        .from('food_log')
        .select('log_date, kcal, protein_g, carb_g, fat_g')
        .eq('profile_id', profileId)
        .gte('log_date', since14),
      sb
        .from('weight_entries')
        .select('recorded_on, weight_kg')
        .eq('profile_id', profileId)
        .order('recorded_on', { ascending: false })
        .limit(30),
      sb
        .from('workout_completion_history')
        .select('changed_at, status')
        .eq('profile_id', profileId),
      sb
        .from('user_insights')
        .select('payload')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('coach_messages')
        .select('role, content, created_at')
        .eq('profile_id', profileId)
        .gte('created_at', `${since7}T00:00:00Z`)
        .order('created_at', { ascending: true })
        .limit(40),
    ]);

  // Profile + locale + goal.
  const fullName = (profileRes.data?.full_name ?? '').trim();
  const localeRaw = profileRes.data?.content_locale ?? profileRes.data?.ui_locale ?? 'en';
  const locale: CoachLocale = localeRaw === 'es' ? 'es' : 'en';
  const goal = (onbRes.data?.predicted_goal as string | null) ?? null;
  const ct = (onbRes.data?.computed_targets ?? null) as
    | { calories?: number; macros?: { protein_g?: number; carbs_g?: number; fat_g?: number } }
    | null;
  const targets = ct
    ? {
        kcal: num(ct.calories),
        proteinG: num(ct.macros?.protein_g),
        carbG: num(ct.macros?.carbs_g),
        fatG: num(ct.macros?.fat_g),
      }
    : null;

  // Nutrition rollups.
  const days = rollUpDays((foodRes.data ?? []) as FoodLogRow[]);
  const avgKcal = days.length ? Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length) : null;
  const avgProteinG = days.length
    ? Math.round(days.reduce((a, d) => a + d.proteinG, 0) / days.length)
    : null;

  // Workouts: total completed, streak, missed days in last 7.
  const completions = ((completionRes.data ?? []) as CompletionRow[]).filter(
    (c) => c.status === 'completed',
  );
  const completedDays = new Set(completions.map((c) => c.changed_at.slice(0, 10)));
  const last7 = new Set<string>();
  for (let i = 0; i < 7; i += 1) last7.add(isoDaysAgo(i));
  let missedDays7 = 0;
  for (const d of last7) if (!completedDays.has(d)) missedDays7 += 1;
  const workouts: WorkoutSummary = {
    total: completions.length,
    streak: computeStreak(completedDays),
    missedDays7,
  };

  // Weight: latest + trend across the window.
  const weightRows = (weightRes.data ?? []) as WeightRow[]; // newest first
  let weight: WeightSummary = null;
  if (weightRows.length) {
    const latest = weightRows[0];
    const oldest = weightRows[weightRows.length - 1];
    const latestKg = num(latest.weight_kg);
    weight = {
      latestKg,
      latestLb: Math.round(latestKg * KG_TO_LB * 10) / 10,
      recordedOn: latest.recorded_on,
      trendKg: weightRows.length > 1 ? Math.round((latestKg - num(oldest.weight_kg)) * 10) / 10 : null,
      entries: weightRows.length,
    };
  }

  const insights = (insightRes.data?.payload ?? null) as Record<string, unknown> | null;

  const recentMessages = ((msgRes.data ?? []) as MessageRow[]).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  // Migrated Lenus intake (joined by profile_id from client_intake). Best-effort; null when absent.
  const { data: intakeRow } = await sb
    .from('client_intake')
    .select('contact_id, goal_type, target_weight_kg, injuries, dietary_exclusions, medical_conditions')
    .eq('profile_id', profileId)
    .maybeSingle();
  const ik = intakeRow as {
    contact_id: string | null; goal_type: string | null; target_weight_kg: number | string | null;
    injuries: string[] | null; dietary_exclusions: string[] | null; medical_conditions: string | null;
  } | null;
  const health = ik
    ? {
        goalType: ik.goal_type,
        targetWeightKg: ik.target_weight_kg != null ? Number(ik.target_weight_kg) : null,
        injuries: ik.injuries,
        dietaryExclusions: ik.dietary_exclusions,
        medicalConditions: ik.medical_conditions,
      }
    : null;

  // Knowledge-graph 1-hop neighborhood for this client (foods they eat, plan they follow). Degrades
  // silently to null if the client isn't in the graph or the RPC errors - never blocks a chat.
  let graph: { foods: string[]; plans: string[] } | null = null;
  if (ik?.contact_id) {
    try {
      const { data: facts } = await sb.rpc('kg_client_facts', { p_contact: ik.contact_id });
      const rows = (facts ?? []) as { rel: string; node_type: string; label: string }[];
      const foods = rows.filter((r) => r.node_type === 'food').map((r) => r.label).slice(0, 8);
      const plans = rows.filter((r) => r.node_type === 'plan').map((r) => r.label).slice(0, 3);
      if (foods.length || plans.length) graph = { foods, plans };
    } catch (e) {
      console.warn('kg_client_facts failed (non-fatal):', e instanceof Error ? e.message : String(e));
    }
  }

  return {
    profile: { name: fullName, goal, locale, targets },
    health,
    graph,
    nutrition: { days, avgKcal, avgProteinG },
    workouts,
    weight,
    insights,
    recentMessages,
  };
}

// A compact, model-friendly text block summarizing the context. Bilingual labels follow the
// subscriber's locale so the model answers naturally in their language. Kept short to save tokens.
export function renderContextBlock(ctx: CoachContext): string {
  const es = ctx.profile.locale === 'es';
  const L = {
    member: es ? 'Miembro' : 'Member',
    goal: es ? 'Objetivo' : 'Goal',
    none: es ? 'sin definir' : 'not set',
    targets: es ? 'Metas diarias' : 'Daily targets',
    nutrition: es ? 'Nutricion (ultimos 14 dias)' : 'Nutrition (last 14 days)',
    loggedDays: es ? 'dias registrados' : 'days logged',
    avg: es ? 'promedio' : 'avg',
    noFood: es ? 'sin comidas registradas' : 'no meals logged',
    workouts: es ? 'Entrenamientos' : 'Workouts',
    total: es ? 'completados' : 'completed',
    streak: es ? 'racha' : 'streak',
    days: es ? 'dias' : 'days',
    missed: es ? 'faltados (7 dias)' : 'missed (7 days)',
    weight: es ? 'Peso' : 'Weight',
    trend: es ? 'tendencia' : 'trend',
    noWeight: es ? 'sin registros de peso' : 'no weight logged',
    insights: es ? 'Notas del entrenador' : 'Coach notes',
    protein: es ? 'proteina' : 'protein',
    plateau: es ? 'ESTANCAMIENTO' : 'PLATEAU',
    plateauNote: es
      ? 'el peso lleva {days} dias estable (cambio {delta}kg). Aborda esto de forma proactiva: valida, normaliza y sugiere un siguiente paso (refeed, recalcular metas o ajustar entreno).'
      : 'weight has been flat for {days} days (change {delta}kg). Proactively address this: validate, normalize, and suggest a next step (a refeed, recomputing targets, or adjusting training).',
  };

  const lines: string[] = [];
  lines.push(`${L.member}: ${ctx.profile.name || L.member}`);
  lines.push(`${L.goal}: ${ctx.profile.goal ?? L.none}`);
  if (ctx.profile.targets) {
    const t = ctx.profile.targets;
    lines.push(`${L.targets}: ${t.kcal} kcal, ${t.proteinG}g ${L.protein}, ${t.carbG}g carbs, ${t.fatG}g fat`);
  }

  // Migrated health context: HARD safety constraints the coach must respect in every reply.
  if (ctx.health) {
    const h = ctx.health;
    if (h.dietaryExclusions && h.dietaryExclusions.length) {
      lines.push((es ? 'NO RECOMENDAR estos alimentos (restriccion): ' : 'NEVER recommend these foods (restriction): ') + h.dietaryExclusions.join(', '));
    }
    if (h.medicalConditions) lines.push((es ? 'Condiciones medicas: ' : 'Medical conditions: ') + h.medicalConditions);
    if (h.injuries && h.injuries.length) lines.push((es ? 'Lesiones/limitaciones: ' : 'Injuries/limitations: ') + h.injuries.join(', '));
    if (h.targetWeightKg != null) lines.push((es ? 'Peso meta: ' : 'Target weight: ') + `${h.targetWeightKg}kg`);
  }

  // Knowledge-graph facts: what this client actually eats + the plan they're on. Grounds replies in
  // real behavior so the coach can reference their staples instead of generic suggestions.
  if (ctx.graph) {
    if (ctx.graph.plans.length) lines.push((es ? 'Plan asignado: ' : 'Assigned plan: ') + ctx.graph.plans.join(', '));
    if (ctx.graph.foods.length) lines.push((es ? 'Alimentos habituales (mas registrados): ' : 'Usual foods (most logged): ') + ctx.graph.foods.join(', '));
  }

  if (ctx.nutrition.days.length) {
    lines.push(
      `${L.nutrition}: ${ctx.nutrition.days.length} ${L.loggedDays}, ${L.avg} ${ctx.nutrition.avgKcal} kcal / ${ctx.nutrition.avgProteinG}g ${L.protein}`,
    );
  } else {
    lines.push(`${L.nutrition}: ${L.noFood}`);
  }

  lines.push(
    `${L.workouts}: ${ctx.workouts.total} ${L.total}, ${L.streak} ${ctx.workouts.streak} ${L.days}, ${ctx.workouts.missedDays7} ${L.missed}`,
  );

  if (ctx.weight) {
    const trend =
      ctx.weight.trendKg === null
        ? ''
        : `, ${L.trend} ${ctx.weight.trendKg > 0 ? '+' : ''}${ctx.weight.trendKg}kg`;
    lines.push(`${L.weight}: ${ctx.weight.latestLb} lb (${ctx.weight.latestKg}kg)${trend}`);
  } else {
    lines.push(`${L.weight}: ${L.noWeight}`);
  }

  // Plateau: surface it as its own prominent, instruction-bearing line so the coach addresses it
  // proactively rather than waiting for the member to bring it up. Read defensively from the payload.
  const plateau = (ctx.insights?.plateau ?? null) as
    | { status?: string; days_flat?: number; delta_kg?: number | null }
    | null;
  if (plateau?.status === 'plateau') {
    const days = String(num(plateau.days_flat));
    const delta = plateau.delta_kg === null || plateau.delta_kg === undefined ? '~0' : String(plateau.delta_kg);
    lines.push(
      `${L.plateau}: ${L.plateauNote.replace('{days}', days).replace('{delta}', delta)}`,
    );
  }

  // Scan accuracy (the corrections -> coaching loop): only when the signal is meaningful, at most
  // two lines, so the coach treats this member's scanned portions with the right skepticism.
  // Read defensively from the payload (older rows have no scan_quality).
  const sq = (ctx.insights?.scan_quality ?? null) as
    | {
        scans_30d?: number;
        correction_rate?: number;
        avg_portion_error_pct?: number | null;
        top_corrected_foods?: { name?: string; avg_delta_pct?: number }[];
      }
    | null;
  if (sq) {
    const scans = num(sq.scans_30d);
    const rate = typeof sq.correction_rate === 'number' ? sq.correction_rate : 0;
    const errPct = typeof sq.avg_portion_error_pct === 'number' ? sq.avg_portion_error_pct : null;
    const meaningful = (rate >= 0.3 && scans >= 5) || (errPct !== null && Math.abs(errPct) >= 10);
    if (meaningful) {
      const ratePct = Math.round(rate * 100);
      const dir = errPct !== null && errPct !== 0 ? (errPct > 0 ? (es ? 'hacia arriba' : 'up') : (es ? 'hacia abajo' : 'down')) : null;
      const adj = errPct !== null && dir ? ` ~${Math.abs(Math.round(errPct))}% ${dir}` : '';
      lines.push(
        es
          ? `Precision de escaneo: esta miembro ajusta ~${ratePct}% de las porciones escaneadas${adj ? `, normalmente${adj}` : ''}. Trata las porciones escaneadas como estimaciones al hablar de sus comidas.`
          : `Scan accuracy: this member adjusts ~${ratePct}% of scanned portions${adj ? `, usually${adj}` : ''}. Treat scanned portions as estimates when discussing their meals.`,
      );
      const top = (sq.top_corrected_foods ?? [])
        .filter((f) => typeof f.name === 'string' && typeof f.avg_delta_pct === 'number')
        .slice(0, 3)
        .map((f) => `${f.name} (${(f.avg_delta_pct as number) > 0 ? '+' : ''}${Math.round(f.avg_delta_pct as number)}%)`);
      if (top.length) {
        lines.push(es ? `Alimentos que suele ajustar: ${top.join(', ')}` : `Frequently adjusted foods: ${top.join(', ')}`);
      }
    }
  }

  if (ctx.insights && Object.keys(ctx.insights).length) {
    lines.push(`${L.insights}: ${JSON.stringify(ctx.insights)}`);
  }

  return lines.join('\n');
}
