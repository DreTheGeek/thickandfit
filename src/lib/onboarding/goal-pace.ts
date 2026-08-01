// Target-date pacing. PURE: no imports, no clock of its own (`now` is injected), so it is
// unit-testable (see .qa-visual/goal-pace-test.mjs).
//
// A member picks the date she wants to hit her goal weight. This works out what that actually
// demands per week and says plainly whether it is reasonable.
//
// WHY THIS IS WORTH BUILDING. A date is the single most common place fitness expectations break:
// "20 lb by the wedding in six weeks" is a real thing people decide, and an app that silently accepts
// it has agreed to something it cannot deliver. She then fails against a number WE endorsed. Saying
// "that pace is faster than I would coach, here is the date I would aim for" once, up front, is the
// whole value.
//
// The thresholds are percent of BODYWEIGHT per week, not absolute pounds. A 1 lb/week loss is gentle
// at 250 lb and aggressive at 120 lb, so a fixed pound threshold would nag a heavier member and wave
// a lighter one through.

export type PaceVerdict = 'done' | 'comfortable' | 'aggressive' | 'unrealistic' | 'past' | 'none';

export type GoalPace = {
  verdict: PaceVerdict;
  /** Required change per week to hit the date, in kg. Signed: negative = losing. */
  weeklyKg: number;
  /** Percent of current bodyweight per week. Always positive. */
  weeklyPct: number;
  weeksAvailable: number;
  /** A date we would actually stand behind, when the chosen one is too fast. ISO yyyy-mm-dd. */
  suggestedDateIso: string | null;
};

/** Up to this share of bodyweight per week is a pace worth encouraging. */
export const COMFORTABLE_PCT = 0.0075; // 0.75%/wk
/** Past this it is achievable but hard, and worth flagging honestly rather than celebrating. */
export const AGGRESSIVE_PCT = 0.0125; // 1.25%/wk
/** The pace we suggest instead when the chosen date is unrealistic. */
export const SUGGESTED_PCT = 0.006; // 0.6%/wk

const MS_PER_WEEK = 7 * 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Assess a chosen target date.
 *
 * Returns 'none' when no date is set, so the caller renders nothing rather than inventing a verdict
 * about a decision the member has not made.
 */
export function assessGoalPace(args: {
  currentKg: number;
  goalKg: number;
  targetDateIso: string | null | undefined;
  now: Date;
}): GoalPace {
  const { currentKg, goalKg, targetDateIso, now } = args;
  const none: GoalPace = { verdict: 'none', weeklyKg: 0, weeklyPct: 0, weeksAvailable: 0, suggestedDateIso: null };
  if (!targetDateIso) return none;

  const target = new Date(`${targetDateIso}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return none;
  if (!Number.isFinite(currentKg) || !Number.isFinite(goalKg) || currentKg <= 0) return none;

  const deltaKg = goalKg - currentKg;
  // Already there. Checked before the date maths so "I am at my goal" never reads as "too fast".
  if (Math.abs(deltaKg) < 0.5) {
    return { verdict: 'done', weeklyKg: 0, weeklyPct: 0, weeksAvailable: 0, suggestedDateIso: null };
  }

  const weeksAvailable = (target.getTime() - now.getTime()) / MS_PER_WEEK;
  if (weeksAvailable <= 0) {
    return { verdict: 'past', weeklyKg: 0, weeklyPct: 0, weeksAvailable: 0, suggestedDateIso: null };
  }

  const weeklyKg = deltaKg / weeksAvailable;
  const weeklyPct = Math.abs(weeklyKg) / currentKg;

  // The date we would stand behind, computed from the sustainable pace.
  const sustainableWeekly = currentKg * SUGGESTED_PCT;
  const weeksNeeded = Math.ceil(Math.abs(deltaKg) / sustainableWeekly);
  const suggested = new Date(now.getTime() + weeksNeeded * MS_PER_WEEK);

  let verdict: PaceVerdict;
  if (weeklyPct <= COMFORTABLE_PCT) verdict = 'comfortable';
  else if (weeklyPct <= AGGRESSIVE_PCT) verdict = 'aggressive';
  else verdict = 'unrealistic';

  return {
    verdict,
    weeklyKg: Math.round(weeklyKg * 100) / 100,
    weeklyPct: Math.round(weeklyPct * 10000) / 10000,
    weeksAvailable: Math.round(weeksAvailable * 10) / 10,
    // Only offered when the chosen date is not one we would endorse. Suggesting a later date to
    // someone already on a sensible pace would just undermine their own reasonable plan.
    suggestedDateIso: verdict === 'comfortable' ? null : isoDay(suggested),
  };
}

/** The earliest date worth offering in the picker: a week out. Anything sooner is not a plan. */
export function minTargetDateIso(now: Date): string {
  return isoDay(new Date(now.getTime() + MS_PER_WEEK));
}

/** Three years out. Past this a date is not a goal, it is a wish. */
export function maxTargetDateIso(now: Date): string {
  return isoDay(new Date(now.getTime() + 156 * MS_PER_WEEK));
}
