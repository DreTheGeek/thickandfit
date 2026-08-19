// Boundary tests for engagement-risk classification.
//
// The thresholds ARE the feature. Everything downstream — the coach queue, the three-rung nudge
// ladder, the attention chip — is plumbing around classifyRisk and reengageStage, and both are
// off-by-one hazards by construction: 7 / 14 / 28 are inclusive lower bounds, the first-month rule
// is a closed interval, and tier precedence is deliberately NOT the order the tiers are declared in.
//
// The failure mode is not a crash. It is telling a woman who trained yesterday that she has gone
// quiet, or (worse, and silently) leaving a member who vanished a month ago off the only list that
// would have reached her.
//
// Run: npx tsx .qa-visual/engagement-risk-test.mts
import {
  classifyRisk,
  daysSince,
  isEngagementRisk,
  reengageStage,
  hasDepartedGrants,
  ladderHistoryKey,
  ladderLookbackDay,
  selectLadderSends,
  type LadderCandidate,
  TIER_RANK,
  REENGAGE_TYPES,
  QUIET_SLIPPING_DAYS,
  QUIET_AT_RISK_DAYS,
  QUIET_GHOST_DAYS,
  WEAK_START_FROM_DAY,
  WEAK_START_TO_DAY,
  WEAK_START_MIN_WORKOUTS,
  type RiskTier,
} from '../src/lib/engagement/risk-shared';

let pass = 0;
const failures: string[] = [];

function check(name: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass += 1;
  else failures.push(`${name}\n    expected ${w}\n    got      ${g}`);
}

function ok(name: string, cond: boolean): void {
  if (cond) pass += 1;
  else failures.push(name);
}

// A long-standing member (past the first-month window) so only the quiet bands apply.
const settled = (daysQuiet: number): RiskTier =>
  classifyRisk({ daysQuiet, memberAgeDays: 200, workoutsSinceJoining: 0 });

// --- quiet bands, at every boundary -----------------------------------------
check('quiet 0 is ok', settled(0), 'ok');
check('quiet 6 is still ok', settled(QUIET_SLIPPING_DAYS - 1), 'ok');
check('quiet 7 slips', settled(QUIET_SLIPPING_DAYS), 'slipping');
check('quiet 13 still slipping', settled(QUIET_AT_RISK_DAYS - 1), 'slipping');
check('quiet 14 is at risk', settled(QUIET_AT_RISK_DAYS), 'at_risk');
check('quiet 27 still at risk', settled(QUIET_GHOST_DAYS - 1), 'at_risk');
check('quiet 28 is a ghost', settled(QUIET_GHOST_DAYS), 'ghost');
check('quiet 400 is a ghost', settled(400), 'ghost');

// --- the first-month rule ----------------------------------------------------
// Active member, but barely training. The whole point is that she does NOT look quiet.
const firstMonth = (memberAgeDays: number, workouts: number, daysQuiet = 1): RiskTier =>
  classifyRisk({ daysQuiet, memberAgeDays, workoutsSinceJoining: workouts });

check('day 20 is too early to judge', firstMonth(WEAK_START_FROM_DAY - 1, 0), 'ok');
check('day 21 with 0 workouts is a weak start', firstMonth(WEAK_START_FROM_DAY, 0), 'weak_start');
check('day 21 with 3 workouts is a weak start', firstMonth(WEAK_START_FROM_DAY, 3), 'weak_start');
check(
  'day 21 with 4 workouts is fine',
  firstMonth(WEAK_START_FROM_DAY, WEAK_START_MIN_WORKOUTS),
  'ok',
);
check('day 30 with 1 workout still flags', firstMonth(WEAK_START_TO_DAY, 1), 'weak_start');
check('day 31 has left the window', firstMonth(WEAK_START_TO_DAY + 1, 1), 'ok');

// --- precedence, which is the part that is easy to get wrong -----------------
// A member can satisfy several rules at once. She must appear once, under the description that
// changes what the coach does.
check(
  'a 25-day member quiet 16 days reads as at_risk, not weak_start',
  classifyRisk({ daysQuiet: 16, memberAgeDays: 25, workoutsSinceJoining: 0 }),
  'at_risk',
);
check(
  'a 25-day member quiet 30 days reads as ghost',
  classifyRisk({ daysQuiet: 30, memberAgeDays: 25, workoutsSinceJoining: 0 }),
  'ghost',
);
check(
  'weak_start beats slipping: 8 quiet days in a weak first month is the weak start',
  classifyRisk({ daysQuiet: 8, memberAgeDays: 24, workoutsSinceJoining: 1 }),
  'weak_start',
);
check(
  'a strong first month with 8 quiet days is just slipping',
  classifyRisk({ daysQuiet: 8, memberAgeDays: 24, workoutsSinceJoining: 9 }),
  'slipping',
);

// --- sort order matches the precedence the classifier encodes -----------------
ok('ghost sorts before at_risk', TIER_RANK.ghost < TIER_RANK.at_risk);
ok('at_risk sorts before weak_start', TIER_RANK.at_risk < TIER_RANK.weak_start);
ok('weak_start sorts before slipping', TIER_RANK.weak_start < TIER_RANK.slipping);
ok('ok sorts last', TIER_RANK.slipping < TIER_RANK.ok);

// --- what counts as needing attention ----------------------------------------
check('ok needs nothing', isEngagementRisk('ok'), false);
for (const t of ['slipping', 'weak_start', 'at_risk', 'ghost'] as const) {
  check(`${t} needs attention`, isEngagementRisk(t), true);
}

// --- the ladder --------------------------------------------------------------
check('no rung before day 7', reengageStage(QUIET_SLIPPING_DAYS - 1), null);
check('rung 7 at day 7', reengageStage(QUIET_SLIPPING_DAYS), 7);
check('still rung 7 at day 13', reengageStage(QUIET_AT_RISK_DAYS - 1), 7);
check('rung 14 at day 14', reengageStage(QUIET_AT_RISK_DAYS), 14);
check('still rung 14 at day 27', reengageStage(QUIET_GHOST_DAYS - 1), 14);
check('rung 28 at day 28', reengageStage(QUIET_GHOST_DAYS), 28);
// The ladder stops. A fourth message to a woman who has ignored three is nagging, and the day-28
// copy already told her a person would take over.
check('rung 28 is the last one, forever', reengageStage(365), 28);

// The rungs must be distinct types or the dedupe collapses: one 'reengage' type would let rung 14
// suppress rung 28, and she would never get the message that promises a human.
const types = [REENGAGE_TYPES[7], REENGAGE_TYPES[14], REENGAGE_TYPES[28]];
check('three distinct rung types', new Set(types).size, 3);

// The band boundaries and the tier boundaries must be the SAME numbers. If they drift, a member
// sits in the at_risk tier while the ladder still thinks she is on rung 7.
for (const d of [0, 6, 7, 13, 14, 27, 28, 100]) {
  const tier = settled(d);
  const stage = reengageStage(d);
  const expected = tier === 'ok' ? null : tier === 'slipping' ? 7 : tier === 'at_risk' ? 14 : 28;
  check(`tier and rung agree at ${d} days quiet`, stage, expected);
}

// --- daysSince ---------------------------------------------------------------
const now = new Date('2026-08-14T09:30:00Z');
check('same day is 0', daysSince('2026-08-14', now), 0);
check('yesterday is 1', daysSince('2026-08-13', now), 1);
check('a week is 7', daysSince('2026-08-07', now), 7);
check('a timestamp is bucketed to its day', daysSince('2026-08-07T23:59:00Z', now), 7);
// Clock skew or a future-dated row must not produce a negative age that reads as "very active".
check('a future date clamps to 0', daysSince('2026-09-01', now), 0);
check('garbage is 0, not NaN', daysSince('not-a-date', now), 0);

// --- gone versus quiet -----------------------------------------------------------
// Nothing in this app demotes profiles.role when a subscription ends, so a woman who cancelled last
// month is still role 'subscriber', still has an onboarding row, and is extremely quiet. Shipped
// without this check, she landed on the churn queue as someone to win back and, at day 28, was
// told "your coach is going to reach out personally". Found by re-reading the sweep, not by a test.
const ON = true;
const OFF = false;

check('an active grant is not a departure', hasDepartedGrants(['active'], ON), false);
check('trialing is not a departure', hasDepartedGrants(['trialing'], ON), false);
// The overlap this whole module exists for: a declined card is a churn RISK, not a churn.
check('past_due is not a departure', hasDepartedGrants(['past_due'], ON), false);
check('paused is not a departure', hasDepartedGrants(['paused'], ON), false);

check('canceled IS a departure', hasDepartedGrants(['canceled'], ON), true);
check('expired IS a departure', hasDepartedGrants(['expired'], ON), true);
check('revoked IS a departure', hasDepartedGrants(['revoked'], ON), true);
check('every grant dead is a departure', hasDepartedGrants(['canceled', 'expired'], ON), true);

// One live grant beside dead ones means she resubscribed. Treating her as gone would drop a paying
// member off the queue permanently.
check('a resubscriber is not gone', hasDepartedGrants(['canceled', 'active'], ON), false);
check('order does not matter', hasDepartedGrants(['active', 'canceled'], ON), false);
check('a cancelled-then-past_due member is not gone', hasDepartedGrants(['canceled', 'past_due'], ON), false);

// Conservative in both directions. No grant is not evidence: comped members and staff test accounts
// have none, and dropping them would silently shrink the roster this sweep reports on.
check('no grants is not a departure', hasDepartedGrants([], ON), false);
check('undefined grants is not a departure', hasDepartedGrants(undefined, ON), false);

// Pre-launch nobody CAN subscribe, so nobody can have cancelled. Applying the test then would empty
// the queue and hide exactly the members it was built to surface. It arms itself with the live key.
check('pre-Stripe, a cancelled grant is ignored', hasDepartedGrants(['canceled'], OFF), false);
check('pre-Stripe, everything is ignored', hasDepartedGrants(['expired', 'revoked'], OFF), false);

// --- the ladder's dedupe, and the window it reads history through ---------------
// The first version read a flat 90 days of send history, on the reasoning that a rung older than
// the longest quiet spell the ladder describes could not suppress anything. The ladder has no
// longest spell: rung 28 is `daysQuiet >= 28`, and the assertion 20 lines up says day 365 is still
// rung 28. So a ghost's day-28 send aged out of the window, the history came back empty, and she
// was told "your coach is going to reach out personally" again — every 90 days, forever.

const cand = (profileId: string, quietSince: string, stage: 7 | 14 | 28): LadderCandidate => ({
  profileId,
  quietSince,
  stage,
});

// --- lookback ----------------------------------------------------------------
check('no candidates, no lookback', ladderLookbackDay([]), null);
check('one candidate reaches back to her spell', ladderLookbackDay([cand('a', '2026-05-01', 7)]), '2026-05-01');
check(
  'the cohort reaches back to its OLDEST spell, not its newest',
  ladderLookbackDay([cand('a', '2026-08-01', 7), cand('b', '2025-02-14', 28), cand('c', '2026-07-01', 14)]),
  '2025-02-14',
);
check(
  'order does not matter',
  ladderLookbackDay([cand('b', '2025-02-14', 28), cand('a', '2026-08-01', 7)]),
  '2025-02-14',
);
// The regression itself: a member quiet since early 2025 must be looked up against 2025, not
// against a 90-day window that starts long after her rung was delivered.
ok(
  'a year-long ghost is not read through a 90-day window',
  ladderLookbackDay([cand('ghost', '2025-06-01', 28)])! < '2026-05-21',
);

// --- selection ---------------------------------------------------------------
const hist = (entries: Array<[string, string]>): Map<string, string> => new Map(entries);
const ids = (out: LadderCandidate[]): string[] => out.map((c) => c.profileId);

check('empty history sends everything', ids(selectLadderSends([cand('a', '2026-08-01', 7)], hist([]))), ['a']);
check(
  'a rung sent after the spell began is spent',
  ids(selectLadderSends([cand('a', '2026-08-01', 7)], hist([[ladderHistoryKey('a', 'reengage_7'), '2026-08-05']]))),
  [],
);
// The regression, stated as an assertion: the day-28 send is ANCIENT relative to any fixed window,
// and still has to suppress. This only holds because the lookback reaches her spell.
check(
  'a two-year-old rung still suppresses when the spell is older than it',
  ids(selectLadderSends([cand('g', '2024-01-01', 28)], hist([[ladderHistoryKey('g', 'reengage_28'), '2024-01-29']]))),
  [],
);
// Same day counts as spent. A send that landed the morning she last logged something belongs to the
// spell that ended; re-sending it because the clock passed midnight is the loop this guard prevents.
check(
  'sent on the day the spell began is spent',
  ids(selectLadderSends([cand('a', '2026-08-01', 7)], hist([[ladderHistoryKey('a', 'reengage_7'), '2026-08-01']]))),
  [],
);
// The other direction, which is the whole reason the anchor is quietSince and not "ever": she came
// back, she lapsed again, the old message belongs to the old spell.
check(
  'a rung sent before this spell began is owed again',
  ids(selectLadderSends([cand('a', '2026-08-01', 7)], hist([[ladderHistoryKey('a', 'reengage_7'), '2026-07-31']]))),
  ['a'],
);
// Rungs do not suppress each other. If they did, rung 14 would swallow rung 28 and she would never
// get the message that promises a human.
check(
  'rung 7 in the history does not spend rung 28',
  ids(selectLadderSends([cand('a', '2026-08-01', 28)], hist([[ladderHistoryKey('a', 'reengage_7'), '2026-08-09']]))),
  ['a'],
);
// Nor do members suppress each other.
check(
  "another member's send does not spend hers",
  ids(selectLadderSends([cand('a', '2026-08-01', 7)], hist([[ladderHistoryKey('b', 'reengage_7'), '2026-08-09']]))),
  ['a'],
);
check(
  'the cohort is filtered per member, not all-or-nothing',
  ids(
    selectLadderSends(
      [cand('a', '2026-08-01', 7), cand('b', '2026-08-01', 14), cand('c', '2026-08-01', 28)],
      hist([
        [ladderHistoryKey('a', 'reengage_7'), '2026-08-09'],
        [ladderHistoryKey('c', 'reengage_28'), '2026-07-01'],
      ]),
    ),
  ),
  ['b', 'c'],
);

// --- report ------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
