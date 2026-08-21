/**
 * The weekly training target, pinned at every boundary.
 *
 * The case that matters most is the LAST one: a member with no answer and no plan must get a count
 * with no denominator, never a bar sitting at 0%. Every one of the 256 migrated Lenus members lands
 * there on day one, and "0 of 3" to somebody who never set a target is the app inventing a failure.
 *
 *   npx tsx .qa-visual/weekly-target-test.mts
 */
import { weeklyTargetFrom } from '../src/lib/training/weekly-target-shared';
import { localWeekStart, localDay } from '../src/lib/datetime/local-day';

const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown): void => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};

const WEEK = '2026-08-16'; // a Sunday
const WED = '2026-08-19';

// --- counting -----------------------------------------------------------------------------------
{
  const w = weeklyTargetFrom(['2026-08-17', '2026-08-19'], WED, WEEK, 3, 'answer');
  eq('done', w.done, 2);
  eq('target', w.target, 3);
  eq('mode', w.mode, 'target');
  eq('not met yet', w.met, false);
  // Sunday..Wednesday is 3 elapsed, so Wed/Thu/Fri/Sat remain.
  eq('daysLeft includes today', w.daysLeft, 4);
}

// Duplicates are one day. Two sessions on Tuesday is one day trained, not two.
eq('same day twice', weeklyTargetFrom(['2026-08-18', '2026-08-18'], WED, WEEK, 3, 'answer').done, 1);

// LAST WEEK MUST NOT COUNT. The caller passes a wide window on purpose (gamification keeps 200
// days), so the filter here is the only thing stopping last Thursday inflating this week.
eq('previous week excluded', weeklyTargetFrom(['2026-08-13', '2026-08-17'], WED, WEEK, 3, 'answer').done, 1);
// Nor can a day in the future of her own week: she has not trained on Friday yet.
eq('future day excluded', weeklyTargetFrom(['2026-08-21'], WED, WEEK, 3, 'answer').done, 0);
// The week start itself is IN the week.
eq('week start counts', weeklyTargetFrom([WEEK], WED, WEEK, 3, 'answer').done, 1);

// --- met, and over-met --------------------------------------------------------------------------
eq('exactly met', weeklyTargetFrom(['2026-08-17', '2026-08-18', '2026-08-19'], WED, WEEK, 3, 'answer').met, true);
{
  // Four of a planned three is a good week, not 133% and not an error.
  const w = weeklyTargetFrom(['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'], WED, WEEK, 3, 'answer');
  eq('over-met is met', w.met, true);
  eq('over-met keeps the true count', w.done, 4);
}

// --- no target: a count, never a zeroed bar -----------------------------------------------------
{
  const w = weeklyTargetFrom(['2026-08-17', '2026-08-19'], WED, WEEK, null, null);
  eq('no target -> count mode', w.mode, 'count');
  eq('no target -> null target', w.target, null);
  eq('no target -> null source', w.source, null);
  eq('no target -> never "met"', w.met, false);
  eq('no target -> still counts truthfully', w.done, 2);
}
// A zero or negative target is not a target either.
eq('zero target -> count', weeklyTargetFrom([], WED, WEEK, 0, 'answer').mode, 'count');
// A source without a usable target must not leak through.
eq('source dropped with target', weeklyTargetFrom([], WED, WEEK, 0, 'plan').source, null);

// --- Sunday, the edge of the week ---------------------------------------------------------------
{
  const w = weeklyTargetFrom([], WEEK, WEEK, 4, 'plan');
  eq('sunday: nothing done', w.done, 0);
  eq('sunday: a whole week left', w.daysLeft, 7);
  eq('sunday: plan is a valid source', w.source, 'plan');
}

// --- the timezone boundary, which is the whole reason localWeekStart exists ----------------------
{
  // 05:30 UTC on Sunday 2026-08-16 is 23:30 SATURDAY in Guadalajara. Her week must NOT have rolled.
  const instant = new Date('2026-08-16T05:30:00Z');
  const tz = 'America/Mexico_City';
  eq('local day is still Saturday', localDay(tz, instant), '2026-08-15');
  eq('local week still starts the previous Sunday', localWeekStart(tz, instant), '2026-08-09');
  // UTC has already rolled over, which is exactly the bug a UTC-based week would ship.
  eq('UTC has rolled', localDay('UTC', instant), '2026-08-16');
  eq('UTC week rolled early', localWeekStart('UTC', instant), '2026-08-16');
}
// And a week start that crosses a MONTH boundary, where string arithmetic would break.
eq('crosses a month', localWeekStart('UTC', new Date('2026-09-02T12:00:00Z')), '2026-08-30');

if (fails.length) {
  console.error(`FAIL (${fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('weekly-target: PASS');
