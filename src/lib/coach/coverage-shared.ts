// Who is actually responsible for a member today: the pure part.
//
// Two facts, resolved into one answer. `profiles.assigned_coach_id` says who owns her; a row in
// `coach_coverage` says one coach is standing in for another between two dates. This resolves the
// pair, and it is separated from the queries for the usual reason — the date arithmetic and the
// chain rules are where this goes wrong, and they can be asserted here without a database.
//
// THE FAILURE MODE IS NOBODY. Every rule below leans the same way: when the answer is unclear,
// return a person rather than null. A queue with nobody on it is precisely the outage this feature
// exists to prevent, and it is indistinguishable from an empty queue on the screen.

/** One coverage arrangement. Dates are inclusive ISO days: ends_on is the last day away. */
export type Coverage = {
  coachId: string;
  coveringCoachId: string;
  startsOn: string;
  endsOn: string;
};

/**
 * How many hand-offs to follow.
 *
 * A covers for B who is also away and covered by C is real — two coaches on holiday in the same
 * week is a normal August. Four is well past any rota this business will have, and the cap exists
 * to bound a cycle, not to model a depth anyone will reach.
 */
export const MAX_COVERAGE_HOPS = 4;

/** Is this arrangement in force on `today`? Both ends inclusive. */
export function isCoverageActive(c: Coverage, today: string): boolean {
  return c.startsOn <= today && today <= c.endsOn;
}

/**
 * Follow the coverage chain from `coachId` to whoever is actually holding her work today.
 *
 * Returns the ORIGINAL coach when the chain loops or runs past MAX_COVERAGE_HOPS. That is
 * deliberate and it is the important line in this file: A covers B and B covers A is a data-entry
 * mistake somebody will make, and the two available answers are "the person who owns her" and
 * "nobody". Handing the work back to the assigned coach means a queue that is wrong; returning null
 * means a queue that is empty, and nobody investigates an empty queue.
 *
 * A null coachId (nobody assigned — the default, and the state all 256 migrating members are in)
 * stays null. There is no chain to follow, and the company owns her.
 */
export function effectiveCoach(
  coachId: string | null,
  coverages: readonly Coverage[],
  today: string,
): string | null {
  if (coachId === null) return null;
  const active = new Map<string, string>();
  for (const c of coverages) {
    // First active arrangement per coach wins. Overlapping rows for one coach are a mistake the UI
    // should prevent; picking deterministically here means the queue does not change between two
    // loads of the same screen while somebody sorts it out.
    if (isCoverageActive(c, today) && !active.has(c.coachId)) active.set(c.coachId, c.coveringCoachId);
  }

  const seen = new Set<string>([coachId]);
  let current = coachId;
  // <= the cap, not <. A chain of exactly MAX_COVERAGE_HOPS hand-offs has RESOLVED, and the extra
  // iteration is what notices that — the first version ran the right number of hops and then threw
  // the answer away, handing a correctly-covered member back to the coach who is on a plane.
  for (let hop = 0; hop <= MAX_COVERAGE_HOPS; hop += 1) {
    const next = active.get(current);
    if (next === undefined) return current; // the chain ended here; this is who holds her
    if (hop === MAX_COVERAGE_HOPS) break; // one more hand-off would pass the cap
    if (seen.has(next)) return coachId; // a cycle: hand it back to the owner, never to nobody
    seen.add(next);
    current = next;
  }
  return coachId; // ran past the cap: same reasoning as the cycle
}

/**
 * Is this member on `viewerId`'s plate right now?
 *
 * Used by the "mine" filter on every coach queue. An unassigned member belongs to the company, so
 * she is NOT anybody's in particular — the queue default is "everyone" precisely because filtering
 * to "mine" on a roster where nothing is assigned yet shows an empty console.
 */
export function isMine(
  assignedCoachId: string | null,
  viewerId: string,
  coverages: readonly Coverage[],
  today: string,
): boolean {
  return effectiveCoach(assignedCoachId, coverages, today) === viewerId;
}

/**
 * The coaches whose work `viewerId` is currently holding, excluding themselves.
 *
 * For the banner: "You are covering for Dani until the 20th." Somebody who has quietly inherited
 * another coach's roster needs to be told, or the queue simply appears to have grown.
 */
export function coveringFor(
  viewerId: string,
  coverages: readonly Coverage[],
  today: string,
): string[] {
  const out: string[] = [];
  for (const c of coverages) {
    if (!isCoverageActive(c, today)) continue;
    if (c.coveringCoachId !== viewerId) continue;
    if (c.coachId === viewerId) continue;
    if (!out.includes(c.coachId)) out.push(c.coachId);
  }
  return out;
}

/** Is this coach away today — i.e. has she handed her work to someone else? */
export function isAway(coachId: string, coverages: readonly Coverage[], today: string): boolean {
  return coverages.some((c) => c.coachId === coachId && isCoverageActive(c, today));
}
