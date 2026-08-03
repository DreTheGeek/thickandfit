import 'server-only';
// K7 read layer: fetch the K3 user_state snapshot for a member and run the pure engine.
// Deliberately thin — one query, one call. Callers (coach chat, dashboard, K9) never touch the
// engine directly, so if the projection logic evolves it changes in ONE place.
//
// Returns null when the member has no user_state row yet (fresh signup pre-first-materialize).
// Never throws: a DB blip must not break the coach chat or dashboard render.
import { createServiceClient } from '@/lib/supabase/service';
import {
  projectGoalDate,
  assessDailyPace,
  type GoalPrediction,
  type DailyPace,
  type UserStateForPrediction,
} from '@/lib/prediction/engine';

export type MemberPrediction = {
  goal: GoalPrediction;
  pace: DailyPace;
  /** True when the underlying snapshot is more than 48h old — the coach should hedge on it. */
  stale: boolean;
};

const STALE_MS = 48 * 60 * 60 * 1000;

type UserStateRow = {
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  weight_change_kg_7d: number | null;
  weight_change_kg_30d: number | null;
  primary_goal: string | null;
  avg_kcal_30d: number | null;
  target_kcal: number | null;
  avg_protein_g_30d: number | null;
  target_protein_g: number | null;
  logging_days_30d: number | null;
  computed_at: string | null;
};

export async function getPrediction(profileId: string, companyId: string): Promise<MemberPrediction | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('user_state')
    .select(
      'current_weight_kg, goal_weight_kg, weight_change_kg_7d, weight_change_kg_30d, primary_goal, avg_kcal_30d, target_kcal, avg_protein_g_30d, target_protein_g, logging_days_30d, computed_at',
    )
    .eq('profile_id', profileId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) {
    console.error('getPrediction:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as UserStateRow;

  const input: UserStateForPrediction = {
    currentWeightKg: numOrNull(row.current_weight_kg),
    goalWeightKg: numOrNull(row.goal_weight_kg),
    weightChangeKg7d: numOrNull(row.weight_change_kg_7d),
    weightChangeKg30d: numOrNull(row.weight_change_kg_30d),
    primaryGoal: row.primary_goal,
    avgKcal30d: numOrNull(row.avg_kcal_30d),
    targetKcal: numOrNull(row.target_kcal),
    avgProteinG30d: numOrNull(row.avg_protein_g_30d),
    targetProteinG: numOrNull(row.target_protein_g),
    loggingDays30d: numOrNull(row.logging_days_30d),
  };

  const stale = row.computed_at ? Date.now() - new Date(row.computed_at).getTime() > STALE_MS : true;
  return {
    goal: projectGoalDate(input),
    pace: assessDailyPace(input),
    stale,
  };
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Render the prediction as a compact multi-line block suitable for a coach-chat system message.
 * Empty output when the projection has no signal (no goal + no pace = nothing to say). Locale-aware
 * label formatting stays in the renderer, not the engine.
 */
export function renderPredictionForPrompt(p: MemberPrediction, locale: 'en' | 'es' = 'en'): string | null {
  const lines: string[] = [];
  const L = LABELS[locale];

  if (p.goal.reason === 'ok' && p.goal.goalDateIso) {
    lines.push(`${L.projected} ${p.goal.goalDateIso} (${p.goal.weeksToGo} ${L.weeks}${p.goal.window === '7d' ? ` · ${L.fromShort}` : ''}).`);
  } else if (p.goal.reason === 'plateau' && p.goal.weeklyKg != null) {
    lines.push(`${L.plateau} (${formatRate(p.goal.weeklyKg, locale)}).`);
  } else if (p.goal.reason === 'maintaining' && p.goal.weeklyKg != null) {
    // Said out loud so the coach does not read a flat month as a stall and start troubleshooting a
    // plan that is doing exactly what it was set up to do.
    lines.push(`${L.holding} (${formatRate(p.goal.weeklyKg, locale)}).`);
  } else if (p.goal.reason === 'wrong_direction' && p.goal.weeklyKg != null) {
    lines.push(`${L.wrongDir} (${formatRate(p.goal.weeklyKg, locale)}).`);
  }

  if (p.pace.kcal !== 'unknown' || p.pace.protein !== 'unknown') {
    const parts: string[] = [];
    if (p.pace.kcal !== 'unknown') parts.push(`kcal ${p.pace.kcal.replace('_', ' ')}${p.pace.avgKcal != null && p.pace.targetKcal != null ? ` (${p.pace.avgKcal}/${p.pace.targetKcal})` : ''}`);
    if (p.pace.protein !== 'unknown') parts.push(`protein ${p.pace.protein.replace('_', ' ')}${p.pace.avgProteinG != null && p.pace.targetProteinG != null ? ` (${p.pace.avgProteinG}/${p.pace.targetProteinG}g)` : ''}`);
    lines.push(`${L.pace} — ${parts.join(', ')}${p.pace.lowConfidence ? ` (${L.lowConf})` : ''}.`);
  }

  if (lines.length === 0) return null;
  const header = p.stale ? L.headerStale : L.header;
  return [header, ...lines].join('\n');
}

type Labels = { header: string; headerStale: string; projected: string; weeks: string; fromShort: string; plateau: string; holding: string; wrongDir: string; pace: string; lowConf: string; perWeek: string };
const LABELS: Record<'en' | 'es', Labels> = {
  en: {
    header: 'PREDICTION (deterministic; use when the member asks about pace or projection):',
    headerStale: 'PREDICTION (deterministic, snapshot >48h old; hedge accordingly):',
    projected: 'Projected goal date:',
    weeks: 'weeks',
    fromShort: 'from 7d trend',
    plateau: 'Plateau (weight essentially flat in the last month)',
    holding: 'Holding steady at maintenance, which is what her plan intends (not a plateau)',
    wrongDir: 'Trend is moving away from the goal',
    pace: 'This-month pace',
    lowConf: 'low confidence, few logging days',
    perWeek: 'kg/wk',
  },
  es: {
    header: 'PREDICCIÓN (determinística; úsala si la miembro pregunta por su ritmo o proyección):',
    headerStale: 'PREDICCIÓN (determinística, más de 48h de antigüedad; sé cauta):',
    projected: 'Fecha proyectada:',
    weeks: 'semanas',
    fromShort: 'basado en 7 días',
    plateau: 'Meseta (peso prácticamente estable el último mes)',
    holding: 'Se mantiene estable en mantenimiento, que es lo que su plan busca (no es una meseta)',
    wrongDir: 'La tendencia va en contra de la meta',
    pace: 'Ritmo del mes',
    lowConf: 'baja confianza, pocos días registrados',
    perWeek: 'kg/sem',
  },
};

function formatRate(kgPerWeek: number, locale: 'en' | 'es'): string {
  const sign = kgPerWeek > 0 ? '+' : '';
  return `${sign}${kgPerWeek.toFixed(2)} ${LABELS[locale].perWeek}`;
}
