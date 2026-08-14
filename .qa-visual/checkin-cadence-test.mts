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

// --- report ----------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
