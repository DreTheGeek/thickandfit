// Boundary tests for the cycle phase math.
//
// This file is pure and had zero tests, which is the wrong way round: it is the most consequential
// arithmetic in the tracker. Half her book carries PCOS, endometriosis, thyroid disease or
// perimenopause, and the failure mode is not a crash. It is telling a woman with PCOS that her
// period is due Tuesday, which apps have done to her before and which is the exact reason the
// module refuses to predict on thin data. A regression here is silent and lands as false confidence.
//
// Run: npx tsx .qa-visual/cycle-phase-test.mts
import { cycleStats, currentPhase, addDays, daysBetween, parseDay, DEFAULT_CYCLE_LENGTH } from '../src/lib/cycle/phase';

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

// --- date helpers: the off-by-one that date-only values invite ---------------------------------
check('parseDay is UTC-pinned', new Date(parseDay('2026-03-01')).toISOString().slice(0, 10), '2026-03-01');
check('daysBetween across a month end', daysBetween('2026-01-28', '2026-02-03'), 6);
check('daysBetween across a leap day', daysBetween('2028-02-27', '2028-03-01'), 3);
check('addDays across a year end', addDays('2026-12-30', 5), '2027-01-04');
check('addDays is symmetric with daysBetween', daysBetween('2026-05-01', addDays('2026-05-01', 31)), 31);

// --- refusing to predict ------------------------------------------------------------------------
const none = cycleStats([]);
check('no logs: no average', none.averageLength, null);
check('no logs: no prediction', none.predictedNextStart, null);

const one = cycleStats([{ startedOn: '2026-06-01' }]);
check('one period: no prediction', one.predictedNextStart, null);
check('one period: not called irregular', one.isIrregular, false);

// A gap outside the plausible range is a data error (mistyped year, skipped log), not a 200-day
// cycle. It must not be averaged in, and with nothing left there is nothing to predict from.
const implausible = cycleStats([{ startedOn: '2025-01-01' }, { startedOn: '2026-06-01' }]);
check('implausible gap is discarded', implausible.cycleLengths, []);
check('implausible gap yields no prediction', implausible.predictedNextStart, null);

// --- the plausible-range boundaries, exactly ----------------------------------------------------
const at21 = cycleStats([{ startedOn: '2026-06-01' }, { startedOn: addDays('2026-06-01', 21) }]);
check('21 days is inside the range', at21.cycleLengths, [21]);
const at20 = cycleStats([{ startedOn: '2026-06-01' }, { startedOn: addDays('2026-06-01', 20) }]);
check('20 days is outside the range', at20.cycleLengths, []);
const at45 = cycleStats([{ startedOn: '2026-06-01' }, { startedOn: addDays('2026-06-01', 45) }]);
check('45 days is inside the range', at45.cycleLengths, [45]);
const at46 = cycleStats([{ startedOn: '2026-06-01' }, { startedOn: addDays('2026-06-01', 46) }]);
check('46 days is outside the range', at46.cycleLengths, []);

// --- regular history: a date is fair ------------------------------------------------------------
const regular = cycleStats([
  { startedOn: '2026-03-02' },
  { startedOn: '2026-03-30' },
  { startedOn: '2026-04-27' },
]);
check('regular: average is the true mean', regular.averageLength, 28);
check('regular: not flagged irregular', regular.isIrregular, false);
check('regular: predicts from the LAST start', regular.predictedNextStart, '2026-05-25');
check('regular: no range when a date is honest', regular.predictedRange, null);

// --- irregular history: a range, never a date ---------------------------------------------------
// 22 then 43 days. Spread is far beyond the 7-day tolerance, so a single date would be false
// precision aimed at exactly the members most likely to be hurt by it.
const irregular = cycleStats([
  { startedOn: '2026-01-01' },
  { startedOn: addDays('2026-01-01', 22) },
  { startedOn: addDays('2026-01-01', 22 + 43) },
]);
ok('irregular: flagged', irregular.isIrregular);
check('irregular: refuses a date', irregular.predictedNextStart, null);
ok('irregular: offers a range instead', irregular.predictedRange != null);
ok(
  'irregular: the range brackets the average',
  irregular.predictedRange != null &&
    daysBetween(irregular.predictedRange.from, irregular.predictedRange.to) > 0,
);

// Two cycles differing by exactly the tolerance must NOT trip irregular: the threshold is a spread
// above 7, and a boundary that fires early would call ordinary variation a disorder.
const borderline = cycleStats([
  { startedOn: '2026-01-01' },
  { startedOn: addDays('2026-01-01', 28) },
  { startedOn: addDays('2026-01-01', 56) },
]);
check('identical cycles are regular', borderline.isIrregular, false);

// --- current phase ------------------------------------------------------------------------------
const start = '2026-06-01';
const logs = [{ startedOn: start, endedOn: addDays(start, 4) }];
check('day 1 of bleeding is menstrual', currentPhase(logs, start).phase, 'menstrual');
check('day 3 of bleeding is menstrual', currentPhase(logs, addDays(start, 2)).phase, 'menstrual');
ok('mid-cycle is not menstrual', currentPhase(logs, addDays(start, 13)).phase !== 'menstrual');
check('no logs at all: unknown', currentPhase([], '2026-06-10').phase, 'unknown');

// A date BEFORE any logged period must not report a phase computed from a negative day index.
const before = currentPhase(logs, '2026-05-01');
ok('a date before the first log does not invent a phase', before.phase === 'unknown' || before.dayOfCycle == null || before.dayOfCycle > 0);

check('default cycle length is the clinical 28', DEFAULT_CYCLE_LENGTH, 28);

// --- report -------------------------------------------------------------------------------------
console.log(`cycle phase: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error('  FAIL ' + f);
  process.exit(1);
}
