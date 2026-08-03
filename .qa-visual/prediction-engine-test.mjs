// Goal projection. Imports the REAL module (Node strips the TS types).
//
// The case that matters: a member who picked lose_fat + build_muscle derives to a 'maintain' calorie
// direction while her goal weight still sits below her current weight. Her scale is SUPPOSED to stay
// flat. Reading that as a stalled fat-loss member is how the app ends up nagging her about the exact
// outcome it promised her at onboarding.
import { projectGoalDate, assessDailyPace } from '../src/lib/prediction/engine.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// Rodney's real numbers (profile 0055aaa2, onboarded 2026-08-03): 88 kg now, 79 kg goal, maintenance.
const RECOMP = {
  currentWeightKg: 88,
  goalWeightKg: 79,
  weightChangeKg7d: null,
  weightChangeKg30d: 0,
  primaryGoal: 'maintain',
  avgKcal30d: null,
  targetKcal: null,
  avgProteinG30d: null,
  targetProteinG: null,
  loggingDays30d: 20,
};
const with_ = (over) => ({ ...RECOMP, ...over });

// --- the fix: flat + maintain is the plan working, not a plateau -------------------------------
const held = projectGoalDate(RECOMP);
ok('maintain + flat -> maintaining', held.reason === 'maintaining');
ok('maintain + flat -> holding', held.direction === 'holding');
ok('maintain + flat -> no invented date', held.goalDateIso === null);

// Flat is flat whichever window fed it, and whichever side of the goal weight she sits on.
ok(
  'maintain + flat from 7d -> maintaining',
  projectGoalDate(with_({ weightChangeKg30d: null, weightChangeKg7d: 0.05 })).reason === 'maintaining',
);
ok(
  'maintain + goal weight ABOVE current -> still maintaining',
  projectGoalDate(with_({ goalWeightKg: 95 })).reason === 'maintaining',
);
// Just inside the +/-0.15 kg/wk plateau band: still flat, still by design.
ok(
  'maintain + drift inside the band -> maintaining',
  projectGoalDate(with_({ weightChangeKg30d: 0.4 })).reason === 'maintaining',
);

// --- the regression guard: a real fat-loss member must STILL be told she plateaued -------------
ok(
  'lose + flat -> plateau (unchanged)',
  projectGoalDate(with_({ primaryGoal: 'lose' })).reason === 'plateau',
);
ok(
  'gain + flat -> plateau (unchanged)',
  projectGoalDate(with_({ primaryGoal: 'gain' })).reason === 'plateau',
);
ok(
  'null primaryGoal + flat -> plateau (unchanged)',
  projectGoalDate(with_({ primaryGoal: null })).reason === 'plateau',
);

// --- everything else stays exactly as it was ---------------------------------------------------
// A maintaining member who is genuinely drifting is real signal; we do NOT suppress it.
const drifting = projectGoalDate(with_({ weightChangeKg30d: 3 }));
ok('maintain + real gain -> wrong_direction, not maintaining', drifting.reason === 'wrong_direction');

// Losing on a fat-loss goal still projects a date.
const losing = projectGoalDate(with_({ primaryGoal: 'lose', weightChangeKg30d: -2 }));
ok('lose + losing -> ok', losing.reason === 'ok');
ok('lose + losing -> has a date', typeof losing.goalDateIso === 'string');
ok('lose + losing -> direction losing', losing.direction === 'losing');

// No trend and no goal weight are untouched by this change.
ok(
  'no trend -> no_trend',
  projectGoalDate(with_({ weightChangeKg7d: null, weightChangeKg30d: null })).reason === 'no_trend',
);
ok('no goal weight -> no_goal', projectGoalDate(with_({ goalWeightKg: null })).reason === 'no_goal');
ok(
  'maintain + no goal weight -> no_goal (guard runs first)',
  projectGoalDate(with_({ goalWeightKg: null })).direction === 'flat',
);

// A crawl toward the goal that runs past the horizon is still refused a date.
ok(
  'too far out -> too_far_out',
  projectGoalDate(with_({ primaryGoal: 'lose', weightChangeKg30d: -0.7 })).reason === 'too_far_out',
);

// assessDailyPace is untouched by the direction change; assert it still reads targets.
const pace = assessDailyPace(with_({ avgKcal30d: 2700, targetKcal: 2701, loggingDays30d: 20 }));
ok('pace kcal on_pace', pace.kcal === 'on_pace');
ok('pace lowConfidence false at 20 days', pace.lowConfidence === false);

console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  FAIL ${f}`);
  process.exit(1);
}
