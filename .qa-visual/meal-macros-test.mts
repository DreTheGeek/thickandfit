// Tests for the meal-builder macro maths.
//
// These exist because of two specific defects visible in Stephanie's own Lenus screenshots, and the
// whole point of this module is to not ship them:
//
//   1. "28.099999999999998 g" of fat, i.e. raw float printed to a coach.
//   2. A per-meal macro column that does not sum to the daily target.
//
// Both are silent. Nothing errors, every number looks plausible, and the coach only finds out by
// adding it up herself. So the assertions below are mostly "does the column add up", which is a
// boring thing to test and exactly the thing that broke.
//
// Run: npx tsx .qa-visual/meal-macros-test.mts
import {
  kcalFromMacros,
  splitToGrams,
  gramsToSplit,
  flexRange,
  distribute,
  reconcile,
  SPLIT_TEMPLATES,
  recommendIntake,
  ACTIVITY_LEVELS,
  MIN_SAFE_KCAL,
  FLEX_MIN,
  FLEX_MAX,
} from '../src/lib/meal-plans/macros';

let pass = 0;
const failures: string[] = [];
const check = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass += 1;
  else failures.push(`${name}\n    expected ${w}\n    got      ${g}`);
};
const ok = (name: string, cond: boolean): void => {
  if (cond) pass += 1;
  else failures.push(name);
};

// --- no floats ever escape ----------------------------------------------------------------------
// The exact shape of the Lenus bug: a third of a plan, printed raw, is 28.099999999999998.
for (const cals of [1555, 1600, 1837, 2100, 2481]) {
  for (const tpl of SPLIT_TEMPLATES) {
    const g = splitToGrams(cals, tpl);
    ok(
      `${tpl.key} @ ${cals}: grams are integers`,
      Number.isInteger(g.proteinG) && Number.isInteger(g.carbG) && Number.isInteger(g.fatG),
    );
    // Fat carries the remainder, so the grams must multiply back to within one fat gram of target.
    ok(`${tpl.key} @ ${cals}: grams reconstruct the calorie target`, Math.abs(kcalFromMacros(g) - cals) <= 9);
  }
}

// --- percentages always read 100 ------------------------------------------------------------------
for (const m of [
  { proteinG: 134, carbG: 151, fatG: 39 }, // her anti-inflammatory protocol
  { proteinG: 100, carbG: 100, fatG: 100 },
  { proteinG: 1, carbG: 1, fatG: 1 },
  { proteinG: 187, carbG: 33, fatG: 71 },
]) {
  const s = gramsToSplit(m);
  check(`split of ${JSON.stringify(m)} sums to 100`, s.protein + s.carb + s.fat, 100);
}
check('empty macros do not divide by zero', gramsToSplit({ proteinG: 0, carbG: 0, fatG: 0 }), { protein: 0, carb: 0, fat: 0 });

// --- THE COLUMN MUST ADD UP -----------------------------------------------------------------------
// The second Lenus bug. 151g of carbs over 5 equal meals is 30.2 each; rounding each independently
// gives 150 and quietly loses a gram.
const protocol = { proteinG: 134, carbG: 151, fatG: 39 };
for (const n of [2, 3, 4, 5, 6, 7]) {
  const shares = Array.from({ length: n }, () => 100 / n);
  const slots = distribute(protocol, 1555, shares);
  const sum = slots.reduce(
    (a, s) => ({
      proteinG: a.proteinG + s.macros.proteinG,
      carbG: a.carbG + s.macros.carbG,
      fatG: a.fatG + s.macros.fatG,
      kcal: a.kcal + s.kcal,
    }),
    { proteinG: 0, carbG: 0, fatG: 0, kcal: 0 },
  );
  check(`${n} equal meals: protein column sums exactly`, sum.proteinG, protocol.proteinG);
  check(`${n} equal meals: carb column sums exactly`, sum.carbG, protocol.carbG);
  check(`${n} equal meals: fat column sums exactly`, sum.fatG, protocol.fatG);
  check(`${n} equal meals: calories sum exactly`, sum.kcal, 1555);
}

// Uneven shares are the realistic case: a big dinner and a small snack.
const uneven = distribute(protocol, 1555, [30, 10, 26, 14, 20]);
const unevenSum = uneven.reduce((a, s) => a + s.macros.carbG, 0);
check('uneven shares still sum exactly', unevenSum, protocol.carbG);
check('one slot takes the whole day', distribute(protocol, 1555, [100])[0].macros, protocol);
check('no slots yields no rows', distribute(protocol, 1555, []), []);

// --- flexibility band ------------------------------------------------------------------------------
check('strict band on 150g', flexRange(150, 1), { min: 148, max: 152 });
check('flexible band on 150g', flexRange(150, 10), { min: 135, max: 165 });
ok('a band is never inverted', flexRange(0, 10).min <= flexRange(0, 10).max);
check('below the floor clamps to strict', flexRange(100, FLEX_MIN - 5), flexRange(100, FLEX_MIN));
check('above the ceiling clamps to flexible', flexRange(100, FLEX_MAX + 20), flexRange(100, FLEX_MAX));
ok('a band never goes negative', flexRange(3, 10).min >= 0);

// --- reconciliation -----------------------------------------------------------------------------
// Her real protocol: macros AND calories as she states them, which do not Atwater-agree.
const exact = reconcile(protocol, 1555, [{ ...protocol, kcal: 1555 }], 5);
check('an exact plan has zero delta', exact.delta, { proteinG: 0, carbG: 0, fatG: 0, kcal: 0 });
ok('an exact plan is within tolerance', exact.withinTolerance);

const over = reconcile(protocol, 1555, [{ proteinG: 200, carbG: 151, fatG: 39, kcal: 1555 }], 5);
check('an over-target plan reports a positive delta', over.delta.proteinG, 66);
ok('an over-target plan is flagged', !over.withinTolerance);

// 5% flexibility on 151g of carbs is +/- 7g, so 145 is inside and 140 is not.
ok('just inside the band passes', reconcile(protocol, 1555, [{ ...protocol, carbG: 145, kcal: 1555 }], 5).withinTolerance);
ok('just outside the band fails', !reconcile(protocol, 1555, [{ ...protocol, carbG: 140, kcal: 1555 }], 5).withinTolerance);

// An empty plan against a real target must read as wrong, not as "nothing to check".
ok('an empty plan is not within tolerance', !reconcile(protocol, 1555, [], 5).withinTolerance);

// The gap is REAL in her data and must survive: 4/4/9 on her grams is 1,491 against a stated 1,555.
// A tool that 'corrects' this is telling a coach her own labels are wrong.
const herGap = reconcile(protocol, 1555, [{ ...protocol, kcal: 1555 }], 5);
check('her label calories are preserved, not recomputed from macros', herGap.actual.kcal, 1555);
check('Atwater on her macros really is 64 short', kcalFromMacros(protocol), 1491);


// --- recommended intake, derived from BMR --------------------------------------------------------
// 265 clients have a BMR and exactly ONE has a TDEE, so a recommendation must start from BMR or it
// is blank for 264 people.
const rec = recommendIntake(1400, 1.375, 'lose');
check('TDEE is BMR x PAL', rec.tdee, 1925);
check('a cut is a percentage of maintenance', rec.target, 1540);
ok('a normal cut is not floored', !rec.flooredToMinimum);

// A flat -500 would put a small woman on 900 kcal. The percentage form plus a floor prevents that,
// and the floor is REPORTED so the coach knows her number was moved rather than silently accepted.
const tiny = recommendIntake(900, 1.2, 'lose');
ok('a very small maintenance is floored', tiny.flooredToMinimum);
check('the floor is the documented minimum', tiny.target, MIN_SAFE_KCAL);

check('maintain returns maintenance', recommendIntake(1500, 1.55, 'maintain').target, Math.round(1500 * 1.55));
ok('a surplus is above maintenance', recommendIntake(1500, 1.55, 'gain').target > Math.round(1500 * 1.55));
ok('every activity level is a plausible multiplier', ACTIVITY_LEVELS.every((a) => a.pal >= 1.2 && a.pal <= 1.9));

// Sanity against her real work: a typical client lands near the 1,555 she actually writes.
ok('a typical client lands near her real protocol', Math.abs(recommendIntake(1400, 1.375, 'lose').target - 1555) < 100);

console.log(`meal macros: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error('  FAIL ' + f);
  process.exit(1);
}
