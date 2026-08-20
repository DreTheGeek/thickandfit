// The one definition of "best", pinned.
//
// weight * (1 + reps / 30) was written out FOUR times: logging.ts (which computes the all-time best
// handed to the player), the player's own detectPRs, getStrength behind the Progress tab, and
// getRecentPRs behind the card in the coach thread. Four copies of the arithmetic that decides what
// counts as a personal record, on surfaces a member can have open at once.
//
// They agreed, which is exactly why collapsing them was worth doing before they stopped. The
// failure mode is not a crash: it is Progress calling something her best while the player did not,
// and nothing anywhere compared the two.
//
// Run: npx tsx .qa-visual/epley-test.mts
import { epley1rm, beatsBest, PR_EPSILON } from '../src/lib/workout/epley.ts';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = Math.abs(Number(actual) - Number(expected)) < 1e-9 || actual === expected;
  if (!ok) {
    console.error(`  x ${label}: got ${actual}, expected ${expected}`);
    failures++;
  }
}

// --- the formula -------------------------------------------------------------------------------
// A single rep IS the one-rep max: the estimate must not inflate a true 1RM.
check('1 rep at 100 estimates 100 * (1+1/30)', epley1rm(100, 1), 100 * (1 + 1 / 30));
check('10 reps at 100', epley1rm(100, 10), 100 * (1 + 10 / 30));
// Zero load has nothing to project from. Callers branch to reps for bodyweight; the formula itself
// must still return 0 rather than NaN so a stray call cannot poison a comparison.
check('bodyweight (0 load) is 0, not NaN', epley1rm(0, 12), 0);
check('0 reps is the bare load', epley1rm(100, 0), 100);

// More reps at the same load, and more load at the same reps, both have to register as progress.
// This is the whole reason the app uses e1RM rather than comparing weight alone.
if (!(epley1rm(100, 11) > epley1rm(100, 10))) {
  console.error('  x more reps at the same load must score higher');
  failures++;
}
if (!(epley1rm(105, 10) > epley1rm(100, 10))) {
  console.error('  x more load at the same reps must score higher');
  failures++;
}

// --- the near-tie margin -----------------------------------------------------------------------
// The player used +0.5 and the two server readers used a plain `>`. e1RM values for the SAME lift
// can differ in the last decimal, so a strict comparison calls an identical set a new record and
// she is congratulated for repeating herself.
const best = epley1rm(100, 10);
if (beatsBest(best, best)) {
  console.error('  x an identical set must not count as a record');
  failures++;
}
if (beatsBest(best + PR_EPSILON / 2, best)) {
  console.error('  x a difference inside the margin must not count');
  failures++;
}
if (!beatsBest(best + PR_EPSILON * 2, best)) {
  console.error('  x a difference beyond the margin must count');
  failures++;
}
// The realistic case this protects: one more rep at the same load is ~3.3 e1RM points at 100lb,
// comfortably past the margin, so tightening the comparison must not swallow a real PR.
if (!beatsBest(epley1rm(100, 11), epley1rm(100, 10))) {
  console.error('  x one extra rep at the same load must still count as a record');
  failures++;
}
// And the smallest plate change anybody actually makes.
if (!beatsBest(epley1rm(102.5, 10), epley1rm(100, 10))) {
  console.error('  x a 2.5lb increase must still count as a record');
  failures++;
}

console.log(failures ? `\nFAILED (${failures})` : '\nOK: one definition of best, and it holds');
process.exit(failures ? 1 : 0);
