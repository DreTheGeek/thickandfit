// Check-in cadence: the settings-to-days maths, and the local weekday/hour gate.
//
// Until 2026-08-14 the check-in generator used a hardcoded 7 days and ignored all seven
// coach_settings columns built for this in migration 0115. Stephanie runs check-ins every TWO weeks,
// so the hardcode was about to prompt 256 women at twice her real cadence — a settings screen that
// already had the right answer typed into it, wired to nothing.
//
// The gate is where the off-by-ones live. reminder_weekday is 0=Sunday (matching JS getDay, Postgres
// extract(dow) and the column), reminder_time_local is wall-clock in HER zone, and both are wrong in
// a way nobody notices until a member in Guadalajara gets her Monday prompt on Sunday night.
//
// Run: npx tsx .qa-visual/checkin-cadence-test.mts
import {
  checkinCadenceDays,
  followUpDays,
  isCheckinDue,
  reminderHourOf,
  DEFAULT_COACH_SETTINGS,
  FOLLOW_UP_OPTIONS,
} from '../src/lib/coach/settings-shared';
import { localWeekday, localHour, localDay } from '../src/lib/datetime/local-day';

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

// --- cadence --------------------------------------------------------------------
check('weekly is 7 days', checkinCadenceDays(1, 'week'), 7);
// The number this whole change exists for.
check('HER cadence, every 2 weeks, is 14 days', checkinCadenceDays(2, 'week'), 14);
check('every 3 weeks is 21', checkinCadenceDays(3, 'week'), 21);
check('monthly is 30 days', checkinCadenceDays(1, 'month'), 30);
check('every 2 months is 60', checkinCadenceDays(2, 'month'), 60);
check('the CHECK ceiling, 12 weeks', checkinCadenceDays(12, 'week'), 84);

// Garbage in must not become a zero-day cadence, which would send a check-in prompt every hour.
check('zero clamps to one period', checkinCadenceDays(0, 'week'), 7);
check('negative clamps to one period', checkinCadenceDays(-5, 'week'), 7);
check('above the CHECK ceiling clamps to 12', checkinCadenceDays(99, 'week'), 84);
check('fractional floors', checkinCadenceDays(2.9, 'week'), 14);
check('NaN falls back to one period', checkinCadenceDays(Number.NaN, 'week'), 7);

// --- follow-up windows ------------------------------------------------------------
// 'none' means the coach wants no reminder. Turning it into a default is the one mistake that
// would send unasked-for messages in Stephanie's name.
check('none is null, never a number', followUpDays('none'), null);
check('three_days', followUpDays('three_days'), 3);
check('one_week — the window she asked for', followUpDays('one_week'), 7);
check('two_weeks', followUpDays('two_weeks'), 14);
check('one_month', followUpDays('one_month'), 30);
check('three_months', followUpDays('three_months'), 90);
// Every option in the vocabulary must map, or a valid setting silently means "no reminder".
for (const opt of FOLLOW_UP_OPTIONS) {
  const days = followUpDays(opt);
  ok(`${opt} maps to something deliberate`, opt === 'none' ? days === null : typeof days === 'number');
}

// --- reminder time ----------------------------------------------------------------
check('the column default, 18:00', reminderHourOf('18:00'), 18);
check('midnight', reminderHourOf('00:00'), 0);
check('single-digit hour', reminderHourOf('7:30'), 7);
check('23:59 is hour 23', reminderHourOf('23:59'), 23);
// Anything unparseable must land on a real hour, not NaN — a NaN hour never equals localHour, so
// the reminder would silently never fire and look identical to the feature being switched off.
check('empty falls back to 18', reminderHourOf(''), 18);
check('garbage falls back to 18', reminderHourOf('evening'), 18);
check('out of range falls back to 18', reminderHourOf('99:00'), 18);

// --- the local weekday gate ---------------------------------------------------------
// 0 = Sunday, matching JS getDay(), Postgres extract(dow) and coach_settings.reminder_weekday.
// 2026-08-16 is a Sunday.
const sundayNoonUtc = new Date('2026-08-16T12:00:00Z');
check('Sunday is 0 in UTC', localWeekday('UTC', sundayNoonUtc), 0);
check('Monday is 1', localWeekday('UTC', new Date('2026-08-17T12:00:00Z')), 1);
check('Saturday is 6', localWeekday('UTC', new Date('2026-08-22T12:00:00Z')), 6);

// The case the gate exists for. 23:00 Sunday in Guadalajara is already Monday 05:00 UTC, so a
// server-side weekday would prompt her a day early, every single cycle.
const lateSunday = new Date('2026-08-17T04:00:00Z'); // Mon 04:00 UTC = Sun 22:00 in Guadalajara
check('still Sunday where she lives', localWeekday('America/Mexico_City', lateSunday), 0);
check('already Monday in UTC', localWeekday('UTC', lateSunday), 1);
ok(
  'the two disagree, which is the entire point of reading her timezone',
  localWeekday('America/Mexico_City', lateSunday) !== localWeekday('UTC', lateSunday),
);

// Same instant, four zones: the hour gate has to move with her too. Mexico abolished DST in 2022,
// so America/Mexico_City is UTC-6 all year while Los Angeles is on UTC-7 in August — the two are an
// hour apart in summer and would be two apart under the old rules. Hardcoding an offset instead of
// asking Intl is how a reminder lands an hour off for half the roster for half the year.
const evening = new Date('2026-08-17T23:00:00Z');
check('23:00 UTC', localHour('UTC', evening), 23);
check('is 17:00 in Mexico City (UTC-6, no DST since 2022)', localHour('America/Mexico_City', evening), 17);
check('is 16:00 in Los Angeles (PDT)', localHour('America/Los_Angeles', evening), 16);
check('is 19:00 in New York (EDT)', localHour('America/New_York', evening), 19);
// A coach who sets 18:00 reaches Bogota on this tick and nobody else here, which is the design: one
// hourly cron tick, a different slice of the roster each time.
check('is 18:00 in Bogota', localHour('America/Bogota', evening), 18);
ok(
  'one hourly tick reaches exactly the zones where it is 18:00',
  localHour('America/Bogota', evening) === 18 && localHour('America/Mexico_City', evening) !== 18,
);

// A bad IANA name must not THROW. profiles.timezone is free text written from a browser guess, and
// Intl.DateTimeFormat raises on an unrecognised zone — inside a roster sweep that ends the run, so
// one member with a mistyped zone silently costs every member after her their reminder. Found by
// this test on 2026-08-14; resolveTimezone now validates and falls back.
for (const bad of ['Not/AZone', 'EST5EDT_typo', 'america/new_york ', '???']) {
  ok(`${bad} does not throw`, Number.isInteger(localWeekday(bad, evening)));
  ok(`${bad} does not throw in localHour`, Number.isInteger(localHour(bad, evening)));
  ok(`${bad} does not throw in localDay`, /^\d{4}-\d{2}-\d{2}$/.test(localDay(bad, evening)));
}
ok('a null timezone still returns a weekday', Number.isInteger(localWeekday(null, evening)));
ok('weekday is always 0..6', [0, 1, 2, 3, 4, 5, 6].includes(localWeekday(null, evening)));
// The fallback must be the app default, not UTC: a bad zone should behave like an unset one.
check('a bad zone falls back to the app default', localHour('Not/AZone', evening), localHour(null, evening));

// Weekday and day must describe the same date, or the gate and the dedupe disagree.
for (const tz of ['UTC', 'America/New_York', 'America/Mexico_City', 'America/Bogota']) {
  const day = localDay(tz, lateSunday);
  const wd = localWeekday(tz, lateSunday);
  const expected = new Date(`${day}T12:00:00Z`).getUTCDay();
  check(`${tz}: weekday agrees with localDay`, wd, expected);
}

// --- the shipped default -------------------------------------------------------------
// Off by default is the column default in 0115, not a decision made in the generator. A coach who
// never opened the settings screen must not have messages sent in her name.
check('check-in reminders ship OFF', DEFAULT_COACH_SETTINGS.isCheckinReminderOn, false);
check('default cadence is weekly', checkinCadenceDays(DEFAULT_COACH_SETTINGS.reminderEvery, DEFAULT_COACH_SETTINGS.reminderPeriod), 7);
check('default send time is 18:00', reminderHourOf(DEFAULT_COACH_SETTINGS.reminderTimeLocal), 18);
check('default weekday is Monday', DEFAULT_COACH_SETTINGS.reminderWeekday, 1);
check('follow-ups ship off too', followUpDays(DEFAULT_COACH_SETTINGS.trainingFollowup), null);

// --- the send decision -------------------------------------------------------------------
// The half that decides whether 256 women get a message they did not need. Found three defects in
// the first version of this by reading it back: a member holding two check-in forms was double
// notified every cycle, "skip when done" did nothing when switched OFF, and a monthly cadence
// silently became five-weekly because the weekday gate quantizes sending to whole weeks.
const T0 = 1_786_000_000_000;
const days = (n: number): number => n * 86_400_000;
const due = (over: Partial<Parameters<typeof isCheckinDue>[0]> = {}): boolean =>
  isCheckinDue({
    lastSentAt: null,
    answeredAt: null,
    cadenceDays: 14,
    skipWhenDone: true,
    skipDays: 7,
    now: T0,
    ...over,
  });

check('never reminded, never answered: send', due(), true);

// Cadence, at her bi-weekly setting.
check('reminded yesterday: hold', due({ lastSentAt: T0 - days(1) }), false);
check('reminded a week ago on a 2-week cadence: hold', due({ lastSentAt: T0 - days(7) }), false);
check('reminded 14 days ago: send', due({ lastSentAt: T0 - days(14) }), true);
check('reminded 21 days ago: send', due({ lastSentAt: T0 - days(21) }), true);

// The weekday gate only fires on one weekday, so reachable gaps are multiples of 7. A monthly
// cadence must land on 28, not be pushed out to 35 by demanding the full 30.
check('monthly at 28 days sends, not 35', due({ cadenceDays: 30, lastSentAt: T0 - days(28) }), true);
check('monthly at 21 days still holds', due({ cadenceDays: 30, lastSentAt: T0 - days(21) }), false);
// 60 days rounds the other way: 63 is nearer than 56, so 56 must hold.
check('two-monthly at 56 days holds', due({ cadenceDays: 60, lastSentAt: T0 - days(56) }), false);
check('two-monthly at 63 days sends', due({ cadenceDays: 60, lastSentAt: T0 - days(63) }), true);
// Weekly must not be loosened into "any time after 3.5 days".
check('weekly at 3 days holds', due({ cadenceDays: 7, lastSentAt: T0 - days(3) }), false);
check('weekly at 7 days sends', due({ cadenceDays: 7, lastSentAt: T0 - days(7) }), true);

// Skip-when-done, ON: reminding her to do a thing she just did teaches her to ignore reminders.
check('answered yesterday: hold', due({ answeredAt: T0 - days(1) }), false);
check('answered 6 days ago, 7-day skip: hold', due({ answeredAt: T0 - days(6) }), false);
check('answered exactly 7 days ago: send', due({ answeredAt: T0 - days(7) }), true);
check('answered 30 days ago: send', due({ answeredAt: T0 - days(30) }), true);

// Skip-when-done, OFF. The checkbox says "do not skip", so it must SEND regardless of her answer —
// the cadence gate is what stops that from becoming spam. Reading OFF as "skip on a different
// window" made the switch do nothing at all, which is what the first version did.
check('skip OFF, answered yesterday: SEND anyway', due({ skipWhenDone: false, answeredAt: T0 - days(1) }), true);
check('skip OFF, answered today: SEND anyway', due({ skipWhenDone: false, answeredAt: T0 }), true);
// ...but the cadence still governs, or "do not skip" would mean "send every hour".
check(
  'skip OFF does not defeat the cadence',
  due({ skipWhenDone: false, answeredAt: T0, lastSentAt: T0 - days(2) }),
  false,
);

// Cadence outranks completion in the other direction too: recently reminded holds even if she has
// never answered, or a missed cron catch-up would fire twice in a week.
check('recently reminded and never answered: still holds', due({ lastSentAt: T0 - days(2) }), false);

// A zero or negative cadence must not turn into "send on every tick".
check('a zero cadence still respects skip-when-done', due({ cadenceDays: 0, answeredAt: T0 }), false);
ok('a zero cadence with nothing answered sends', due({ cadenceDays: 0 }) === true);

// --- report ----------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
