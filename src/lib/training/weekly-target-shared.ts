/**
 * "2 of 3 workouts this week."
 *
 * WHY THIS AND NOT A STREAK. MyFitnessPal frames its logging goal as "Log 4 days per week - spot
 * patterns, without perfection", and that framing is worth taking, but the tension it implies with
 * this app's streak turned out not to exist. The streak here counts an ANY-ACTIVITY union: workout
 * days OR food-logging days OR weigh-in days (gamification/engine.ts). A member who trains three
 * times and logs breakfast daily holds it comfortably. It is a LOGGING streak wearing the word
 * "Day streak", and logging genuinely is a daily act, so a daily ladder is right for it.
 *
 * Training is not a daily act. By her own answer it happens 3, 4 or 5 days out of 7, so there has
 * never been anything on any screen that could tell a member following her programme correctly that
 * she is on track. That is the gap this fills, and it is why the two sit beside each other rather
 * than replacing one another. Nothing about user_streaks changes.
 *
 * Pure and free of `server-only` so the boundaries can be exercised without a Next runtime, same
 * split as match-starter-shared.ts, risk-shared.ts and status-shared.ts.
 */

export type WeeklyTargetSource = 'answer' | 'plan';

export type WeeklyTarget = {
  /** Distinct local days she trained in the current week. */
  done: number;
  /** Her answer, or her plan's days_per_week. Null when neither exists. */
  target: number | null;
  source: WeeklyTargetSource | null;
  /** The ISO days she trained this week, oldest first. */
  days: string[];
  weekStart: string;
  /** Days remaining in the week, INCLUDING today. 7 on a Sunday. */
  daysLeft: number;
  met: boolean;
  /**
   * 'target' renders "2 of 3 this week". 'count' renders "2 workouts this week", with no
   * denominator and no meter.
   *
   * NEVER FABRICATE A DENOMINATOR. This is the same rule Today already follows for steps, where an
   * unknown count refuses to render as "0 / 10,000": an unknown is not a zero, and a target she has
   * never set is not a target she is failing. Every migrated Lenus member lands in 'count' on day
   * one, and a count that is true beats a bar sitting at 0%.
   */
  mode: 'target' | 'count';
};

/**
 * @param workoutDays local ISO days she trained, any window; filtered to this week here.
 * @param today       her local day, YYYY-MM-DD.
 * @param weekStart   the Sunday that starts her local week, YYYY-MM-DD.
 */
export function weeklyTargetFrom(
  workoutDays: readonly string[],
  today: string,
  weekStart: string,
  target: number | null,
  source: WeeklyTargetSource | null,
): WeeklyTarget {
  // String comparison is safe and correct on YYYY-MM-DD, and avoids re-parsing dates that were
  // already resolved in her timezone upstream. `<= today` matters: a day in the FUTURE of her local
  // week cannot have been trained, and letting one through would be a count she could not explain.
  const days = [...new Set(workoutDays)].filter((d) => d >= weekStart && d <= today).sort();
  const done = days.length;

  // Sunday = 0 days elapsed, so 7 left. Derived from the two ISO strings rather than from a second
  // clock read, so this function stays pure and cannot disagree with the caller about what day it is.
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000);
  const daysLeft = Math.max(0, 7 - elapsed);

  const usable = target != null && target > 0 ? target : null;
  return {
    done,
    target: usable,
    source: usable ? source : null,
    days,
    weekStart,
    daysLeft,
    // Over-hitting is still met, not 133%. She trained more than she planned; that is a good week,
    // not an error state.
    met: usable != null && done >= usable,
    mode: usable != null ? 'target' : 'count',
  };
}
