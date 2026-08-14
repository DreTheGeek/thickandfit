// Plan-expiry arithmetic: the pure part.
//
// Split out of plan-followups.ts (which imports `server-only`) so .qa-visual/plan-expiry-test.mts
// asserts the REAL functions rather than a copy of them. A test that re-implements the maths it is
// testing passes forever, including after the maths changes.
//
// Small on purpose. The queries are the boring half; these three functions are where an off-by-one
// silently turns "a week before the 12-week mark" into "the day after it ended".

const DAY = 86_400_000;

/** ISO day a plan runs out: its assignment instant plus its own length in weeks. */
export function planEndsOn(assignedAt: string, weeks: number): string | null {
  const started = Date.parse(assignedAt);
  // plans.weeks is NOT NULL with a default of 4, so 0 or a negative is corruption rather than an
  // open-ended plan. Null rather than a guessed date: a bogus end date on a coach's queue is worse
  // than no reminder, because she acts on it.
  if (!Number.isFinite(started) || !Number.isFinite(weeks) || weeks <= 0) return null;
  return new Date(started + weeks * 7 * DAY).toISOString().slice(0, 10);
}

/** Whole days from today to an ISO day, in UTC. Negative once the date has passed. */
export function daysUntil(iso: string, at: Date = new Date()): number {
  const target = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${at.toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(target)) return 0;
  return Math.round((target - today) / DAY);
}

/**
 * Is this plan inside the coach's follow-up window?
 *
 * INCLUDES ALREADY-EXPIRED PLANS, which a naive "ends within N days" filter drops. Dropping them
 * hides the exact case the reminder exists to prevent: a woman training week 13 of a finished
 * 12-week program, still paying, with nobody aware.
 *
 * A null window is 'none' — the coach's real answer that she wants no reminder, never a default.
 */
export function isInFollowUpWindow(daysLeft: number, windowDays: number | null): boolean {
  return windowDays !== null && daysLeft <= windowDays;
}
