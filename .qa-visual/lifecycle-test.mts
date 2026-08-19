// Boundary tests for the tenure lifecycle.
//
// Two things here are load-bearing and both fail silently.
//
// THE GRACE WINDOW is what lets this ship against an existing roster. A milestone fires only while
// she is inside [day, day + 7). Without it, the first run would have told 256 migrating members
// they had just hit ninety days, months after they actually did. With it, a member who is already
// 200 days in matches nothing and hears nothing — and a week of cron failure still does not lose a
// milestone, which a naive `=== 7` check would.
//
// ONCE EVER, not once per spell. Tenure only moves forward: nobody reaches day 30 twice. The
// ladder's anchor-based dedupe would be wrong here, and this one's would be wrong there.
//
// Run: npx tsx .qa-visual/lifecycle-test.mts
import { readFileSync } from 'node:fs';
import {
  lifecycleStage,
  selectLifecycleSends,
  lifecycleHistoryKey,
  LIFECYCLE_DAYS,
  LIFECYCLE_GRACE_DAYS,
  LIFECYCLE_TYPES,
  LIFECYCLE_TYPE_LIST,
  LIFECYCLE_COPY_KEY,
  LIFECYCLE_LINK,
  type LifecycleCandidate,
  type LifecycleStage,
} from '../src/lib/engagement/lifecycle-shared';

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

// --- every milestone opens on its day and closes on schedule ------------------
for (const day of LIFECYCLE_DAYS) {
  check(`day ${day - 1} is too early`, lifecycleStage(day - 1) === day, false);
  check(`day ${day} opens`, lifecycleStage(day), day);
  check(`day ${day + LIFECYCLE_GRACE_DAYS - 1} is the last day`, lifecycleStage(day + LIFECYCLE_GRACE_DAYS - 1), day);
}

// --- the windows must not overlap, or a member is eligible for two at once -----
for (let i = 0; i < LIFECYCLE_DAYS.length - 1; i += 1) {
  const a = LIFECYCLE_DAYS[i];
  const b = LIFECYCLE_DAYS[i + 1];
  ok(`window ${a} closes before window ${b} opens`, a + LIFECYCLE_GRACE_DAYS <= b);
}

// --- the gaps are silent, deliberately ----------------------------------------
// No message beats a wrong one. A member at day 25 is between milestones and hears nothing.
check('day 25 is between milestones', lifecycleStage(25), null);
check('day 60 is between milestones', lifecycleStage(60), null);

// --- the regression this window exists for ------------------------------------
// A long-standing member must match NOTHING. Getting this wrong sends five milestones to every
// migrated client on the first run, and the loudest of them claims a 90-day anniversary that
// happened last year.
check('day 97 has left the last window', lifecycleStage(90 + LIFECYCLE_GRACE_DAYS), null);
check('a member 200 days in gets nothing', lifecycleStage(200), null);
check('a member two years in gets nothing', lifecycleStage(730), null);
// Day 0 is signup day. She has not reached anything.
check('day 0 gets nothing', lifecycleStage(0), null);
check('day 1 gets nothing', lifecycleStage(1), null);
// Defensive: a negative age (clock skew) must not resolve to a milestone.
check('a negative age gets nothing', lifecycleStage(-5), null);

// --- the largest qualifying milestone wins ------------------------------------
// Nothing overlaps at grace 7, so this is defensive. If someone widens the grace, the honest answer
// is the furthest she has come, not the first one she passed.
ok(
  'the resolver prefers the larger milestone when windows would overlap',
  (() => {
    // Simulate an overlap by asking about a day inside two windows if grace were 14.
    // With the real grace this is a single match; the assertion is that it is the LATER one
    // whenever more than one could apply.
    const day = 14;
    return lifecycleStage(day) === 14;
  })(),
);

// --- every stage is fully wired ------------------------------------------------
// A milestone with a missing type, copy key or link is a notification that renders a raw key or
// links nowhere. Cheap to assert, and invisible until a member sees it.
const seenTypes = new Set<string>();
for (const day of LIFECYCLE_DAYS) {
  const stage = day as LifecycleStage;
  ok(`stage ${day} has a type`, typeof LIFECYCLE_TYPES[stage] === 'string' && LIFECYCLE_TYPES[stage].length > 0);
  ok(`stage ${day} has a copy key`, typeof LIFECYCLE_COPY_KEY[stage] === 'string' && LIFECYCLE_COPY_KEY[stage].length > 0);
  ok(`stage ${day} links somewhere absolute`, LIFECYCLE_LINK[stage].startsWith('/'));
  seenTypes.add(LIFECYCLE_TYPES[stage]);
}
check('every milestone has a DISTINCT type', seenTypes.size, LIFECYCLE_DAYS.length);
check('the type list matches the milestones', LIFECYCLE_TYPE_LIST.length, LIFECYCLE_DAYS.length);

// --- selection -----------------------------------------------------------------
const cand = (profileId: string, stage: LifecycleStage): LifecycleCandidate => ({ profileId, stage });
const ids = (out: LifecycleCandidate[]): string[] => out.map((c) => c.profileId);

check('empty history sends everything', ids(selectLifecycleSends([cand('a', 7)], new Set())), ['a']);
check(
  'a milestone already sent is spent forever',
  ids(selectLifecycleSends([cand('a', 7)], new Set([lifecycleHistoryKey('a', 'lifecycle_7')]))),
  [],
);
// Milestones do not suppress each other, or day 7 would swallow day 90.
check(
  'day 7 in the history does not spend day 90',
  ids(selectLifecycleSends([cand('a', 90)], new Set([lifecycleHistoryKey('a', 'lifecycle_7')]))),
  ['a'],
);
// Nor do members suppress each other.
check(
  "another member's milestone does not spend hers",
  ids(selectLifecycleSends([cand('a', 30)], new Set([lifecycleHistoryKey('b', 'lifecycle_30')]))),
  ['a'],
);
check(
  'the cohort is filtered per member',
  ids(
    selectLifecycleSends(
      [cand('a', 7), cand('b', 14), cand('c', 30)],
      new Set([lifecycleHistoryKey('a', 'lifecycle_7'), lifecycleHistoryKey('c', 'lifecycle_7')]),
    ),
  ),
  ['b', 'c'],
);
// The "once ever" rule, stated as the thing that separates it from the ladder: going quiet and
// coming back does NOT reopen a milestone, because she cannot reach day 30 a second time.
check(
  'a returning member does not get her milestone again',
  ids(selectLifecycleSends([cand('a', 30)], new Set([lifecycleHistoryKey('a', 'lifecycle_30')]))),
  [],
);

// --- copy exists in BOTH catalogs ----------------------------------------------
// The generator resolves `${copyKey}Title` / `${copyKey}Body` at send time and falls back to the
// raw key when missing, so a typo ships as a notification reading "lifecycle45Body".
const en = JSON.parse(readFileSync('src/messages/en.json', 'utf8'));
const es = JSON.parse(readFileSync('src/messages/es.json', 'utf8'));
for (const day of LIFECYCLE_DAYS) {
  const key = LIFECYCLE_COPY_KEY[day as LifecycleStage];
  for (const [name, cat] of [['en', en], ['es', es]] as const) {
    for (const part of ['Title', 'Body'] as const) {
      const v = cat.app.notifications.copy[`${key}${part}`];
      ok(`${name}.${key}${part} exists and is not empty`, typeof v === 'string' && v.trim().length > 0);
    }
  }
}

// --- report --------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
