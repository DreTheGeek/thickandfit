// Boundary tests for coach assignment and coverage.
//
// The rule this file is arranged around: when the answer is unclear, return a PERSON, never
// nobody. A queue with nobody on it is the outage coverage exists to prevent, and on the screen it
// is indistinguishable from a queue with nothing in it. So a cycle (A covers B, B covers A — a
// data-entry mistake somebody will make in August) hands the work back to the assigned coach rather
// than dropping it, and so does a chain that runs past the hop cap.
//
// The dates are inclusive at both ends, because "back on the 20th" means the 19th is the last day
// away, and an off-by-one here silently un-covers a coach on the day she is still gone.
//
// Run: npx tsx .qa-visual/coverage-test.mts
import {
  effectiveCoach,
  isCoverageActive,
  isMine,
  coveringFor,
  isAway,
  MAX_COVERAGE_HOPS,
  type Coverage,
} from '../src/lib/coach/coverage-shared';

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

const cov = (coachId: string, coveringCoachId: string, startsOn: string, endsOn: string): Coverage => ({
  coachId,
  coveringCoachId,
  startsOn,
  endsOn,
});

const TODAY = '2026-08-19';

// --- the window, at every edge ------------------------------------------------
const week = cov('steph', 'dani', '2026-08-17', '2026-08-23');
check('the day before is not covered', isCoverageActive(week, '2026-08-16'), false);
check('the first day IS covered', isCoverageActive(week, '2026-08-17'), true);
check('mid-window is covered', isCoverageActive(week, TODAY), true);
// The one that matters: "back on the 24th" is stored as ends_on = the 23rd, so the 23rd is still away.
check('the last day IS covered', isCoverageActive(week, '2026-08-23'), true);
check('the day after is not', isCoverageActive(week, '2026-08-24'), false);
// A single-day cover is a real thing (one appointment) and must not resolve to an empty range.
check('a one-day cover works', isCoverageActive(cov('a', 'b', TODAY, TODAY), TODAY), true);

// --- assignment without coverage ----------------------------------------------
check('nobody assigned stays nobody', effectiveCoach(null, [], TODAY), null);
check('nobody assigned is unaffected by coverage', effectiveCoach(null, [week], TODAY), null);
check('assigned, nobody away, is herself', effectiveCoach('steph', [], TODAY), 'steph');
check('a coverage for someone else does not move her', effectiveCoach('lasean', [week], TODAY), 'lasean');
check('an expired coverage does not move her', effectiveCoach('steph', [week], '2026-09-01'), 'steph');
check('a future coverage does not move her yet', effectiveCoach('steph', [week], '2026-08-01'), 'steph');

// --- one hop ------------------------------------------------------------------
check('an active coverage hands her over', effectiveCoach('steph', [week], TODAY), 'dani');

// --- chains -------------------------------------------------------------------
// Two coaches away in the same week is a normal August, not an exotic case.
const chain = [cov('steph', 'dani', '2026-08-17', '2026-08-23'), cov('dani', 'lasean', '2026-08-18', '2026-08-25')];
check('the chain is followed through', effectiveCoach('steph', chain, TODAY), 'lasean');
// The second link is not active yet, so the chain stops at the first.
check(
  'a chain stops where the next link is not active',
  effectiveCoach('steph', [chain[0], cov('dani', 'lasean', '2026-09-01', '2026-09-05')], TODAY),
  'dani',
);

// --- the cycle, which is the whole point --------------------------------------
const cycle = [cov('steph', 'dani', '2026-08-17', '2026-08-23'), cov('dani', 'steph', '2026-08-17', '2026-08-23')];
check('a two-coach cycle hands the work back to the owner', effectiveCoach('steph', cycle, TODAY), 'steph');
ok('a cycle never resolves to nobody', effectiveCoach('steph', cycle, TODAY) !== null);
const triangle = [
  cov('a', 'b', '2026-08-17', '2026-08-23'),
  cov('b', 'c', '2026-08-17', '2026-08-23'),
  cov('c', 'a', '2026-08-17', '2026-08-23'),
];
check('a three-coach cycle also lands on the owner', effectiveCoach('a', triangle, TODAY), 'a');
ok('a three-coach cycle never resolves to nobody', effectiveCoach('a', triangle, TODAY) !== null);

// --- the hop cap ---------------------------------------------------------------
// A chain longer than the cap is not a cycle, but it is past anything real. Same answer, same
// reason: a person, not nobody.
const longChain: Coverage[] = [];
for (let i = 0; i < MAX_COVERAGE_HOPS + 2; i += 1) {
  longChain.push(cov(`c${i}`, `c${i + 1}`, '2026-08-17', '2026-08-23'));
}
ok('a chain past the cap returns the owner, not nobody', effectiveCoach('c0', longChain, TODAY) !== null);
check('a chain past the cap returns the owner', effectiveCoach('c0', longChain, TODAY), 'c0');
// One hop under the cap must still resolve all the way through, or the cap is too tight to be useful.
const atCap: Coverage[] = [];
for (let i = 0; i < MAX_COVERAGE_HOPS; i += 1) {
  atCap.push(cov(`d${i}`, `d${i + 1}`, '2026-08-17', '2026-08-23'));
}
check('a chain exactly at the cap resolves', effectiveCoach('d0', atCap, TODAY), `d${MAX_COVERAGE_HOPS}`);

// --- overlapping rows for one coach are deterministic --------------------------
// Two live arrangements for the same coach is a mistake the UI should stop, but the queue must not
// flicker between two answers on two loads of the same screen while somebody sorts it out.
const overlap = [cov('steph', 'dani', '2026-08-17', '2026-08-23'), cov('steph', 'lasean', '2026-08-18', '2026-08-25')];
check('overlapping coverage picks the first deterministically', effectiveCoach('steph', overlap, TODAY), 'dani');
check('and picks the same one again', effectiveCoach('steph', overlap, TODAY), 'dani');

// --- isMine --------------------------------------------------------------------
check('an assigned member is her coach&apos;s', isMine('steph', 'steph', [], TODAY), true);
check('and not another coach&apos;s', isMine('steph', 'dani', [], TODAY), false);
check('while covered she is the cover&apos;s', isMine('steph', 'dani', [week], TODAY), true);
check('and no longer the away coach&apos;s', isMine('steph', 'steph', [week], TODAY), false);
// The default state of every migrating member: assigned to nobody. She belongs to the company, so
// she is nobody's in particular — which is why the queues default to showing everyone.
check('an unassigned member is nobody&apos;s', isMine(null, 'steph', [], TODAY), false);

// --- the banner -----------------------------------------------------------------
check('nobody is covering by default', coveringFor('dani', [], TODAY), []);
check('the cover is told whose work she holds', coveringFor('dani', [week], TODAY), ['steph']);
check('the away coach is not told she is covering', coveringFor('steph', [week], TODAY), []);
check(
  'two absences are both named',
  coveringFor('dani', [week, cov('lasean', 'dani', '2026-08-18', '2026-08-25')], TODAY),
  ['steph', 'lasean'],
);
check(
  'the same coach is named once',
  coveringFor('dani', [week, cov('steph', 'dani', '2026-08-18', '2026-08-25')], TODAY),
  ['steph'],
);
check('an expired arrangement is not announced', coveringFor('dani', [week], '2026-09-01'), []);

// --- isAway ----------------------------------------------------------------------
check('a coach with no arrangement is here', isAway('steph', [], TODAY), false);
check('a coach with a live arrangement is away', isAway('steph', [week], TODAY), true);
check('the cover is not away', isAway('dani', [week], TODAY), false);
check('an expired arrangement means she is back', isAway('steph', [week], '2026-09-01'), false);

// --- report ------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
