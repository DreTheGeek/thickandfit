// Target-date pacing. Imports the REAL module (Node strips the TS types).
//
// The case that matters: "20 lb by the wedding in six weeks" must be told the truth ONCE, up front,
// rather than silently accepted and then failed against a number the app endorsed.
import {
  assessGoalPace,
  minTargetDateIso,
  maxTargetDateIso,
  COMFORTABLE_PCT,
  AGGRESSIVE_PCT,
} from '../src/lib/onboarding/goal-pace.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

const NOW = new Date('2026-08-01T12:00:00Z');
const LB = 0.45359237;
const inDays = (n) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);
const pace = (curLb, goalLb, days) =>
  assessGoalPace({ currentKg: curLb * LB, goalKg: goalLb * LB, targetDateIso: inDays(days), now: NOW });

// --- no date set: say nothing, do not invent a verdict ------------------------------------------
ok('null date -> none', assessGoalPace({ currentKg: 100, goalKg: 90, targetDateIso: null, now: NOW }).verdict === 'none');
ok('undefined -> none', assessGoalPace({ currentKg: 100, goalKg: 90, targetDateIso: undefined, now: NOW }).verdict === 'none');
ok('garbage date -> none', assessGoalPace({ currentKg: 100, goalKg: 90, targetDateIso: 'not-a-date', now: NOW }).verdict === 'none');

// --- already at goal ------------------------------------------------------------------------------
ok('at goal -> done', pace(180, 180, 90).verdict === 'done');
ok('within half a kg -> done', pace(180, 179.5, 90).verdict === 'done');

// --- a date in the past ---------------------------------------------------------------------------
ok('past date', pace(230, 185, -7).verdict === 'past');
ok('today', pace(230, 185, 0).verdict === 'past');

// --- THE WEDDING CASE: 20 lb in 6 weeks at 150 lb --------------------------------------------------
const wedding = pace(150, 130, 42);
ok('THE CASE: 20lb/6wk is unrealistic', wedding.verdict === 'unrealistic');
ok('wedding suggests a real date', typeof wedding.suggestedDateIso === 'string');
ok('suggested date is later', wedding.suggestedDateIso > inDays(42));

// --- sensible paces --------------------------------------------------------------------------------
// 230 -> 185 (45 lb) over a year is about 0.87 lb/wk = 0.38%/wk. Comfortable.
const steady = pace(230, 185, 365);
ok('45lb over a year is comfortable', steady.verdict === 'comfortable');
ok('comfortable offers no alternative date', steady.suggestedDateIso === null);
ok('weekly is negative when losing', steady.weeklyKg < 0);

// Gaining is symmetric.
const bulk = pace(130, 145, 365);
ok('gaining is comfortable', bulk.verdict === 'comfortable');
ok('weekly is positive when gaining', bulk.weeklyKg > 0);

// --- the middle band -------------------------------------------------------------------------------
// Land squarely between the two thresholds by construction.
const midPct = (COMFORTABLE_PCT + AGGRESSIVE_PCT) / 2;
const mid = assessGoalPace({
  currentKg: 100,
  goalKg: 100 - midPct * 100 * 10, // 10 weeks at the midpoint rate
  targetDateIso: inDays(70),
  now: NOW,
});
ok('mid band -> aggressive', mid.verdict === 'aggressive');
ok('aggressive still suggests a date', typeof mid.suggestedDateIso === 'string');

// --- percent-of-bodyweight, not absolute pounds ----------------------------------------------------
// 1 lb/week is gentle at 250 lb and hard at 110 lb. A fixed pound threshold would get both wrong.
const heavy = pace(250, 240, 70); // 10 lb over 10 weeks
const light = pace(110, 100, 70); // same 10 lb, same time, much lighter person
ok('heavy person: 1lb/wk comfortable', heavy.verdict === 'comfortable');
ok('light person: same rate is not comfortable', light.verdict !== 'comfortable');

// --- reported fields --------------------------------------------------------------------------------
ok('weeksAvailable ~6', Math.abs(pace(150, 140, 42).weeksAvailable - 6) < 0.2);
ok('weeklyPct positive', pace(230, 185, 365).weeklyPct > 0);

// --- picker bounds ----------------------------------------------------------------------------------
ok('min is a week out', minTargetDateIso(NOW) === inDays(7));
ok('max is ~3 years', maxTargetDateIso(NOW) > inDays(1000));
ok('min before max', minTargetDateIso(NOW) < maxTargetDateIso(NOW));

console.log(`goal pace: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
