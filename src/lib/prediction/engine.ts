// K7 prediction engine v1 — deterministic projections from the K3 user_state snapshot.
//
// Two outputs per member:
//   * goal date: when does this member hit their goal_weight_kg at current pace?
//   * today's pace: are they on-track vs behind for calories and protein this window?
//
// No AI call. Pure math over structured columns; runs anywhere (server components, edge, tests).
// Fed downstream by the coach chat prompt (via buildCoachContext) + the dashboard hero + K9.
//
// Design rules kept tight:
//   - Trend prefers 30-day (more stable) but falls back to 7d when the 30d datapoint is missing.
//   - "wrong-direction" is a first-class outcome: a fat-loss goal with a positive trend is NOT
//     the same as a plateau. Coach language should differ, so the engine names it explicitly.
//   - Plateau band = ±0.15 kg/week — anything inside is "flat" (any smaller shows as noise week
//     to week). Matches the plateau band used by the nightly insight engine (0.5 kg / 14 days
//     ≈ 0.25 kg/wk); a bit tighter here because we sit closer to the daily surface.
//   - MAX_PROJECTION_WEEKS caps the wall clock; a plateau projected to hit a goal in 40 years
//     reads as null (unknown) rather than a nonsense date.

const KG_PER_LB = 0.453592;
const PLATEAU_WEEKLY_KG = 0.15;
const MAX_PROJECTION_WEEKS = 52; // over a year is not a useful projection; return null

export type Direction = 'losing' | 'gaining' | 'flat' | 'wrong-direction';

export type GoalPrediction = {
  /** ISO date (yyyy-mm-dd, UTC) the member is on pace to hit goal. null when unknown/plateau/too-far-out. */
  goalDateIso: string | null;
  /** Weeks to goal at current pace; null when unknown. */
  weeksToGo: number | null;
  /** Direction of the trend in the goal's frame. 'wrong-direction' fires when trend fights the goal. */
  direction: Direction;
  /** Signed weekly kg change actually observed. 30d-preferred, 7d fallback. null when no data. */
  weeklyKg: number | null;
  /** Which window fed the projection ('30d' preferred). null when neither was available. */
  window: '30d' | '7d' | null;
  /** Human-readable why-null when goalDateIso is null (for the UI + coach-chat renderer). */
  reason: 'ok' | 'no_trend' | 'no_goal' | 'plateau' | 'wrong_direction' | 'too_far_out';
};

export type PaceStatus = 'ahead' | 'on_pace' | 'behind' | 'unknown';

export type DailyPace = {
  /** kcal adherence status this window. */
  kcal: PaceStatus;
  /** protein adherence status this window. */
  protein: PaceStatus;
  /** Actual avg / target for the display. */
  avgKcal: number | null;
  targetKcal: number | null;
  avgProteinG: number | null;
  targetProteinG: number | null;
  /** True when logging days < 5 in the last 30 — pace verdicts are noisy under that. */
  lowConfidence: boolean;
};

export type UserStateForPrediction = {
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  weightChangeKg7d: number | null;
  weightChangeKg30d: number | null;
  primaryGoal: string | null; // 'lose' | 'maintain' | 'gain' | ...
  avgKcal30d: number | null;
  targetKcal: number | null;
  avgProteinG30d: number | null;
  targetProteinG: number | null;
  loggingDays30d: number | null;
};

/**
 * Project the goal date. Returns a resolved date only when there IS a real trend in the goal's
 * direction; every other outcome carries a `reason` so the caller can render the right message.
 */
export function projectGoalDate(s: UserStateForPrediction): GoalPrediction {
  if (s.currentWeightKg == null || s.goalWeightKg == null) {
    return baseGoal({ reason: 'no_goal', direction: 'flat', weeklyKg: null, window: null });
  }

  // Prefer 30d trend (windowed). If null, fall back to 7d (fresh but noisy).
  let weeklyKg: number | null = null;
  let window: '30d' | '7d' | null = null;
  if (s.weightChangeKg30d != null) {
    weeklyKg = (Number(s.weightChangeKg30d) / 30) * 7;
    window = '30d';
  } else if (s.weightChangeKg7d != null) {
    weeklyKg = Number(s.weightChangeKg7d); // already a 7d delta ≈ per-week rate
    window = '7d';
  } else {
    return baseGoal({ reason: 'no_trend', direction: 'flat', weeklyKg: null, window: null });
  }

  const remainingKg = Number(s.goalWeightKg) - Number(s.currentWeightKg); // negative = need to LOSE
  const goalIsLose = remainingKg < 0;
  const direction = classifyDirection(weeklyKg, goalIsLose);

  if (direction === 'flat') {
    return baseGoal({ reason: 'plateau', direction, weeklyKg, window });
  }
  if (direction === 'wrong-direction') {
    return baseGoal({ reason: 'wrong_direction', direction, weeklyKg, window });
  }

  // Same direction as the goal: extrapolate.
  const weeksToGo = Math.abs(remainingKg / weeklyKg);
  if (!Number.isFinite(weeksToGo) || weeksToGo > MAX_PROJECTION_WEEKS) {
    return baseGoal({ reason: 'too_far_out', direction, weeklyKg, window, weeksToGo: null });
  }
  const goalDateIso = addWeeksIso(new Date(), weeksToGo);
  return {
    goalDateIso,
    weeksToGo: Math.round(weeksToGo * 10) / 10,
    direction,
    weeklyKg: Math.round(weeklyKg * 100) / 100,
    window,
    reason: 'ok',
  };
}

function baseGoal(p: {
  reason: GoalPrediction['reason'];
  direction: Direction;
  weeklyKg: number | null;
  window: '30d' | '7d' | null;
  weeksToGo?: number | null;
}): GoalPrediction {
  return {
    goalDateIso: null,
    weeksToGo: p.weeksToGo ?? null,
    direction: p.direction,
    weeklyKg: p.weeklyKg == null ? null : Math.round(p.weeklyKg * 100) / 100,
    window: p.window,
    reason: p.reason,
  };
}

function classifyDirection(weeklyKg: number, goalIsLose: boolean): Direction {
  if (Math.abs(weeklyKg) < PLATEAU_WEEKLY_KG) return 'flat';
  const losing = weeklyKg < 0;
  if (goalIsLose && losing) return 'losing';
  if (!goalIsLose && !losing) return 'gaining';
  return 'wrong-direction';
}

/**
 * Assess today's pace on calories + protein. Rolling 30d adherence sets the frame:
 *   * within ±10 pp of target → on_pace
 *   * more than 10 pp under → behind
 *   * more than 10 pp over  → ahead (matters more for kcal on a fat-loss goal; caller frames)
 * Low logging days (<5) flips lowConfidence so the coach can hedge.
 */
export function assessDailyPace(s: UserStateForPrediction): DailyPace {
  const kcal = paceFromAvg(s.avgKcal30d, s.targetKcal);
  const protein = paceFromAvg(s.avgProteinG30d, s.targetProteinG);
  return {
    kcal,
    protein,
    avgKcal: numOrNull(s.avgKcal30d),
    targetKcal: numOrNull(s.targetKcal),
    avgProteinG: numOrNull(s.avgProteinG30d),
    targetProteinG: numOrNull(s.targetProteinG),
    lowConfidence: (s.loggingDays30d ?? 0) < 5,
  };
}

function paceFromAvg(avg: number | null, target: number | null): PaceStatus {
  if (avg == null || target == null || target <= 0) return 'unknown';
  const pct = (Number(avg) / Number(target)) * 100;
  if (pct >= 110) return 'ahead';
  if (pct >= 90) return 'on_pace';
  return 'behind';
}

function numOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function addWeeksIso(base: Date, weeks: number): string {
  const ms = base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Small display helpers kept in the engine for reuse across coach chat + dashboard renderers.
export function kgToLb(kg: number | null): number | null {
  return kg == null ? null : Math.round((Number(kg) / KG_PER_LB) * 10) / 10;
}
