/**
 * The prescription classifier, pinned at every boundary.
 *
 * Guards the bug it was written for: an Incline walk prescribed as 1500 seconds with no reps must
 * NEVER classify as 'reps', because the player then fabricates "10 reps at 0 lb" and writes it into
 * the set history that drives progressive overload.
 *
 *   npx tsx .qa-visual/exercise-kind-test.mts
 */
import { exerciseKind, isWeighted, formatDuration } from '../src/lib/workout/exercise-kind';

const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown): void => {
  if (got !== want) fails.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// --- kind -----------------------------------------------------------------------------------
eq('plain reps', exerciseKind({ reps: 12, timeSec: null }), 'reps');
eq('rep range, no reps', exerciseKind({ reps: null, repsMin: 8, repsMax: 12, timeSec: null }), 'reps');
eq('amrap beats everything', exerciseKind({ reps: null, isAmrap: true, timeSec: 60 }), 'reps');
// Her real Incline walk row: 1 set, no reps, 1500s.
eq('incline walk is timed', exerciseKind({ reps: null, timeSec: 1500 }), 'timed');
eq('stairmaster is timed', exerciseKind({ reps: null, timeSec: 300 }), 'timed');
// Reps WIN over a duration: a tempo movement can carry both, and she counts the reps.
eq('reps beat a duration', exerciseKind({ reps: 10, timeSec: 45 }), 'reps');
// Her real Dynamic Warm-up / Post workout stretch rows: nothing prescribed at all.
eq('warm-up is untracked', exerciseKind({ reps: null, timeSec: null }), 'untracked');
eq('zero seconds is not timed', exerciseKind({ reps: null, timeSec: 0 }), 'untracked');

// --- load -----------------------------------------------------------------------------------
eq('barbell is weighted', isWeighted('barbell'), true);
eq('machine is weighted', isWeighted('machine'), true);
eq('cable is weighted', isWeighted('cable'), true);
eq('body only is not', isWeighted('body only'), false);
eq('bodyonly (imported spelling) is not', isWeighted('bodyonly'), false);
eq('bands are not', isWeighted('bands'), false);
eq('BANDS uppercase is not', isWeighted('BANDS'), false);
// 288 rows carry no equipment. Assume loadable: a missing stepper on a barbell lift is worse than
// a spare one on a stretch.
eq('null equipment stays weighted', isWeighted(null), true);

// --- duration -------------------------------------------------------------------------------
eq('45s', formatDuration(45), '45s');
eq('5 min', formatDuration(300), '5 min');
eq('25 min', formatDuration(1500), '25 min');
eq('mixed', formatDuration(330), '5:30');
eq('one minute exactly', formatDuration(60), '1 min');

if (fails.length) {
  console.error(`FAIL (${fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('exercise-kind: PASS (23 assertions)');
