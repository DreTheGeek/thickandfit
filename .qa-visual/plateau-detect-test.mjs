// Nightly plateau detection. Imports the REAL module (Node strips the TS types).
//
// The case that matters: a member held at maintenance is SUPPOSED to have a flat scale. Onboarding
// promises her exactly that. If this detector then reports 'plateau', the dashboard tells her on day
// 14 that we can "get her moving again", which is the app arguing with itself about the same number.
import { detectPlateau } from '../src/lib/coach-ai/plateau.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// Dates must be relative to today: the module compares against its own isoDaysAgo().
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

// 4 weigh-ins spanning a full 14 days, all inside the 0.5 kg band: a textbook flat month.
const FLAT_ROWS = [
  { recorded_on: daysAgo(0), weight_kg: 88.0 },
  { recorded_on: daysAgo(5), weight_kg: 87.9 },
  { recorded_on: daysAgo(10), weight_kg: 88.1 },
  { recorded_on: daysAgo(14), weight_kg: 88.0 },
];
const roll = (over = {}) => ({
  days: [],
  avg7: null,
  loggedDays30: 20,
  workoutDays30: 8,
  weightTrend7Kg: 0,
  weightTrend30Kg: 0,
  latestWeightKg: 88,
  weightRows: FLAT_ROWS,
  ...over,
});

// --- the fix: flat on a maintenance plan is 'holding', and fires nothing --------------------------
const held = detectPlateau(roll(), 'maintain');
ok('maintain + flat -> holding', held.status === 'holding');
ok('holding is not plateau', held.status !== 'plateau');
ok('holding keeps the real span', held.days_flat === 14);
ok('holding keeps the real delta', held.delta_kg === 0);
ok('holding keeps the entry count', held.entries === 4);
// A refeed is the answer to a stall, and this is not one.
ok('holding drops the refeed suggestion', held.suggestion === null);

// --- the regression guard: a real fat-loss member must STILL be flagged --------------------------
const stalled = detectPlateau(roll(), 'lose');
ok('lose + flat -> plateau (unchanged)', stalled.status === 'plateau');
ok('plateau keeps its suggestion', stalled.suggestion === 'refeed_or_recompute');
ok('plateau span unchanged', stalled.days_flat === 14);
ok('gain + flat -> plateau (unchanged)', detectPlateau(roll(), 'gain').status === 'plateau');
ok('null goal + flat -> plateau (unchanged)', detectPlateau(roll(), null).status === 'plateau');
ok('unknown goal + flat -> plateau (unchanged)', detectPlateau(roll(), 'recomp').status === 'plateau');

// --- the not-flat guards are untouched by the goal ----------------------------------------------
// Genuinely moving: outside the 0.5 kg band.
const moving = [
  { recorded_on: daysAgo(0), weight_kg: 86.0 },
  { recorded_on: daysAgo(5), weight_kg: 86.8 },
  { recorded_on: daysAgo(10), weight_kg: 87.4 },
  { recorded_on: daysAgo(14), weight_kg: 88.0 },
];
ok('maintain + real loss -> none', detectPlateau(roll({ weightRows: moving }), 'maintain').status === 'none');
ok('lose + real loss -> none', detectPlateau(roll({ weightRows: moving }), 'lose').status === 'none');

// Too few weigh-ins to say anything.
ok(
  'maintain + 3 entries -> none',
  detectPlateau(roll({ weightRows: FLAT_ROWS.slice(0, 3) }), 'maintain').status === 'none',
);

// Inactive members are never flagged, whichever way their goal runs.
ok(
  'maintain + inactive -> none',
  detectPlateau(roll({ loggedDays30: 1, workoutDays30: 1 }), 'maintain').status === 'none',
);
ok(
  'lose + inactive -> none',
  detectPlateau(roll({ loggedDays30: 1, workoutDays30: 1 }), 'lose').status === 'none',
);

// A flat window that does not span long enough yet.
const short = [
  { recorded_on: daysAgo(0), weight_kg: 88.0 },
  { recorded_on: daysAgo(2), weight_kg: 87.9 },
  { recorded_on: daysAgo(4), weight_kg: 88.1 },
  { recorded_on: daysAgo(6), weight_kg: 88.0 },
];
ok('lose + only 6 days flat -> none', detectPlateau(roll({ weightRows: short }), 'lose').status === 'none');
ok('maintain + only 6 days flat -> none', detectPlateau(roll({ weightRows: short }), 'maintain').status === 'none');

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  FAIL ${f}`);
  process.exit(1);
}
