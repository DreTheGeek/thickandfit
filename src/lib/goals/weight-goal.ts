/**
 * Start, current, goal and percent toward it. ONE definition.
 *
 * The handoff shows this number twice: as "Transformation status 64%" on Today and as "You're 64%
 * to your goal" at the foot of Progress. It was computed inline in dashboard/page.tsx and nowhere
 * else, so wiring Progress meant either importing from a page module or writing the arithmetic a
 * second time. Two copies of a figure that must agree between two screens is a defect with a date
 * on it, not a style preference.
 *
 * DIRECTIONAL, and that is the part worth not re-deriving. An earlier version used abs(), so a
 * member moving AWAY from her goal filled the bar in the same direction as one moving toward it.
 * Only movement toward the goal counts, and the result is clamped, so a member who overshoots reads
 * 100 rather than 130.
 *
 * Works in either direction: a goal below the start (losing) and a goal above it (gaining) both
 * produce a bar that fills as she approaches.
 */

export const KG_TO_LB = 2.20462;

export type WeightGoal = {
  startLb: number;
  currentLb: number;
  goalLb: number;
  /** 0-100, movement toward the goal only. */
  pct: number;
};

export function weightGoalFromKg(
  startKg: number | null | undefined,
  goalKg: number | null | undefined,
  currentKg: number | null | undefined,
): WeightGoal | null {
  if (!startKg || !goalKg) return null;
  const startLb = Math.round(startKg * KG_TO_LB);
  const goalLb = Math.round(goalKg * KG_TO_LB);
  // No logged weight yet means she is still at her starting point, not at zero.
  const currentLb = currentKg ? Math.round(currentKg * KG_TO_LB) : startLb;
  // A start equal to the goal would divide by zero; it also means she is already there.
  const span = Math.abs(startLb - goalLb) || 1;
  const toward = (currentLb - startLb) * Math.sign(goalLb - startLb);
  const pct = Math.max(0, Math.min(100, Math.round((toward / span) * 100)));
  return { startLb, currentLb, goalLb, pct };
}
