// The rest value that reaches the player must be seconds, whatever unit the row holds.
//
// session_exercises.rest_sec is named seconds and held MILLISECONDS on 1,454 of its 1,458 rows,
// because Lenus exports `restTime` in ms and the importer wrote it through. The player does
// setRest(value) and ticks once a second, so a set of banded squats opened a 20,000 second
// countdown: five and a half hours, audible timer never firing, mid-workout.
//
// Fixed in three places, and this pins the one that has to keep working when the other two are
// re-run: migration 0145 corrected the stored rows, the importer now divides, and this normalises
// on read so a future bad import cannot reach a member.
//
// Run: npx tsx .qa-visual/rest-normalize-test.mts
import { normalizeRestSeconds } from '../src/lib/workout/rest';

let failures = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  if (got === want) return;
  console.error(`  x ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  failures += 1;
};

// 1. The real distribution, taken from her library before 0145 ran. Every one of these is a sane
//    rest period that was being read 1000x too long.
eq('20000ms', normalizeRestSeconds(20000), 20);
eq('90000ms', normalizeRestSeconds(90000), 90);
eq('120000ms', normalizeRestSeconds(120000), 120);
eq('60000ms', normalizeRestSeconds(60000), 60);
eq('15000ms', normalizeRestSeconds(15000), 15);
eq('300000ms', normalizeRestSeconds(300000), 300);

// 2. The four rows that were genuinely seconds must pass through untouched. This is the assertion
//    that stops the fix from breaking the data it was not meant to touch.
eq('60s stays 60s', normalizeRestSeconds(60), 60);
eq('45s stays 45s', normalizeRestSeconds(45), 45);
eq('999 is still seconds', normalizeRestSeconds(999), 600); // clamped by the ceiling, not converted

// 3. The threshold itself.
eq('999 -> not divided', normalizeRestSeconds(999), 600);
eq('1000 -> divided', normalizeRestSeconds(1000), 1);

// 4. The ceiling. Nothing real is clipped (300000ms lands exactly on 300s), but a future bad import
//    cannot put a member into an hour-long countdown.
eq('3600000ms clamps', normalizeRestSeconds(3_600_000), 600);
eq('700s clamps', normalizeRestSeconds(700), 600);

// 5. Absent and nonsense both mean "no rest prescribed", never 0 or NaN in a countdown.
for (const bad of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
  eq(`${String(bad)} -> null`, normalizeRestSeconds(bad as number | null | undefined), null);
}

// 6. A sub-second millisecond value must not round to 0 and stall the timer at zero forever.
eq('400ms -> 400 (seconds-like, kept)', normalizeRestSeconds(400), 400);
eq('1400ms -> 1s', normalizeRestSeconds(1400), 1);

// 7. Idempotent. 0145 already converted the table, so the read path sees seconds now and must not
//    divide them again. Running the normaliser twice is the shape of that risk.
for (const v of [20, 90, 120, 300, 600]) {
  eq(`idempotent on ${v}`, normalizeRestSeconds(normalizeRestSeconds(v)), v);
}

console.log(failures ? `\nFAILED (${failures})` : '\nOK: rest normalises to seconds in every unit');
process.exit(failures ? 1 : 0);
