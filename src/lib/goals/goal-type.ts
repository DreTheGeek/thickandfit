// What a member is working toward. This is a framing choice, separate from the calorie-math `goal`
// (lose/maintain/gain): it decides what the You screen leads with. Server-free so the client goal
// selector can import it.
export const GOAL_TYPES = ['lose_weight', 'build_strength', 'feel_better'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export function isGoalType(v: unknown): v is GoalType {
  return typeof v === 'string' && (GOAL_TYPES as readonly string[]).includes(v);
}

/**
 * The effective goal type when the member has not chosen one. Derived from the calorie-math goal so
 * existing members get a sensible frame with no backfill. Two hard rules:
 *  - a difficult-relationship-with-food screen (gentle) is NEVER defaulted to lose_weight, and
 *  - lose_weight requires an actual target weight, so it can render its start -> current -> goal hero.
 */
export function deriveGoalType(opts: {
  goal?: 'lose' | 'maintain' | 'gain' | null;
  hasGoalWeight: boolean;
  gentle: boolean;
}): GoalType {
  if (opts.gentle) return 'feel_better';
  if (opts.goal === 'lose' && opts.hasGoalWeight) return 'lose_weight';
  if (opts.goal === 'gain') return 'build_strength';
  return 'feel_better';
}

/**
 * The type the You screen actually renders. A gentle member never gets the weight-loss hero even if
 * they picked lose_weight, matching the coach's posture; their weight goal is still tracked, just not
 * led with.
 */
export function effectiveGoalType(chosen: GoalType, gentle: boolean): GoalType {
  return gentle && chosen === 'lose_weight' ? 'feel_better' : chosen;
}

/** Options a member may pick from. lose_weight is withheld under the gentle screen. */
export function selectableGoalTypes(gentle: boolean): GoalType[] {
  return gentle ? GOAL_TYPES.filter((g) => g !== 'lose_weight') : [...GOAL_TYPES];
}
