// K4 population portion bias. Imports the REAL module (Node strips the TS types).
//
// The stakes are the inverse of K1's. A wrong PERSONAL prior degrades one member's scan; a wrong
// POPULATION prior is injected into every member's prompt at once. So most of this file is about
// what must NOT become a prior.
import {
  aggregateBias,
  renderPopulationBiasForPrompt,
  normalizeFoodKey,
  median,
  MIN_SAMPLES,
  MIN_MEMBERS,
  MIN_RATIO,
  MAX_RATIO,
} from '../src/lib/nutrition/population-bias.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

const s = (food, p, c, profileId) => ({ food, predictedGrams: p, correctedGrams: c, profileId });
/** n samples of `food` at ratio r, spread across `members` distinct people. */
const spread = (food, r, n, members) =>
  Array.from({ length: n }, (_, i) => s(food, 100, 100 * r, `m${i % members}`));

// --- helpers ------------------------------------------------------------------------------------
ok('normalize lowercases', normalizeFoodKey('  White   Rice ') === 'white rice');
ok('normalize collapses ws', normalizeFoodKey('grilled\tchicken') === 'grilled chicken');
ok('median odd', median([1, 5, 3]) === 3);
ok('median even', median([1, 2, 3, 4]) === 2.5);
ok('median empty', median([]) === 0);

// --- the happy path: a real systematic bias becomes a prior --------------------------------------
const rice = aggregateBias(spread('white rice', 1.4, 12, 6));
ok('real bias produces a row', rice.length === 1);
ok('ratio is the median', rice[0]?.ratio === 1.4);
ok('sample count reported', rice[0]?.samples === 12);
ok('member count reported', rice[0]?.members === 6);

// --- what must NOT become a prior ---------------------------------------------------------------
// Too few samples.
ok('below MIN_SAMPLES rejected', aggregateBias(spread('quinoa', 1.5, MIN_SAMPLES - 1, 5)).length === 0);
// THE IMPORTANT ONE: plenty of samples, but they are all one enthusiastic tester. That is that
// person's habit, not the population's, and promoting it would push their bias onto everybody.
ok('one member cannot make a prior', aggregateBias(spread('oatmeal', 1.6, 20, 1)).length === 0);
ok('two members still not enough', aggregateBias(spread('oatmeal', 1.6, 20, MIN_MEMBERS - 1)).length === 0);
ok('exactly MIN_MEMBERS is enough', aggregateBias(spread('oatmeal', 1.6, 20, MIN_MEMBERS)).length === 1);
// A model that is already close needs no prompt line.
ok('small deviation ignored', aggregateBias(spread('broccoli', 1.05, 20, 8)).length === 0);
ok('exact match ignored', aggregateBias(spread('broccoli', 1.0, 20, 8)).length === 0);

// --- robustness: one absurd edit must not move the number ---------------------------------------
const withOutlier = [...spread('steak', 1.3, 12, 6), s('steak', 100, 9000, 'whale')];
const steak = aggregateBias(withOutlier);
ok('outlier dropped, median holds', steak.length === 1 && steak[0].ratio === 1.3);
// Ratios outside the sane band are misidentifications, not portion signal.
ok('20x edit excluded', aggregateBias(Array.from({ length: 12 }, (_, i) => s('nuts', 10, 500, `m${i}`))).length === 0);

// --- clamping: even overwhelming evidence may only nudge ----------------------------------------
const extreme = aggregateBias(spread('rice cakes', 5, 12, 6));
ok('ratio clamped to MAX', extreme[0]?.ratio === MAX_RATIO);
const tiny = aggregateBias(spread('lettuce', 0.15, 12, 6));
ok('ratio clamped to MIN', tiny[0]?.ratio === MIN_RATIO);

// --- garbage in ---------------------------------------------------------------------------------
ok('zero predicted ignored', aggregateBias(Array.from({ length: 12 }, (_, i) => s('x', 0, 100, `m${i}`))).length === 0);
ok('negative ignored', aggregateBias(Array.from({ length: 12 }, (_, i) => s('x', 100, -5, `m${i}`))).length === 0);
ok('empty input', aggregateBias([]).length === 0);
ok('blank food name ignored', aggregateBias(Array.from({ length: 12 }, (_, i) => s('   ', 100, 140, `m${i}`))).length === 0);

// --- aggregation across name variants ------------------------------------------------------------
const mixedCase = aggregateBias([...spread('White Rice', 1.4, 6, 3), ...spread('white rice', 1.4, 6, 3)]);
ok('name variants aggregate together', mixedCase.length === 1 && mixedCase[0].samples === 12);

// --- ordering: strongest signal first -------------------------------------------------------------
const many = aggregateBias([...spread('a', 1.2, 12, 6), ...spread('b', 1.8, 12, 6), ...spread('c', 0.6, 12, 6)]);
ok('sorted by deviation', many[0].food === 'b');

// --- prompt rendering ------------------------------------------------------------------------------
ok('empty renders null', renderPopulationBiasForPrompt([]) === null);
const txt = renderPopulationBiasForPrompt(rice) ?? '';
ok('names the food', txt.includes('white rice'));
ok('says UNDER for ratio>1', txt.includes('UNDER-estimates'));
ok('reports sample size', txt.includes('n=12'));
// It must read as a correction to the engine's OWN estimate, never as a target weight, or the model
// stops looking at the plate and just emits the number.
ok('no absolute gram target', !/\b\d+\s*g\b/.test(txt));
const over = renderPopulationBiasForPrompt(aggregateBias(spread('salad', 0.7, 12, 6))) ?? '';
ok('says OVER for ratio<1', over.includes('OVER-estimates'));
ok('limit respected', (renderPopulationBiasForPrompt(many, 2) ?? '').split('\n').length === 3); // header + 2

// --- anonymity: the output must never carry a member identifier ----------------------------------
const anonCheck = JSON.stringify(aggregateBias(spread('carrots', 1.5, 12, 6)));
ok('no profileId on output', !anonCheck.includes('m0') && !anonCheck.includes('profileId'));

console.log(`population bias: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
