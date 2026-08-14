// Who gets an automatic meal plan, and who does not.
//
// "You pay the higher tier, here's your meal plan. Steph don't have to do anything" (2026-08-13).
// The tier gate is the whole feature: everyone gets a training program, and a written meal plan is
// part of what the paid-up tiers are FOR. Handing one to a self-guided member gives away the upsell
// and tells her something about her purchase that is not true.
//
// The gate reads through normalizeTier, which accepts BOTH vocabularies — the checkout page speaks
// self/team/steph and older records speak low/mid/high — and that aliasing is where a mistake would
// hide: 'mid' silently failing to match 'team' means every mid-tier member gets nothing, forever,
// with no error anywhere.
//
// Run: npx tsx .qa-visual/auto-assign-tier-test.mts
import {
  tierGetsMealPlan,
  normalizeTier,
  CHECKOUT_TIERS,
  isSelfServe,
} from '../src/lib/billing/tiers';

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

// --- the gate, in both vocabularies ------------------------------------------
check('self does NOT get a meal plan', tierGetsMealPlan('self'), false);
check('team gets one', tierGetsMealPlan('team'), true);
check('steph gets one', tierGetsMealPlan('steph'), true);
// The legacy aliases must behave identically or a whole tier silently gets nothing.
check('low is self', tierGetsMealPlan('low'), false);
check('mid is team', tierGetsMealPlan('mid'), true);
check('high is steph', tierGetsMealPlan('high'), true);
for (const [alias, canonical] of [['low', 'self'], ['mid', 'team'], ['high', 'steph']] as const) {
  check(`${alias} and ${canonical} agree`, tierGetsMealPlan(alias), tierGetsMealPlan(canonical));
}

// --- unknown input falls to the SAFE side --------------------------------------
// normalizeTier defaults to 'self', so anything unrecognised gets no meal plan. That is the correct
// direction: the failure of withholding is a coach doing it by hand, which is today's behaviour.
// The failure of over-granting is giving away the thing the tier is sold on.
for (const bad of [null, undefined, '', 'premium', 'TEAM', 42, {}]) {
  check(`${JSON.stringify(bad)} is treated as self`, tierGetsMealPlan(bad), false);
}
check('normalizeTier defaults to self', normalizeTier('nonsense'), 'self');

// --- every real tier has a deliberate answer ------------------------------------
for (const tier of CHECKOUT_TIERS) {
  ok(`${tier} has a boolean answer`, typeof tierGetsMealPlan(tier) === 'boolean');
}
// Exactly the two high-ticket tiers, no more. If a fourth tier is ever added this fails, which is
// the intended prompt to decide rather than inherit.
check('exactly two tiers get a meal plan', CHECKOUT_TIERS.filter(tierGetsMealPlan).length, 2);

// The tier that can self-serve checkout is exactly the tier that does NOT get a meal plan. Not a
// coincidence: the plan is what the sales-assisted tiers are partly sold on.
for (const tier of CHECKOUT_TIERS) {
  check(`${tier}: self-serve and meal-plan are opposites`, isSelfServe(tier), !tierGetsMealPlan(tier));
}

// --- report ----------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\n${pass} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`✓ ${pass} assertions passed`);
