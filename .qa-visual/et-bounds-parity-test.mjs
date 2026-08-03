// ET day-boundary parity: the Vercel implementation vs the Deno one, over every hour of a year.
//
// The recap moved to a Supabase edge function, and the one piece of it that is genuinely dangerous to
// port is the DST arithmetic. Getting it wrong is INVISIBLE for months: identical output all summer,
// then every recap is silently an hour off from the first Sunday in November. So this does not just
// diff the two implementations, it checks both against ground truth, because "the port matches the
// original" is worthless if the original was wrong.
//
// GROUND TRUTH: `sinceIso` is correct when, rendered back in America/New_York, it reads exactly
// `etDate 00:00:00`. That is the definition of "midnight ET", independent of either implementation.

// --- the Vercel original (toLocaleString round-trip) ---------------------------------------------
function oldEtMidnightAsUtc(etDate) {
  const naive = new Date(`${etDate}T00:00:00Z`);
  const asEt = new Date(naive.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(naive.getTime() + (asUtc.getTime() - asEt.getTime()));
}

// --- the Deno port (formatToParts, no re-parsing of localized output) ----------------------------
function etOffsetMs(at) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return asIfUtc - at.getTime();
}

function newEtMidnightAsUtc(etDate) {
  const guess = new Date(`${etDate}T00:00:00Z`).getTime();
  const once = guess - etOffsetMs(new Date(guess));
  return new Date(guess - etOffsetMs(new Date(once)));
}

// --- shared front half (identical in both) --------------------------------------------------------
function etParts(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { etDate: `${parts.year}-${parts.month}-${parts.day}`, etHour: Number(parts.hour) % 24 };
}

const bounds = (mid) => (now) => {
  const { etDate, etHour } = etParts(now);
  return { sinceIso: mid(etDate).toISOString(), etDate, etHour };
};
const oldBounds = bounds(oldEtMidnightAsUtc);
const newBounds = bounds(newEtMidnightAsUtc);

// --- ground truth ---------------------------------------------------------------------------------
const WALL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
function wallClockEt(iso) {
  return WALL.format(new Date(iso)).replace(/ | /g, ' ');
}
function isMidnightOf(iso, etDate) {
  const w = wallClockEt(iso);
  return w === `${etDate}, 00:00:00` || w === `${etDate}, 24:00:00`;
}

// --- sweep ----------------------------------------------------------------------------------------
// Every hour of 2026 (8760 samples) covers both transitions: Mar 8 and Nov 1.
const START = Date.UTC(2026, 0, 1, 0, 0, 0);
const HOURS = 366 * 24;

let checked = 0;
const disagree = [];
const oldWrong = [];
const newWrong = [];

for (let h = 0; h < HOURS; h++) {
  const now = new Date(START + h * 3_600_000);
  const a = oldBounds(now);
  const b = newBounds(now);
  checked++;

  if (a.sinceIso !== b.sinceIso || a.etDate !== b.etDate || a.etHour !== b.etHour) {
    if (disagree.length < 8) disagree.push({ at: now.toISOString(), old: a.sinceIso, neu: b.sinceIso, etDate: a.etDate });
  }
  if (!isMidnightOf(a.sinceIso, a.etDate)) {
    if (oldWrong.length < 8) oldWrong.push({ at: now.toISOString(), etDate: a.etDate, got: wallClockEt(a.sinceIso) });
  }
  if (!isMidnightOf(b.sinceIso, b.etDate)) {
    if (newWrong.length < 8) newWrong.push({ at: now.toISOString(), etDate: b.etDate, got: wallClockEt(b.sinceIso) });
  }
}

// --- the two DST days, spelled out --------------------------------------------------------------
// Included explicitly because a sweep that happened to skip them would still print a green result.
const SPOT = [
  ['2026-03-08T04:00:00Z', 'spring forward, 11pm ET Mar 7'],
  ['2026-03-08T07:30:00Z', 'spring forward, inside the lost hour'],
  ['2026-03-09T01:00:00Z', 'day after spring forward'],
  ['2026-11-01T04:30:00Z', 'fall back, first pass of 12:30am'],
  ['2026-11-01T05:30:00Z', 'fall back, second pass of 12:30am'],
  ['2026-11-02T02:00:00Z', 'day after fall back'],
  ['2026-07-15T23:00:00Z', 'mid-summer, 7pm ET'],
  ['2026-01-15T02:00:00Z', 'mid-winter, 9pm ET prior day'],
];

console.log('ET day bounds: old (Vercel) vs new (Deno)\n');
for (const [iso, label] of SPOT) {
  const now = new Date(iso);
  const a = oldBounds(now);
  const b = newBounds(now);
  const same = a.sinceIso === b.sinceIso && a.etHour === b.etHour;
  const truth = isMidnightOf(b.sinceIso, b.etDate);
  console.log(
    `  ${same && truth ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} etDate=${b.etDate} hour=${String(b.etHour).padStart(2)} -> ${wallClockEt(b.sinceIso)}`,
  );
}

console.log(`\nswept ${checked} hours of 2026`);
console.log(`  implementations disagree: ${disagree.length}`);
console.log(`  old impl wrong vs truth:  ${oldWrong.length}`);
console.log(`  new impl wrong vs truth:  ${newWrong.length}`);

for (const d of disagree) console.log(`    DIFF ${d.at} etDate=${d.etDate} old=${d.old} new=${d.neu}`);
for (const d of oldWrong) console.log(`    OLD-WRONG ${d.at} wanted ${d.etDate} 00:00:00, got ${d.got}`);
for (const d of newWrong) console.log(`    NEW-WRONG ${d.at} wanted ${d.etDate} 00:00:00, got ${d.got}`);

// The new implementation being correct is the bar. Parity is reported, but if the OLD one turns out
// to be wrong somewhere, that is a finding to act on, not a reason to fail the port.
if (newWrong.length > 0) {
  console.log('\nFAILED: the Deno port does not land on ET midnight.');
  process.exit(1);
}
console.log('\nPASS: the Deno port lands on ET midnight for every hour of the year.');
