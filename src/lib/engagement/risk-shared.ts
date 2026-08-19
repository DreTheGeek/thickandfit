// Engagement risk: the pure part. No imports, no `server-only`, no database — so the thresholds,
// which ARE the feature, can be tested without one (npx tsx .qa-visual/engagement-risk-test.mts).
//
// WHAT THIS IS FOR. Everything this app currently calls "at risk" is billing: `isAtRisk` in
// coach/overview.ts reads subscription status and billing_health, and the coach home tile, the
// attention chip and the 9pm recap all read that one definition. Billing risk fires when the card
// fails, which is the LAST event in a churn, not the first. By then she decided weeks ago.
//
// The industry numbers on the earlier signal are not subtle:
//   * ~50% of the people who quit a gym do it inside 90 days.
//   * A member with fewer than 4 sessions in her first month cancels at roughly 80%.
//   * Past 90 days, she is about 3x more likely to still be there in a year.
//   * A lapsing member stays winnable for about six weeks before the decision hardens.
// The whole value is in the gap between "she stopped showing up" and "her card declined". This
// file is the definition of that gap, and it is deliberately ONE definition: the coach queue, the
// member-facing nudge ladder and anything added later all classify through `classifyRisk`, for the
// same reason attention.ts imports isAtRisk instead of restating it.
//
// THRESHOLDS, and why these numbers.
//   7 days   the first week she misses entirely. Early enough to be a nudge, not an intervention.
//   14 days  two weeks. This is where a habit stops being interrupted and starts being over.
//   28 days  a month. Automation has had three tries; anything further needs a person.
// They are round numbers rather than tuned ones, and nothing here pretends otherwise. Tuning them
// needs churn outcomes this app has not collected yet: revisit once there are cancellations to
// score against, not before.

/** Quiet-day bands. A member's band is the largest one she has passed. */
export const QUIET_SLIPPING_DAYS = 7;
export const QUIET_AT_RISK_DAYS = 14;
export const QUIET_GHOST_DAYS = 28;

// The first-month rule. Evaluated from day 21, not day 4: on a 3x/week program a member is expected
// to have logged about nine sessions by then, so "fewer than four" is a real signal rather than an
// artefact of it being early. It stops at day 30 because after that the quiet bands describe her
// better, and because a rule that never expires would keep flagging a member who has since settled
// into training twice a week for a year.
export const WEAK_START_FROM_DAY = 21;
export const WEAK_START_TO_DAY = 30;
export const WEAK_START_MIN_WORKOUTS = 4;

export type RiskTier = 'ok' | 'slipping' | 'weak_start' | 'at_risk' | 'ghost';

export type RiskInput = {
  /** Days since she last did anything. Clock starts at onboarding when she has done nothing yet. */
  daysQuiet: number;
  /** Days since she finished onboarding, i.e. since the app owed her something. */
  memberAgeDays: number;
  /** Workouts logged since joining. Only meaningful inside the first-month window. */
  workoutsSinceJoining: number;
};

/**
 * One member's tier.
 *
 * ORDER MATTERS AND IS NOT ALPHABETICAL. ghost and at_risk outrank weak_start because a longer
 * silence is a worse fact about the same person, and weak_start outranks slipping because a
 * documented ~80% cancel predictor beats one missed week. A member can satisfy several of these at
 * once (a 25-day member who has been quiet 16 days is both weak_start and at_risk); she must appear
 * on the queue exactly once, under the description that changes what the coach does.
 */
export function classifyRisk(input: RiskInput): RiskTier {
  const { daysQuiet, memberAgeDays, workoutsSinceJoining } = input;
  if (daysQuiet >= QUIET_GHOST_DAYS) return 'ghost';
  if (daysQuiet >= QUIET_AT_RISK_DAYS) return 'at_risk';
  if (
    memberAgeDays >= WEAK_START_FROM_DAY &&
    memberAgeDays <= WEAK_START_TO_DAY &&
    workoutsSinceJoining < WEAK_START_MIN_WORKOUTS
  ) {
    return 'weak_start';
  }
  if (daysQuiet >= QUIET_SLIPPING_DAYS) return 'slipping';
  return 'ok';
}

export function isEngagementRisk(tier: RiskTier): boolean {
  return tier !== 'ok';
}

/** Worst first. The queue is read top-down and sorted by this, then by how long she has been quiet. */
export const TIER_RANK: Record<RiskTier, number> = {
  ghost: 0,
  at_risk: 1,
  weak_start: 2,
  slipping: 3,
  ok: 4,
};

/** What the coach should actually do, per tier. Shown on the card so the queue is answerable. */
export const TIER_LABEL: Record<Exclude<RiskTier, 'ok'>, { title: string; action: string }> = {
  ghost: {
    title: 'Gone quiet a month',
    action: 'Call or voice-note her. Three automated messages have already gone unanswered.',
  },
  at_risk: {
    title: 'Two weeks silent',
    action: 'Ask what changed. Most people stop because the plan stopped fitting their week.',
  },
  weak_start: {
    title: 'Weak first month',
    action: 'Fewer than four workouts in her first month. Shorten week one and check the schedule.',
  },
  slipping: {
    title: 'Missed a week',
    action: 'A nudge has gone out. Watch it; no action needed unless it reaches two weeks.',
  },
};

/**
 * Which rung of the automated ladder a quiet member is on, or null if she is not on it.
 *
 * BANDS, NOT ANNIVERSARIES. Returning a stage only on exactly day 7 would mean one failed cron run
 * silently skips a member forever. The band plus the once-per-quiet-spell guard at the call site
 * gives the same "exactly one message per rung" guarantee without depending on the job never
 * missing a day.
 */
export function reengageStage(daysQuiet: number): 7 | 14 | 28 | null {
  if (daysQuiet >= QUIET_GHOST_DAYS) return 28;
  if (daysQuiet >= QUIET_AT_RISK_DAYS) return 14;
  if (daysQuiet >= QUIET_SLIPPING_DAYS) return 7;
  return null;
}

/** The notification type carrying each rung. Distinct per rung so the dedupe can tell them apart. */
export const REENGAGE_TYPES = {
  7: 'reengage_7',
  14: 'reengage_14',
  28: 'reengage_28',
} as const;

export const REENGAGE_TYPE_LIST = [
  REENGAGE_TYPES[7],
  REENGAGE_TYPES[14],
  REENGAGE_TYPES[28],
] as const;

/**
 * Whole days between a date (or timestamp) and today, in UTC. Negative clamps to 0.
 *
 * UTC on purpose. Doing this per-member-timezone would move an answer by at most one day, against
 * thresholds of 7, 14 and 28 that are round numbers rather than measured ones. Paying for 270
 * Intl calls, and for the reader having to hold two calendars in their head, to shift a boundary
 * by a day is a bad trade. The streak engine is per-timezone because a member SEES her streak;
 * nobody sees this number but the coach.
 */
export function daysSince(iso: string, now: Date = new Date()): number {
  const dayStart = (value: string): number => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  const then = dayStart(iso);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((dayStart(now.toISOString()) - then) / 86_400_000));
}

/**
 * Statuses that mean she is still a member of this coaching relationship.
 *
 * past_due is HERE on purpose. Her card failed; she has not left, and she is exactly the person the
 * quiet queue exists to catch — the whole premise of this module is that engagement risk arrives
 * weeks before billing risk, so treating a declined card as a departure would discard the overlap
 * that matters most.
 */
const LIVE_ENOUGH_GRANTS = new Set(['active', 'trialing', 'past_due', 'paused']);

/**
 * Has she actually left, as opposed to gone quiet?
 *
 * Nothing in this app demotes profiles.role when a subscription ends — the only role writes are
 * manual admin actions — so a woman who cancelled last month is still role 'subscriber', still has
 * an onboarding row, and is very quiet indeed. Without this she lands on the churn queue as someone
 * to win back and, on day 28, receives "your coach is going to reach out personally". Messaging
 * someone who cancelled as though she is still coached is worse than saying nothing: it reads as
 * not having noticed she left.
 *
 * Deliberately conservative in both directions:
 *   - Before Stripe is configured, nobody can subscribe, so nobody can have cancelled. Applying the
 *     test then would empty the queue and hide the members it exists to surface.
 *   - No grant at all is not evidence of departure. Comped members and staff test accounts have
 *     none, and dropping them would silently shrink the roster this sweep reports on.
 * Only an explicit, complete set of dead grants counts as gone.
 */
export function hasDepartedGrants(
  grants: readonly string[] | undefined,
  stripeConfigured: boolean,
): boolean {
  if (!stripeConfigured) return false;
  if (!grants || grants.length === 0) return false;
  return !grants.some((g) => LIVE_ENOUGH_GRANTS.has(g));
}
