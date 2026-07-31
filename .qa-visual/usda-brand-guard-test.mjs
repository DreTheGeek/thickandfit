// USDA brand guard + per-100g plausibility. Imports the REAL module (Node strips the TS types), so
// this exercises shipped logic rather than a copy of it.
//
// The bug being locked down was measured against the live USDA API on 2026-07-31:
//   query "Chipotle chicken burrito bowl" -> "TACO BELL, BURRITO SUPREME with chicken"
// Generic word overlap ("chicken", "burrito") outscored the fact that it was a different restaurant,
// so a member logging Chipotle got Taco Bell's macros with no way to know.
import {
  usdaBrandOf,
  brandConflicts,
  isPlausiblePer100g,
  penaltyApplies,
} from '../src/lib/nutrition/usda-match.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// --- brand extraction ---------------------------------------------------------------------------
// SR Legacy restaurant rows: chain in caps before the first comma.
ok('SR Legacy chain', usdaBrandOf({ description: 'TACO BELL, BURRITO SUPREME with chicken' }) === 'taco bell');
ok('SR Legacy chain 2', usdaBrandOf({ description: "McDONALD'S, BIG MAC" }) !== null);
// Branded rows: the structured field wins.
ok('brandOwner field', usdaBrandOf({ description: 'CHICKEN BURRITO BOWL', brandOwner: 'Chipotle Mexican Grill' }) === 'chipotle mexican grill');
ok('brandName fallback', usdaBrandOf({ description: 'X', brandName: 'Quest' }) === 'quest');
// Generic foods must NOT be read as branded. This is the assertion that keeps the guard from
// rejecting the entire generic corpus, which would break ordinary logging.
ok('generic not a brand', usdaBrandOf({ description: 'Chicken, broiler or fryers, breast, skinless' }) === null);
ok('generic lowercase', usdaBrandOf({ description: 'Rice, white, long-grain, cooked' }) === null);
ok('no description', usdaBrandOf({}) === null);

// --- the actual bug -----------------------------------------------------------------------------
const tacoBell = { description: 'TACO BELL, BURRITO SUPREME with chicken' };
ok('THE BUG: Chipotle query rejects Taco Bell', brandConflicts('Chipotle chicken burrito bowl', tacoBell) === true);
ok('Taco Bell query accepts Taco Bell', brandConflicts('taco bell burrito supreme', tacoBell) === false);
ok('case insensitive', brandConflicts('TACO BELL burrito', tacoBell) === false);

const chipotleBowl = { description: 'CHICKEN BURRITO BOWL', brandOwner: 'Chipotle Mexican Grill' };
ok('Chipotle query accepts Chipotle', brandConflicts('chipotle chicken burrito bowl', chipotleBowl) === false);
ok('McDonalds query rejects Chipotle', brandConflicts('mcdonalds mcchicken', chipotleBowl) === true);

// A GENERIC query must not silently resolve to a branded row: same failure, different direction.
ok('generic query rejects branded row', brandConflicts('chicken burrito bowl', chipotleBowl) === true);
// ...but a generic candidate is always allowed, or normal logging breaks.
ok('generic candidate always allowed', brandConflicts('chicken breast', { description: 'Chicken, broiler, breast' }) === false);

// --- per-100g plausibility ----------------------------------------------------------------------
// Real foods reconcile at 4/4/9.
ok('chicken breast plausible', isPlausiblePer100g(165, 31, 0, 3.6) === true);
ok('olive oil plausible', isPlausiblePer100g(884, 0, 0, 100) === true);
ok('white rice plausible', isPlausiblePer100g(130, 2.7, 28, 0.3) === true);
ok('greek yogurt plausible', isPlausiblePer100g(59, 10, 3.6, 0.4) === true);
// Near-zero foods must survive: the ratio test is meaningless at zero.
ok('black coffee plausible', isPlausiblePer100g(2, 0.1, 0, 0) === true);
ok('diet soda plausible', isPlausiblePer100g(0, 0, 0, 0) === true);

// A per-SERVING row misread as per-100g is the silent unit failure this gate exists to catch:
// calories for a whole 300g bowl against macros for 100g will not reconcile.
ok('unit mismatch rejected', isPlausiblePer100g(650, 8, 12, 4) === false);
// Physically impossible rows.
ok('kcal too high rejected', isPlausiblePer100g(1200, 0, 0, 100) === false);
ok('macros exceed 100g rejected', isPlausiblePer100g(500, 60, 60, 30) === false);
ok('negative rejected', isPlausiblePer100g(100, -5, 10, 2) === false);
ok('protein over 100 rejected', isPlausiblePer100g(400, 120, 0, 0) === false);
// Rounding on a real label must still pass; the tolerance is deliberately loose.
ok('label rounding tolerated', isPlausiblePer100g(240, 10, 30, 9) === true);

// Regression: USDA writes "McDONALD'S" with a lowercase c, so a strict all-caps test let every
// Mc-brand through as generic. Found by this suite, not by reading the API docs.
ok('McDONALD-S is a brand', usdaBrandOf({ description: "McDONALD'S, BIG MAC" }) === "mcdonald's");
ok('Chipotle query rejects McDonalds', brandConflicts('chipotle bowl', { description: "McDONALD'S, BIG MAC" }) === true);
ok('McDonalds query accepts it', brandConflicts('mcdonalds big mac', { description: "McDONALD'S, BIG MAC" }) === false);
// Generic Title Case must still read as generic on both sides of the threshold.
ok('Beef generic', usdaBrandOf({ description: 'Beef, ground, 85% lean' }) === null);
ok('Egg generic', usdaBrandOf({ description: 'Egg, whole, raw, fresh' }) === null);
ok('KFC is a brand', usdaBrandOf({ description: 'KFC, Fried Chicken, Original Recipe' }) === 'kfc');

// --- penalty words must match as WORDS, not substrings ---------------------------------------------
// The bug: USDA writes chicken as "Chicken, broiler or fryers, ...". A substring test for the
// cooking-oil penalty matched "oil" inside "broiler" and penalised every correct chicken row by -5,
// handing "grilled chicken breast" to "Lunchmeat, chicken breast, sliced". Measured on the live API.
const CHICKEN = 'chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled';
ok('THE BUG: broiler is not oil', penaltyApplies(CHICKEN, 'oil') === false);
ok('boiled is not oil', penaltyApplies('potato, boiled, drained', 'oil') === false);
ok('spoiled is not oil', penaltyApplies('milk, spoiled', 'oil') === false);
// ...while the penalty still does its original job.
ok('real oil still penalised', penaltyApplies('fish oil, salmon', 'oil') === true);
ok('oil at start', penaltyApplies('Oil, olive, extra virgin', 'oil') === true);
ok('oil with punctuation', penaltyApplies('salad dressing (oil).', 'oil') === true);
ok('baby food still caught', penaltyApplies('babyfood, carrots', 'baby') === false);
ok('baby as a word caught', penaltyApplies('baby food, carrots', 'baby') === true);
ok('supplement caught', penaltyApplies('protein supplement powder', 'supplement') === true);
ok('empty penalty safe', penaltyApplies('anything', '') === false);

console.log(`usda brand guard: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
