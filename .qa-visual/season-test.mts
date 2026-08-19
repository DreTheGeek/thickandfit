// Boundary tests for the seasonal calendar.
//
// THE WRAP-AROUND IS THE POINT. The most valuable window in this business runs 26 December to 5
// January, and the obvious `start <= today && today <= end` is FALSE on every day it should be
// true. A December save campaign written that way fires on none of the days people actually cancel,
// and the failure is indistinguishable from nobody having written a campaign.
//
// The second trap is the dedupe year: for a wrapping window the January days belong to the season
// that started in December, or a member gets the same message on 30 December and again on 2
// January — the same shape as the day-28 resend.
//
// Run: npx tsx .qa-visual/season-test.mts
import {
  isSeasonActive,
  seasonYear,
  isMonthDay,
  activeCampaigns,
  selectCampaignRecipients,
  campaignHistoryKey,
  isCampaignAudience,
  DEFAULT_MIN_TENURE_DAYS,
  type CampaignRow,
  type CampaignMember,
} from '../src/lib/campaigns/season-shared';

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

// --- a normal, non-wrapping window ---------------------------------------------
const JAN = ['01-02', '01-31'] as const;
check('the day before is out', isSeasonActive(JAN[0], JAN[1], '2027-01-01'), false);
check('the first day is in', isSeasonActive(JAN[0], JAN[1], '2027-01-02'), true);
check('mid-window is in', isSeasonActive(JAN[0], JAN[1], '2027-01-15'), true);
check('the last day is in', isSeasonActive(JAN[0], JAN[1], '2027-01-31'), true);
check('the day after is out', isSeasonActive(JAN[0], JAN[1], '2027-02-01'), false);
check('a different month is out', isSeasonActive(JAN[0], JAN[1], '2027-07-15'), false);

// --- THE WRAP-AROUND -------------------------------------------------------------
const NY = ['12-26', '01-05'] as const;
check('christmas eve is out', isSeasonActive(NY[0], NY[1], '2026-12-24'), false);
check('boxing day is IN', isSeasonActive(NY[0], NY[1], '2026-12-26'), true);
check('new year eve is IN', isSeasonActive(NY[0], NY[1], '2026-12-31'), true);
check('new year day is IN', isSeasonActive(NY[0], NY[1], '2027-01-01'), true);
check('the fifth is IN', isSeasonActive(NY[0], NY[1], '2027-01-05'), true);
check('the sixth is out', isSeasonActive(NY[0], NY[1], '2027-01-06'), false);
check('mid-year is out', isSeasonActive(NY[0], NY[1], '2027-06-15'), false);
// A one-day season is a real thing (a launch date) and must not read as an empty range.
check('a single-day season works', isSeasonActive('03-08', '03-08', '2027-03-08'), true);
check('and only on that day', isSeasonActive('03-08', '03-08', '2027-03-09'), false);
// A window covering the whole year.
check('a year-long window is always on', isSeasonActive('01-01', '12-31', '2027-08-19'), true);

// --- leap day ---------------------------------------------------------------------
// A February window must include the 29th in a leap year, and the comparison is textual so it does
// so without knowing anything about leap years.
check('feb 29 is inside a february window', isSeasonActive('02-01', '02-29', '2028-02-29'), true);
check('feb 29 is inside a shorter window too', isSeasonActive('02-15', '03-05', '2028-02-29'), true);

// --- malformed input fails CLOSED --------------------------------------------------
// A campaign with a bad window must send to nobody rather than to everybody.
check('a bad start sends to nobody', isSeasonActive('13-01', '01-05', '2027-01-01'), false);
check('a bad end sends to nobody', isSeasonActive('12-26', '00-99', '2027-01-01'), false);
check('an empty window sends to nobody', isSeasonActive('', '', '2027-01-01'), false);
check('a bad today sends to nobody', isSeasonActive('01-02', '01-31', 'not-a-date'), false);
check('MM-DD validation rejects a month of 13', isMonthDay('13-01'), false);
check('MM-DD validation rejects a day of 32', isMonthDay('01-32'), false);
check('MM-DD validation accepts feb 29', isMonthDay('02-29'), true);
check('MM-DD validation rejects a full date', isMonthDay('2027-01-02'), false);

// --- the dedupe year ----------------------------------------------------------------
check('a normal window uses this year', seasonYear('01-02', '01-31', '2027-01-15'), 2027);
check('the december side of a wrap is this year', seasonYear('12-26', '01-05', '2026-12-31'), 2026);
// The regression: without this, one member gets the same message on 30 December and 2 January.
check('the january side of a wrap belongs to LAST year', seasonYear('12-26', '01-05', '2027-01-02'), 2026);
ok(
  'both sides of one wrap agree on the year',
  seasonYear('12-26', '01-05', '2026-12-31') === seasonYear('12-26', '01-05', '2027-01-02'),
);
// And next December is a different run, so she hears from it again.
ok(
  'the next december is a different run',
  seasonYear('12-26', '01-05', '2027-12-28') !== seasonYear('12-26', '01-05', '2026-12-28'),
);

// --- activeCampaigns -----------------------------------------------------------------
const camp = (over: Partial<CampaignRow> = {}): CampaignRow => ({
  id: 'c1',
  key: 'december-save',
  startsMd: '12-26',
  endsMd: '01-05',
  audience: 'all',
  minTenureDays: DEFAULT_MIN_TENURE_DAYS,
  isActive: true,
  ...over,
});
const keys = (rows: CampaignRow[]): string[] => rows.map((r) => r.key);

check('an inactive campaign never fires', keys(activeCampaigns([camp({ isActive: false })], '2026-12-31')), []);
check('an active in-window campaign fires', keys(activeCampaigns([camp()], '2026-12-31')), ['december-save']);
check('an active out-of-window campaign does not', keys(activeCampaigns([camp()], '2026-07-01')), []);
check(
  'several can be in force at once',
  keys(
    activeCampaigns(
      [camp(), camp({ id: 'c2', key: 'new-year', startsMd: '12-28', endsMd: '01-10' })],
      '2026-12-31',
    ),
  ),
  ['december-save', 'new-year'],
);

// --- recipients -------------------------------------------------------------------
const mem = (profileId: string, memberAgeDays: number, atRisk = false): CampaignMember => ({
  profileId,
  memberAgeDays,
  atRisk,
});
const ids = (out: CampaignMember[]): string[] => out.map((m) => m.profileId);
const YEAR = 2026;

const cohort = [mem('new', 3), mem('settled', 200), mem('quiet', 200, true)];

check(
  'audience all reaches everyone past the tenure floor',
  ids(selectCampaignRecipients(camp(), cohort, new Set(), YEAR)),
  ['settled', 'quiet'],
);
// The embarrassment this prevents: a woman who joined on 20 December told on the 26th not to give
// up on her goals.
check(
  'a member below the tenure floor is skipped',
  ids(selectCampaignRecipients(camp(), [mem('new', DEFAULT_MIN_TENURE_DAYS - 1)], new Set(), YEAR)),
  [],
);
check(
  'exactly at the floor is included',
  ids(selectCampaignRecipients(camp(), [mem('edge', DEFAULT_MIN_TENURE_DAYS)], new Set(), YEAR)),
  ['edge'],
);
check(
  'audience active excludes the quiet ones — the ladder owns them',
  ids(selectCampaignRecipients(camp({ audience: 'active' }), cohort, new Set(), YEAR)),
  ['settled'],
);
check(
  'audience at_risk reaches ONLY the quiet ones',
  ids(selectCampaignRecipients(camp({ audience: 'at_risk' }), cohort, new Set(), YEAR)),
  ['quiet'],
);
check('a valid audience is recognised', isCampaignAudience('at_risk'), true);
check('an unknown audience is rejected', isCampaignAudience('everyone'), false);

// --- dedupe ---------------------------------------------------------------------
check(
  'somebody already sent this run is skipped',
  ids(
    selectCampaignRecipients(
      camp(),
      cohort,
      new Set([campaignHistoryKey('settled', 'december-save', YEAR)]),
      YEAR,
    ),
  ),
  ['quiet'],
);
// Next year is a different run: a seasonal campaign is supposed to come back.
check(
  'last year&apos;s send does not block this year',
  ids(
    selectCampaignRecipients(
      camp(),
      [mem('settled', 400)],
      new Set([campaignHistoryKey('settled', 'december-save', YEAR - 1)]),
      YEAR,
    ),
  ),
  ['settled'],
);
// Campaigns do not suppress each other.
check(
  'another campaign&apos;s send does not block this one',
  ids(
    selectCampaignRecipients(
      camp(),
      [mem('settled', 400)],
      new Set([campaignHistoryKey('settled', 'new-year', YEAR)]),
      YEAR,
    ),
  ),
  ['settled'],
);
// Nor do members.
check(
  "another member&apos;s send does not block hers",
  ids(
    selectCampaignRecipients(
      camp(),
      [mem('settled', 400)],
      new Set([campaignHistoryKey('other', 'december-save', YEAR)]),
      YEAR,
    ),
  ),
  ['settled'],
);

// --- report ---------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
