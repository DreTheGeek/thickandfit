/**
 * The starter matcher, pinned against Stephanie's REAL library.
 *
 * The seven candidates below are what migration 0148 marked, verbatim. The one that matters most is
 * the gap: she has exactly ONE home program (3 day, beginner_intermediate), so every home member
 * lands on it no matter what else she said. Rule 1 says that is correct, and a test that did not
 * assert it would let somebody "improve" the matcher into handing a barbell program to a woman
 * training in a bedroom.
 *
 *   npx tsx .qa-visual/match-starter-test.mts
 */
import { chooseStarterPlan, type StarterCandidate } from '../src/lib/programs/match-starter-shared';

const HOME_3 = 'home-3-bi';
const GYM_3 = 'gym-3-bi';
const GYM_4 = 'gym-4-bi';
const GYM_4_ADV = 'gym-4-adv';
const GYM_5 = 'gym-5-bi';
const GYM_5_ADV = 'gym-5-adv';
const GYM_5_B = 'gym-5-bi-2';

const LIBRARY: StarterCandidate[] = [
  { id: HOME_3, name_en: '3 day @HOME', days_per_week: 3, level: 'beginner_intermediate', location: 'home' },
  { id: GYM_3, name_en: '3 day', days_per_week: 3, level: 'beginner_intermediate', location: 'gym' },
  { id: GYM_4, name_en: '4 day', days_per_week: 4, level: 'beginner_intermediate', location: 'gym' },
  { id: GYM_4_ADV, name_en: '4 day ADVANCED', days_per_week: 4, level: 'advanced', location: 'gym' },
  { id: GYM_5, name_en: '5 day', days_per_week: 5, level: 'beginner_intermediate', location: 'gym' },
  { id: GYM_5_ADV, name_en: '5 day ADVANCED', days_per_week: 5, level: 'advanced', location: 'gym' },
  { id: GYM_5_B, name_en: '5 day Plan 2', days_per_week: 5, level: 'beginner_intermediate', location: 'gym' },
];

const fails: string[] = [];
const pick = (location: string | null, experience: string | null, daysPerWeek: number | null) =>
  chooseStarterPlan(LIBRARY, { location, experience, daysPerWeek });

const want = (label: string, got: ReturnType<typeof pick>, id: string | null): void => {
  const actual = got?.plan.id ?? null;
  if (actual !== id) fails.push(`${label}: got ${actual}, want ${id}`);
};

// --- the straightforward cases -----------------------------------------------------------------
want('gym / new / 3', pick('gym', 'new', 3), GYM_3);
want('gym / some / 4', pick('gym', 'some', 4), GYM_4);
want('gym / experienced / 4', pick('gym', 'experienced', 4), GYM_4_ADV);
want('gym / experienced / 5', pick('gym', 'experienced', 5), GYM_5_ADV);

// --- rule 1: location is HARD ------------------------------------------------------------------
// Every one of these lands on the single home plan. She has no gym; the days and the level lose.
want('home / new / 3', pick('home', 'new', 3), HOME_3);
want('home / experienced / 5', pick('home', 'experienced', 5), HOME_3);
want('home / some / 4', pick('home', 'some', 4), HOME_3);
// This is the owner's own case: he answered home + experienced and was handed the @HOME
// Beginner/Intermediate plan by a hardcoded default. The matcher reaches the same plan, but for a
// reason, and flags it as a compromise so a coach knows to look.
{
  const m = pick('home', 'experienced', 5);
  if (!m?.compromised) fails.push('home/experienced/5 should be flagged compromised');
  if (m && !/advanced/i.test(m.reason)) fails.push('home/experienced/5 reason should mention the level drop');
}

// --- rule 2: never match UP on level -----------------------------------------------------------
// A beginner must NEVER reach an ADVANCED plan, at any day count.
for (const d of [3, 4, 5]) {
  for (const exp of ['new', 'some']) {
    const m = pick('gym', exp, d);
    if (m && m.plan.id.includes('adv')) fails.push(`gym/${exp}/${d} was given an ADVANCED plan`);
  }
}
// DAYS OUTRANK LEVEL, and this is the case that proves it. An experienced member who can train 3
// days can have the 3-day Beginner/Intermediate block or the 4-day ADVANCED one. She gets the 3-day:
// a level too easy is fixable in one message, a day too many is not, because the constraint is her
// life rather than her strength. Flagged as a compromise so a coach can bump her.
want('gym / experienced / 3 takes the 3-day over the 4-day ADVANCED', pick('gym', 'experienced', 3), GYM_3);
{
  const m = pick('gym', 'experienced', 3);
  if (!m?.compromised) fails.push('experienced on a beginner block must be flagged compromised');
}
// But an experienced member who CAN do 4 or 5 gets the advanced block, so the level drop above is a
// last resort rather than a habit.
want('gym / experienced / 4 stays advanced', pick('gym', 'experienced', 4), GYM_4_ADV);

// --- rule 3: nearest days, ties round DOWN -----------------------------------------------------
// No 6-day plan exists; 5 is nearest.
want('gym / some / 6', pick('gym', 'some', 6), GYM_5);
// 2 is below everything; 3 is nearest.
want('gym / some / 2', pick('gym', 'some', 2), GYM_3);
// An experienced member asking for 6 gets the 5-day ADVANCED rather than dropping a level: going
// UNDER on days is cheap, so the level is what survives here.
want('gym / experienced / 6', pick('gym', 'experienced', 6), GYM_5_ADV);
// Asking for 2 falls to the nearest day count, and the level drops with it.
want('gym / experienced / 2', pick('gym', 'experienced', 2), GYM_3);

// --- unanswered ---------------------------------------------------------------------------------
// No location answer is treated as home-only: a plan needing no equipment always works, and one
// needing a gym she may not have does not.
want('nothing answered', pick(null, null, null), HOME_3);
want('gym but no days', pick('gym', 'some', null), GYM_3);

// --- empty pool ---------------------------------------------------------------------------------
if (chooseStarterPlan([], { location: 'gym', experience: 'new', daysPerWeek: 3 }) !== null) {
  fails.push('an empty library must return null, not a guess');
}
// Nothing marked home, and she has no gym: null, so a human writes it.
const gymOnly = LIBRARY.filter((p) => p.location === 'gym');
if (chooseStarterPlan(gymOnly, { location: 'home', experience: 'new', daysPerWeek: 3 }) !== null) {
  fails.push('a home member with no home plan must return null rather than a gym plan');
}

// --- the compromise flag ------------------------------------------------------------------------
{
  const exact = pick('gym', 'some', 4);
  if (exact?.compromised) fails.push('an exact match must not be flagged as a compromise');
  const off = pick('gym', 'some', 6);
  if (!off?.compromised) fails.push('a 6-day request served by a 5-day plan is a compromise');
}

if (fails.length) {
  console.error(`FAIL (${fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('match-starter: PASS');
