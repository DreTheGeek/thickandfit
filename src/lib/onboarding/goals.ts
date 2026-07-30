// Primary-goal vocabulary for pre-paywall onboarding.
//
// Why a multi-select instead of the single lose/maintain/gain the calorie engine needs: Stephanie
// asked for it on the 2026-07-23 call ("what is your primary goal ... having multiple things for
// them to check off"). Real members want two things at once - lose fat AND build muscle - and
// forcing one answer throws away the signal the coach actually needs.
//
// So the member answers ONCE (multi-select), and the calorie direction is DERIVED. That keeps
// pre-paywall friction down, which is the whole point of the pre/post-paywall split.
//
// Vocabulary matches the waitlist quiz (waitlist_quiz_responses.goal) on purpose: a lead who told
// us "lose_fat" at the giveaway should not be re-taught a different word after they pay.
//
// Client-safe: no server imports, so both the wizard and the submit route can use it.

export const PRIMARY_GOALS = [
  'lose_fat',
  'build_muscle',
  'recomp',
  'strength',
  'feel_better',
  'nutrition',
] as const;

export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

/** The direction the calorie math runs. This is what prediction.ts consumes. */
export type GoalDirection = 'lose' | 'maintain' | 'gain';

/**
 * Collapse the member's selected goals into one calorie direction.
 *
 * Rules, in order:
 *   - lose_fat + build_muscle together IS recomposition -> maintain (eat at maintenance, shift
 *     composition). Picking both and getting an aggressive deficit would undercut the muscle half.
 *   - lose_fat alone -> lose.
 *   - build_muscle alone -> gain.
 *   - recomp -> maintain, explicitly.
 *   - strength / feel_better / nutrition carry no direction of their own -> maintain.
 *   - nothing selected -> maintain (the safe default; never assume someone wants a deficit).
 */
export function deriveGoalDirection(goals: readonly PrimaryGoal[]): GoalDirection {
  const wantsLoss = goals.includes('lose_fat');
  const wantsMuscle = goals.includes('build_muscle');
  if (wantsLoss && wantsMuscle) return 'maintain'; // recomposition
  if (goals.includes('recomp')) return 'maintain';
  if (wantsLoss) return 'lose';
  if (wantsMuscle) return 'gain';
  return 'maintain';
}

/** i18n key suffix per goal, so the wizard renders `app.onboarding.goal_<slug>`. */
export function goalLabelKey(goal: PrimaryGoal): string {
  return `goal_${goal}`;
}
