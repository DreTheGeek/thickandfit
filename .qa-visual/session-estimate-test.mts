// Boundary tests for the session time estimate on the workout preview.
//
// The number itself is a guess (it assumes a tempo, which nobody can know) and the screen says so.
// What must NOT be a guess is the arithmetic around it, and it carries one classic off-by-one: rest
// happens BETWEEN sets, so three sets rest twice, not three times. Getting that wrong inflates every
// session by one rest period per movement, which on a twelve-movement day is twelve minutes of
// invented time on a screen she is using to decide whether she can fit the workout in.
//
// Run: npx tsx .qa-visual/session-estimate-test.mts
import { estimateSession, type PreviewExercise } from '../src/components/workout/session-preview';

let failures = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  if (JSON.stringify(got) === JSON.stringify(want)) return;
  console.error(`  x ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  failures += 1;
};

const ex = (o: Partial<PreviewExercise>): PreviewExercise => ({
  exercise_id: 'x',
  name: 'x',
  sets: null,
  reps: null,
  repsMin: null,
  repsMax: null,
  restSec: null,
  equipment: null,
  hasDemo: false,
  groupKey: null,
  groupKind: null,
  ...o,
});

// 1. Rest is BETWEEN sets. 3x10 at 4s/rep = 120s active; rest fires twice, not three times.
//    120 + 2*60 = 240s = 4min -> rounds to 5. Active 120s = 2min -> rounds to 5 (the floor).
eq('3x10, 60s rest', estimateSession([ex({ sets: 3, reps: 10, restSec: 60 })]), {
  activeMin: 5,
  totalMin: 5,
});

// 2. A SINGLE set rests zero times. If rest were counted per-set this would add 300s.
eq('1 set never rests', estimateSession([ex({ sets: 1, reps: 10, restSec: 300 })]), {
  activeMin: 5,
  totalMin: 5,
});

// 3. Big enough to leave the rounding floor and show the two figures diverging.
//    5 movements x 4 sets x 10 reps x 4s = 800s active (13.3min -> 15).
//    rest 5 x 3 x 90 = 1350s. total 2150s = 35.8min -> 35.
const five = Array.from({ length: 5 }, () => ex({ sets: 4, reps: 10, restSec: 90 }));
eq('5 movements, rest dominates', estimateSession(five), { activeMin: 15, totalMin: 35 });

// 4. A rep RANGE estimates at its top: the plan says 8-10 and finishing the set is 10.
eq(
  'range uses the ceiling',
  estimateSession([ex({ sets: 4, repsMin: 8, repsMax: 10, restSec: 60 })]),
  estimateSession([ex({ sets: 4, reps: 10, restSec: 60 })]),
);

// 5. Missing prescription must not produce 0 or NaN: an untracked movement still costs time.
const bare = estimateSession([ex({})]);
if (!Number.isFinite(bare.totalMin) || bare.totalMin <= 0) {
  console.error(`  x bare exercise produced ${JSON.stringify(bare)}`);
  failures += 1;
}

// 6. An empty session is 0 movements but must still return the floor rather than NaN.
const none = estimateSession([]);
if (!Number.isFinite(none.totalMin)) {
  console.error(`  x empty session produced ${JSON.stringify(none)}`);
  failures += 1;
}

// 7. Total is never less than active. Any ordering bug between the two shows up here.
for (const [label, list] of [
  ['single', [ex({ sets: 3, reps: 12, restSec: 45 })]],
  ['mixed', [ex({ sets: 1, reps: 20 }), ex({ sets: 5, reps: 5, restSec: 120 })]],
] as const) {
  const r = estimateSession([...list]);
  if (r.totalMin < r.activeMin) {
    console.error(`  x ${label}: total ${r.totalMin} < active ${r.activeMin}`);
    failures += 1;
  }
}

console.log(failures ? `\nFAILED (${failures})` : '\nOK: session estimate arithmetic holds');
process.exit(failures ? 1 : 0);
