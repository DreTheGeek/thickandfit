// Preparation reading and agreement: the rules that decide whether a fried food can be logged as a
// boiled one.
//
// THE INCIDENT. A member photographed a KFC plate. gpt-5 read it correctly and returned
// "fried chicken thigh, cooked, breaded". The app logged her **Chicken, feet, boiled**, because the
// corpus matcher listed every cooking method as a STOPWORD and then broke ties by shortest name,
// and the shortest row containing "chicken" is chicken feet.
//
// The direction matters more than the absurdity. Fried logged as boiled hides 12-20g of fat and
// 200-400 kcal, which is the July 2026 NIH/NIDDK finding this repo tracks as a signed fat bias. A
// woman holding a deficit would be eating over it with no way to see why.
//
//   npx tsx .qa-visual/preparation-test.mts
import {
  readPreparation,
  preparationAgreement,
  contradictsPreparation,
} from '../src/lib/nutrition/preparation';

let pass = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean): void => {
  if (cond) pass += 1;
  else fails.push(name);
};

// --- reading the method -------------------------------------------------------------------------
ok('fried', readPreparation('fried chicken thigh').fatClass === 'added-fat');
ok('deep-fried', readPreparation('deep-fried cod').fatClass === 'added-fat');
ok('pan-fried', readPreparation('pan-fried salmon').fatClass === 'added-fat');
ok('sauteed', readPreparation('sauteed spinach').fatClass === 'added-fat');
ok('crispy', readPreparation('extra crispy chicken').fatClass === 'added-fat');
ok('grilled is dry heat', readPreparation('grilled chicken breast').fatClass === 'dry-heat');
ok('baked is dry heat', readPreparation('baked potato').fatClass === 'dry-heat');
ok('roasted is dry heat', readPreparation('roasted vegetables').fatClass === 'dry-heat');
ok('air-fried is dry heat', readPreparation('air-fried wings').fatClass === 'dry-heat');
ok('boiled is wet heat', readPreparation('boiled egg').fatClass === 'wet-heat');
ok('steamed is wet heat', readPreparation('steamed broccoli').fatClass === 'wet-heat');
ok('stewed is wet heat', readPreparation('stewed beef').fatClass === 'wet-heat');
ok('raw', readPreparation('raw spinach').fatClass === 'raw');
ok('no method stated', readPreparation('buttermilk biscuit').fatClass === null);

// --- THE USDA BIRD-TYPE TRAP --------------------------------------------------------------------
// "broilers or fryers" is a CHICKEN TYPE, not a cooking method, and USDA puts it in nearly every
// generic chicken description. Read naively it makes every chicken row look fried (or broiled), so
// a boiled row and a fried row score identically and the whole fix is inert. This repo has already
// been bitten by the same phrase once: the substring "oil" inside "broiler" was taking the cooking
// oil penalty (see penaltyApplies in usda-match.ts).
ok(
  'broilers or fryers is not a method',
  readPreparation('Chicken, broilers or fryers, thigh, meat only, raw').fatClass === 'raw',
);
ok(
  'broilers or fryers + fried reads as fried',
  readPreparation('Chicken, broilers or fryers, thigh, meat and skin, cooked, fried, batter').fatClass === 'added-fat',
);
ok(
  'broilers or fryers + stewed reads as wet heat',
  readPreparation('Chicken, broilers or fryers, thigh, meat only, cooked, stewed').fatClass === 'wet-heat',
);

// --- breading -----------------------------------------------------------------------------------
ok('breaded', readPreparation('breaded chicken').breaded);
ok('breading (USDA spelling)', readPreparation('Fried Chicken, Thigh, meat and skin and breading').breaded);
ok('battered', readPreparation('battered cod').breaded);
ok('batter (USDA spelling)', readPreparation('thigh, cooked, fried, batter').breaded);
ok('extra crispy', readPreparation('KFC, Fried Chicken, EXTRA CRISPY, Thigh').breaded);
ok('tenders', readPreparation('chicken tenders').breaded);
ok('plain grilled is not breaded', !readPreparation('grilled chicken breast').breaded);

// --- leanness -----------------------------------------------------------------------------------
ok('meat only is lean', readPreparation('thigh, meat only, cooked, fried').leanness === 'lean');
ok('skinless is lean', readPreparation('skinless chicken breast').leanness === 'lean');
ok('meat and skin has fat', readPreparation('thigh, meat and skin, cooked').leanness === 'with-fat');
ok('with breading has fat', readPreparation('Thigh, meat and skin with breading').leanness === 'with-fat');
ok('unstated leanness', readPreparation('chicken thigh').leanness === null);

// --- a mix is not the food ------------------------------------------------------------------------
ok('dry mix', readPreparation('Biscuits, plain or buttermilk, dry mix').unprepared);
ok('cake mix', readPreparation('cake mix').unprepared);
ok('powder', readPreparation('protein powder').unprepared);
ok('baked biscuit is not a mix', !readPreparation('Biscuits, plain or buttermilk, frozen, baked').unprepared);
// THE RICE GUARD, and the reason this is `mix` and not `dry`. "White rice, dry" is the row the rice
// pipeline WANTS: effectiveGrams converts the photographed cooked grams back to dry weight using
// cooked_uncooked_ratios. Penalising "dry" would break the exact food the stopword list in photo.ts
// was originally written for ("cooked white rice" still has to reach a rice row).
ok('dry rice is NOT a mix', !readPreparation('White rice, dry').unprepared);
ok('raw chicken is NOT a mix', !readPreparation('Chicken breast, raw').unprepared);
// Words that merely contain "mix" are untouched.
ok('mixed vegetables is not a mix', !readPreparation('mixed vegetables').unprepared);
ok('trail mix IS matched, and that is fine', readPreparation('trail mix').unprepared);
ok(
  'a mix is disqualifying',
  preparationAgreement(readPreparation('buttermilk biscuit'), readPreparation('Biscuits, plain or buttermilk, dry mix')) === -1,
);
ok(
  'unless the member asked for the mix',
  preparationAgreement(readPreparation('pancake mix'), readPreparation('Pancakes, dry mix')) > -1,
);

// --- agreement, the part that decides the log ----------------------------------------------------
const friedBreaded = readPreparation('fried chicken thigh, cooked, breaded');

// THE REPORTED BUG. This pairing must be strongly negative, or chicken feet can win again.
ok(
  'fried vs boiled contradicts',
  contradictsPreparation(friedBreaded, readPreparation('chicken, feet, boiled')),
);
ok(
  'fried vs stewed contradicts',
  contradictsPreparation(friedBreaded, readPreparation('Chicken, broilers or fryers, thigh, meat only, cooked, stewed')),
);

// THE FAT TRAP. "meat only, cooked, fried" agrees on the METHOD and still strips the skin and the
// batter, which is most of the difference between 10.3g of fat and 22.1g. It must score BELOW the
// row that keeps them, or USDA hands back the lean row and the fix moves the error rather than
// removing it.
const meatOnlyFried = preparationAgreement(friedBreaded, readPreparation('Chicken, broilers or fryers, thigh, meat only, cooked, fried'));
const skinAndBreading = preparationAgreement(friedBreaded, readPreparation('Fast Foods, Fried Chicken, Thigh, meat and skin and breading'));
const kfcRow = preparationAgreement(friedBreaded, readPreparation('KFC, Fried Chicken, EXTRA CRISPY, Thigh, meat and skin with breading'));
ok('skin+breading beats meat-only', skinAndBreading > meatOnlyFried);
ok('the KFC row beats meat-only', kfcRow > meatOnlyFried);
ok('meat-only fried is penalised, not rewarded', meatOnlyFried < 0);
ok('skin+breading is positive', skinAndBreading > 0);

// A row that states NO preparation is mildly worse than one that agrees, and never a contradiction.
//
// It is genuinely worse: a bare "chicken thigh" row for a breaded fried thigh is missing the batter
// and the oil it absorbed, so it under-counts. But silence is most of the corpus ("buttermilk
// biscuit" states nothing), and treating it as a contradiction would reject the corpus wholesale and
// send every item to USDA. So it costs a little and rejects nothing, which is the line that matters:
// contradictsPreparation must stay false here.
const silent = preparationAgreement(friedBreaded, readPreparation('chicken thigh'));
ok('silence costs something', silent < 0);
ok('silence beats a contradiction', silent > preparationAgreement(friedBreaded, readPreparation('chicken, feet, boiled')));
ok('silence never contradicts', !contradictsPreparation(friedBreaded, readPreparation('chicken thigh')));
// For a food nobody breads, silence is free.
ok(
  'silence is free when nothing was claimed',
  preparationAgreement(readPreparation('buttermilk biscuit'), readPreparation('biscuits, plain or buttermilk')) === 0,
);

// The reverse direction is wrong too, but less dangerous: it invents calories rather than hiding
// them. It should still be negative, just not as negative.
const boiled = readPreparation('boiled chicken');
const boiledVsFried = preparationAgreement(boiled, readPreparation('fried chicken'));
const friedVsBoiled = preparationAgreement(friedBreaded, readPreparation('boiled chicken'));
ok('both directions are negative', boiledVsFried < 0 && friedVsBoiled < 0);
ok('hiding fat is punished harder than inventing it', friedVsBoiled < boiledVsFried);

// Grilled vs boiled is a real difference and a much smaller one than either against fried.
const grilled = readPreparation('grilled chicken breast');
const grilledVsBoiled = preparationAgreement(grilled, readPreparation('boiled chicken breast'));
ok('grilled vs boiled is mild', grilledVsBoiled < 0 && grilledVsBoiled > friedVsBoiled);
ok('grilled vs boiled does not contradict', !contradictsPreparation(grilled, readPreparation('boiled chicken breast')));

// Matching preparations agree.
ok('grilled matches grilled', preparationAgreement(grilled, readPreparation('chicken breast, grilled')) > 0);
ok(
  'fried breaded matches fried breaded',
  preparationAgreement(friedBreaded, readPreparation('chicken thigh, fried, breaded')) > 0,
);

// Bounds hold, so a caller can rely on the range.
for (const [a, b] of [
  ['fried breaded chicken with skin', 'boiled skinless chicken, meat only'],
  ['raw spinach', 'deep-fried breaded spinach with skin'],
  ['grilled chicken', 'grilled chicken'],
]) {
  const v = preparationAgreement(readPreparation(a), readPreparation(b));
  ok(`in range: ${a} vs ${b}`, v >= -1 && v <= 1);
}

if (fails.length) {
  console.error(`FAIL (${fails.length}/${pass + fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`OK: ${pass} preparation assertions, fried cannot be logged as boiled`);
