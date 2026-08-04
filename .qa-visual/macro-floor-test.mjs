// Sweeps computePlan() across every realistic body in Stephanie's audience and asserts no plan is
// ever unlivable.
//
// The bug this exists to prevent: protein and fat were anchored to RAW bodyweight at 2.0 and 0.9
// g/kg, a fixed cost of 16.1 kcal per kg that outgrows the calorie target. Above roughly 105 kg it
// consumed the entire budget and `Math.max(0, ...)` clamped carbohydrate to zero rather than letting
// it go negative where someone would have noticed. Measured before the fix: 114 of 1,230 realistic
// combinations were prescribed LITERALLY 0 g of carbohydrate, and 584 came in under 50 g. The worst
// was a 4'10" 280 lb member: 2,040 kcal, 254 g protein, no carbs at all.
//
// It hit exactly the members this app exists for. A 5'6" 165 lb member got a sane 150 g and nobody
// building or testing at that size would ever have seen it.
//
// Run: node .qa-visual/macro-floor-test.mjs
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

// computePlan lives in TypeScript, so compile just this module and import the JS.
const TMP = '.qa-visual/.macro-tmp';
rmSync(TMP, { recursive: true, force: true });
execSync(
  `npx tsc src/lib/onboarding/prediction.ts --outDir ${TMP} --module esnext --target es2022 ` +
    `--moduleResolution bundler --skipLibCheck --strict false`,
  { stdio: 'pipe' },
);
writeFileSync(`${TMP}/package.json`, '{"type":"module"}');
// tsc flattens to the outDir when compiling a single file, so it lands beside the tmp package.json.
const { computePlan } = await import(`../${TMP}/prediction.js`);

const MIN_CARBS = 100;
const MIN_FAT_PER_KG = 0.6;
const MAX_PROTEIN_PCT = 40; // above this it stops being a diet and starts being a protein shake

let checked = 0;
const failures = [];
let minCarbs = { g: Infinity };
let maxProteinPct = { pct: 0 };

for (let lb = 120; lb <= 350; lb += 5) {
  for (let inch = 58; inch <= 74; inch++) {
    for (const activity of ['sedentary', 'light', 'moderate', 'active', 'very_active']) {
      for (const goal of ['lose', 'maintain', 'gain']) {
        const weightKg = lb / 2.2046;
        const plan = computePlan({
          sex: 'female',
          weightKg,
          heightCm: inch * 2.54,
          age: 35,
          activity,
          goal,
          goalWeightKg: goal === 'lose' ? weightKg * 0.85 : weightKg,
        });
        checked++;

        const { protein_g, carbs_g, fat_g } = plan.macros;
        const proteinPct = (protein_g * 4) / plan.calories * 100;
        const who = `${lb}lb ${Math.floor(inch / 12)}'${inch % 12}" ${activity} ${goal}`;

        if (carbs_g < minCarbs.g) minCarbs = { g: carbs_g, who };
        if (proteinPct > maxProteinPct.pct) maxProteinPct = { pct: proteinPct, who };

        if (carbs_g < MIN_CARBS) failures.push(`${who}: ${carbs_g}g carbs, floor is ${MIN_CARBS}`);
        if (fat_g < Math.round(MIN_FAT_PER_KG * Math.min(weightKg, 105)) - 1)
          failures.push(`${who}: ${fat_g}g fat, below the hormonal floor`);
        if (proteinPct > MAX_PROTEIN_PCT)
          failures.push(`${who}: ${proteinPct.toFixed(0)}% of calories from protein`);
        // The macros must actually add up to the calories they are shown beside.
        const fromMacros = protein_g * 4 + carbs_g * 4 + fat_g * 9;
        if (Math.abs(fromMacros - plan.calories) > 12)
          failures.push(`${who}: macros sum to ${fromMacros} but plan says ${plan.calories} kcal`);
      }
    }
  }
}

rmSync(TMP, { recursive: true, force: true });

console.log(`macro floor: ${checked} plans checked`);
console.log(`  lowest carbs   : ${minCarbs.g}g  (${minCarbs.who})`);
console.log(`  highest protein: ${maxProteinPct.pct.toFixed(0)}%  (${maxProteinPct.who})`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} unlivable plans`);
  failures.slice(0, 15).forEach((f) => console.error('  ' + f));
  if (failures.length > 15) console.error(`  ...and ${failures.length - 15} more`);
  process.exit(1);
}
console.log('PASS: every plan clears the carb floor, the fat floor and the protein ceiling');
