// PRD-D AC-1: fat-bias scoring is correct AND legacy (unlabeled) cases score exactly as before.
// Imports the REAL module (Node strips the TS types), so this exercises shipped logic.
import { scoreCase, fatBias } from '../src/lib/ai/eval/scan-scoring.ts';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const near = (a, b, eps = 0.05) => a !== null && Math.abs(a - b) <= eps;

const P = (name, grams, fatG, confidence = 0.9) => ({ name, grams, confidence, fatG });

// --- REGRESSION: a case with no fat labels must be untouched (fatBiasG null, other fields intact) ---
const legacy = { kind: 'meal', items: [{ name: 'white rice', grams: 200 }, { name: 'chicken breast', grams: 150 }] };
const legacyPred = [P('white rice', 200, 0.4), P('chicken breast', 150, 5.4)];
const legacyScore = scoreCase(legacy, 'meal', legacyPred);
ok('legacy: fatBiasG null with no labels', legacyScore.fatBiasG === null);
ok('legacy: still passes', legacyScore.passed === true);
ok('legacy: f1 = 1', legacyScore.f1 === 1);
ok('legacy: mape 0', legacyScore.mape === 0);

// The same case scored WITHOUT any fatG on the predictions must be identical: adding the field to
// the type must not perturb an existing run.
const legacyNoFat = scoreCase(legacy, 'meal', [
  { name: 'white rice', grams: 200, confidence: 0.9 },
  { name: 'chicken breast', grams: 150, confidence: 0.9 },
]);
ok('legacy: score identical without fatG', legacyNoFat.score === legacyScore.score);
ok('legacy: f1 identical without fatG', legacyNoFat.f1 === legacyScore.f1);

// --- PLATE-LEVEL LABEL: total_fat_g wins, and the sign is right ---
// Label says 31g of fat on the plate; we predicted 12.4g. That is UNDER by 18.6g, the NIH failure.
const oily = {
  kind: 'meal',
  items: [{ name: 'chicken thigh', grams: 200 }, { name: 'white rice', grams: 200 }],
  total_fat_g: 31,
  oil_used: true,
};
const oilyPred = [P('chicken thigh', 200, 12.0), P('white rice', 200, 0.4)];
const oilyScore = scoreCase(oily, 'meal', oilyPred);
ok('oil plate: bias is negative (underestimating)', oilyScore.fatBiasG < 0);
ok('oil plate: bias = -18.6', near(oilyScore.fatBiasG, -18.6));

// Same plate WITH the mandated cooking-oil item predicted: the gap should close.
const oilyPredWithOil = [...oilyPred, P('cooking oil', 15, 15.0)];
const closed = scoreCase(oily, 'meal', oilyPredWithOil);
ok('oil plate: predicting oil moves bias toward zero', Math.abs(closed.fatBiasG) < Math.abs(oilyScore.fatBiasG));
ok('oil plate: bias = -3.6 with oil', near(closed.fatBiasG, -3.6));
// An unmatched predicted cooking-oil must still not be punished as a false positive (existing rule).
ok('oil plate: f1 unaffected by the extra oil item', closed.f1 === oilyScore.f1);

// --- PER-ITEM LABELS: summed when there is no plate-level number ---
const perItem = {
  kind: 'meal',
  items: [{ name: 'avocado', grams: 100, fat_g: 15 }, { name: 'toast', grams: 60, fat_g: 1 }],
};
const perItemScore = scoreCase(perItem, 'meal', [P('avocado', 100, 14.7), P('toast', 60, 1.0)]);
ok('per-item: sums the labels (16g)', near(perItemScore.fatBiasG, -0.3));

// total_fat_g takes precedence over per-item sums (the oily-plate case).
const bothLabels = { kind: 'meal', items: [{ name: 'avocado', grams: 100, fat_g: 15 }], total_fat_g: 40 };
ok(
  'plate label wins over per-item sum',
  near(fatBias(bothLabels, [P('avocado', 100, 15)]), -25),
);

// --- MEASUREMENT GAPS return null, never 0 ---
// A labeled case whose predictions carry NO resolved macros cannot be measured. Returning 0 would
// read as "predicted no fat at all", turning a measurement gap into a fabricated finding.
ok(
  'labeled case with unresolved macros -> null, not 0',
  fatBias(oily, [{ name: 'chicken thigh', grams: 200, confidence: 0.9 }]) === null,
);
ok('no label -> null', fatBias(legacy, oilyPred) === null);
// A plate labeled 0g fat is a real label, not a missing one.
ok('total_fat_g: 0 is a real label', fatBias({ kind: 'meal', items: legacy.items, total_fat_g: 0 }, [P('x', 10, 2)]) === 2);

// --- OVERESTIMATION is reported as positive, so direction is readable ---
const over = { kind: 'meal', items: [{ name: 'salad', grams: 200 }], total_fat_g: 5 };
ok('overestimate -> positive bias', fatBias(over, [P('salad', 200, 20)]) === 15);

console.log(`fat-bias scoring: ${pass}/${pass + fails.length} passed`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
