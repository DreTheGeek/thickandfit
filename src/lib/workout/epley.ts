/**
 * Estimated one-rep max, Epley. ONE definition.
 *
 * `weight * (1 + reps / 30)` was written out three times: in the player's detectPRs, in
 * getStrength behind the Progress tab, and in getRecentPRs behind the card in the coach thread.
 * Three copies of the formula that decides what counts as a personal best, on three surfaces a
 * member can have open at the same time.
 *
 * They agreed. That is exactly why this is worth collapsing now rather than after they stop
 * agreeing: the failure mode is not a crash, it is her Progress tab calling something her best
 * while the player did not, and there is no test anywhere that compares the three.
 *
 * NO 'server-only'. The player is a client component and needs this too, which is the reason the
 * duplication happened in the first place: the two server modules could import from each other and
 * the client one could not reach either.
 *
 * Deliberately not a class, a config, or a strategy per movement. It is one line of arithmetic and
 * the value here is that there is exactly one of it.
 */

/**
 * Weighted work only. Bodyweight movements have no load to project from, so they are ranked by reps
 * instead; every caller handles that branch itself because "best" means a different thing there.
 */
export function epley1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/**
 * The margin a session has to beat a standing best by to count.
 *
 * The player used 0.5 and the two server readers used a plain `>`. Floating-point e1RM values from
 * the same lift can differ in the last decimal, so a strict comparison can call an identical set a
 * new record. Shared so the three surfaces cannot disagree about a near-tie.
 */
export const PR_EPSILON = 0.5;

/** True when `candidate` beats `best` by enough to be called a record rather than a repeat. */
export function beatsBest(candidate: number, best: number): boolean {
  return candidate > best + PR_EPSILON;
}
