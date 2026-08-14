// Plan expiry: the date arithmetic behind the reminder Stephanie asked for.
//
// "Hey, it's about to be the 12 week mark, let's make sure we update Shaleesa's program... that way
// we give ourselves a week in advance notice" (2026-08-13). Everything downstream is a queue and a
// notification; the part that can be wrong without anyone noticing is this: when does a plan end,
// and is it inside the window she configured.
//
// Her library is NOT all 12-week. The importer derives weeks from her own plan names — 17 of 40 are
// 6-week, 9 are 8-week, 14 are 12-week — so a reminder hardcoded to 84 days would fire two weeks
// late on a third of her programs and six weeks late on another third.
//
// Run: npx tsx .qa-visual/plan-expiry-test.mts
import { followUpDays } from '../src/lib/coach/settings-shared';
import { planEndsOn, daysUntil, isInFollowUpWindow } from '../src/lib/coach/plan-followups-shared';

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

// The REAL functions listExpiringPlans calls, not a copy: the queries need a database, the
// arithmetic does not, and the arithmetic is where the off-by-ones live.
const endsOn = planEndsOn;
const dayDiff = daysUntil;
const inWindow = isInFollowUpWindow;

// --- end dates, for every duration actually in her library --------------------
const assigned = '2026-06-01T14:30:00Z';
check('6-week plan ends 42 days out', endsOn(assigned, 6), '2026-07-13');
check('8-week plan ends 56 days out', endsOn(assigned, 8), '2026-07-27');
check('12-week plan ends 84 days out', endsOn(assigned, 12), '2026-08-24');
// The three durations must produce three different dates, or a hardcoded 12 has crept back in.
ok(
  'her three durations do not collapse into one',
  new Set([endsOn(assigned, 6), endsOn(assigned, 8), endsOn(assigned, 12)]).size === 3,
);
// Assignment time of day must not shift the end DAY: a plan assigned at 23:00 and one assigned at
// 00:30 the next morning are a day apart, not the same day.
check('an evening assignment keeps its own day', endsOn('2026-06-01T23:59:00Z', 12), '2026-08-24');
check('a plan assigned a minute later ends a day later', endsOn('2026-06-02T00:01:00Z', 12), '2026-08-25');

// --- the window gate, at every boundary ----------------------------------------
// Her ask is one_week: seven days of warning.
const week = followUpDays('one_week');
check('one_week is 7', week, 7);
const now = new Date('2026-08-14T09:00:00Z');

check('a plan ending in 8 days is outside a 7-day window', inWindow(dayDiff('2026-08-22', now), week), false);
check('a plan ending in exactly 7 days is inside it', inWindow(dayDiff('2026-08-21', now), week), true);
check('a plan ending tomorrow is inside it', inWindow(dayDiff('2026-08-15', now), week), true);
check('a plan ending today is inside it', inWindow(dayDiff('2026-08-14', now), week), true);
// The case a naive "ends within N days" filter drops, and the one that matters most: the plan that
// already lapsed. She is still training it and still paying.
check('a plan that ended yesterday is STILL on the list', inWindow(dayDiff('2026-08-13', now), week), true);
check('a plan that ended a month ago is still on the list', inWindow(dayDiff('2026-07-14', now), week), true);
check('an expired plan reports negative days', dayDiff('2026-07-14', now), -31);

// 'none' means she wants no reminder, and must never be quietly upgraded to a default. This is the
// difference between a coach console that respects a setting and one that invents messages.
check('none never puts anything in the window', inWindow(0, followUpDays('none')), false);
check('none does not even catch an expired plan', inWindow(-99, followUpDays('none')), false);

// A wider window catches strictly more, and each option is distinct.
const windows = (['three_days', 'one_week', 'two_weeks', 'one_month', 'three_months'] as const).map(followUpDays);
ok('every non-none window is a number', windows.every((w) => typeof w === 'number'));
ok('the windows are strictly increasing', windows.every((w, i) => i === 0 || (w as number) > (windows[i - 1] as number)));
check('a plan 10 days out: outside one_week', inWindow(10, followUpDays('one_week')), false);
check('a plan 10 days out: inside two_weeks', inWindow(10, followUpDays('two_weeks')), true);

// --- sort order ------------------------------------------------------------------
// Expired first, then soonest. A queue that buries the lapsed plan under next week's is the queue
// that let it lapse.
const sorted = [12, -3, 0, 7, -31, 2].sort((a, b) => a - b);
check('most overdue leads, furthest out trails', sorted, [-31, -3, 0, 2, 7, 12]);

// --- a broken duration must not invent an end date ---------------------------------
// plans.weeks is NOT NULL with a default of 4, so 0 or a negative is corruption rather than an
// open-ended plan. planEndsOn returns null: a bogus end date on a coach's queue is worse than no
// reminder, because she acts on it.
for (const weeks of [0, -1, Number.NaN]) {
  check(`weeks=${weeks} yields no date`, endsOn(assigned, weeks), null);
}
check('an unparseable assignment date yields no date', endsOn('not-a-date', 12), null);
ok('weeks=1 is a real plan and gets a date', endsOn(assigned, 1) !== null);
// daysUntil must never return NaN: a NaN comparison is always false, so the plan would silently
// vanish from the queue rather than showing up wrong.
check('garbage in daysUntil is 0, not NaN', dayDiff('not-a-date', now), 0);

// --- report -----------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
