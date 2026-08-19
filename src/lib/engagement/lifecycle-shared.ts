// The member lifecycle: tenure milestones, as pure functions.
//
// WHAT THIS CLOSES. generateOnboardingNudges fires ONCE, to members who signed up more than 12
// hours and less than 14 days ago, only if they never completed onboarding, and only if they have
// never been nudged. After that single message a member is never contacted on account of her tenure
// again. There is nothing at day 7, 14, 30, 45 or 90.
//
// The category research is unusually clear about why that matters: roughly half of the people who
// quit do so inside the first 90 days, day 7 and day 30 check-ins are the standard, and a member
// who is still training consistently at 90 days is about 3x more likely to still be there in a
// year. This product was spending its entire retention budget in the first 14 days, on one
// notification, to the one segment that had not even started.
//
// NOT THE SAME THING AS THE RE-ENGAGEMENT LADDER, and the difference is the whole design.
//   * The ladder (risk-shared.ts) fires on QUIET days. It reaches a woman who has stopped.
//   * This fires on TENURE. It reaches a woman who is still going.
// They must never both reach the same person. Telling someone who has not logged anything in three
// weeks "you have been at this a month, look what you built" is the single worst message this file
// could send: it proves nobody is looking. The generator skips anyone the sweep classifies as at
// risk, and that suppression is the reason this can be warm without being oblivious.
//
// THE GRACE WINDOW IS WHY THIS IS SAFE TO SHIP AT AN EXISTING ROSTER. A milestone fires only while
// she is inside [day, day + GRACE_DAYS). A member who is already 200 days in when this first runs
// matches nothing and hears nothing — she does not get a "congratulations on 90 days" for a
// milestone that passed months ago. Without it, first run would have emptied five milestones into
// 256 migrating members at once. The band also means a week-long cron outage does not silently skip
// a milestone forever, which is the failure a naive `=== 7` check has.

/** Tenure milestones, in days since she finished onboarding. */
export const LIFECYCLE_DAYS = [7, 14, 30, 45, 90] as const;
export type LifecycleStage = (typeof LIFECYCLE_DAYS)[number];

/**
 * How long after a milestone it can still be delivered.
 *
 * Seven, not fourteen: long enough that a week of cron failure does not lose a milestone, short
 * enough that the message is still about something that just happened. At seven the windows do not
 * overlap ([7,14) [14,21) [30,37) [45,52) [90,97)), so a member is never eligible for two at once
 * and there is no precedence rule to get wrong.
 */
export const LIFECYCLE_GRACE_DAYS = 7;

/**
 * Which milestone she is standing on, or null.
 *
 * Returns the LARGEST qualifying milestone. With a 7-day grace nothing overlaps today, so this is
 * defensive rather than load-bearing — but if someone widens the grace later, the honest answer is
 * the furthest she has actually come, not the first one she passed.
 */
export function lifecycleStage(memberAgeDays: number): LifecycleStage | null {
  let best: LifecycleStage | null = null;
  for (const day of LIFECYCLE_DAYS) {
    if (memberAgeDays >= day && memberAgeDays < day + LIFECYCLE_GRACE_DAYS) best = day;
  }
  return best;
}

/** The notification type carrying each milestone. Distinct per rung so the dedupe can tell them apart. */
export const LIFECYCLE_TYPES = {
  7: 'lifecycle_7',
  14: 'lifecycle_14',
  30: 'lifecycle_30',
  45: 'lifecycle_45',
  90: 'lifecycle_90',
} as const satisfies Record<LifecycleStage, string>;

export const LIFECYCLE_TYPE_LIST: string[] = LIFECYCLE_DAYS.map((d) => LIFECYCLE_TYPES[d]);

/** The copy key prefix for each milestone: `${key}Title` / `${key}Body` in app.notifications.copy. */
export const LIFECYCLE_COPY_KEY: Record<LifecycleStage, string> = {
  7: 'lifecycle7',
  14: 'lifecycle14',
  30: 'lifecycle30',
  45: 'lifecycle45',
  90: 'lifecycle90',
};

/** Where each milestone sends her. Every one has to be somewhere she can act, not a dead end. */
export const LIFECYCLE_LINK: Record<LifecycleStage, string> = {
  7: '/dashboard',
  14: '/dashboard',
  // Month one is the moment a photo and a weigh-in are worth the most, because there is finally a
  // before to compare against.
  30: '/progress',
  // Six weeks is where a plan written for the person she was stops fitting the person she is. The
  // useful action is telling her coach, not opening the workout list again.
  45: '/coach-chat',
  90: '/progress',
};

/** One member the lifecycle has something to say to. */
export type LifecycleCandidate = {
  profileId: string;
  stage: LifecycleStage;
};

/**
 * Which candidates still have their milestone owing.
 *
 * ONCE EVER, unlike the ladder's once-per-quiet-spell. Tenure only moves forward: there is no such
 * thing as reaching day 30 a second time, so "have we ever sent this type to this member" is the
 * correct question and the one that cannot be reopened by her going quiet and coming back.
 */
export function selectLifecycleSends(
  candidates: readonly LifecycleCandidate[],
  sentTypes: ReadonlySet<string>,
): LifecycleCandidate[] {
  return candidates.filter(
    (c) => !sentTypes.has(lifecycleHistoryKey(c.profileId, LIFECYCLE_TYPES[c.stage])),
  );
}

/** Key into the send history: one entry per member per milestone. */
export function lifecycleHistoryKey(profileId: string, type: string): string {
  return `${profileId}|${type}`;
}
