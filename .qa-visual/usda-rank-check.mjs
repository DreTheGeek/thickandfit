// Does the USDA ranker still hand back the LEAN row for a fried food?
//
// THE TRAP. USDA carries several rows per cut, and they differ by exactly the thing that is the fat:
//
//   Chicken, broilers or fryers, thigh, meat only, cooked, fried              218 kcal  10.3g fat
//   Chicken, broilers or fryers, thigh, meat and skin, cooked, fried, batter  277 kcal  16.5g fat
//   Fast Foods, Fried Chicken, Thigh, meat and skin and breading              274 kcal  18.1g fat
//   KFC, Fried Chicken, EXTRA CRISPY, Thigh, meat and skin with breading      309 kcal  22.1g fat
//
// The old scorer picked the FIRST one, on two accidents: "meat only" is the shortest description,
// and it happens to contain the word "cooked" while the better rows say "breading" where the query
// said "breaded". Nobody eats the meat only off a piece of fried chicken. The skin and the batter
// are why it was fried, and stripping them halves the fat in the direction that hides calories from
// a member holding a deficit.
//
// Runs against the LIVE API, because that is where the trap lives: the ranking is a property of what
// USDA actually returns for a query, and a fixture would freeze one day's results and stop testing
// the thing.
//
//   node --env-file=.env.local .qa-visual/usda-rank-check.mjs
//
// USE A REAL KEY. It falls back to DEMO_KEY, which USDA throttles at roughly 30 requests an hour per
// IP, so a second run inside the hour returns 429 for every case. `USDA_API_KEY` is set in Vercel
// production but is NOT in .env.local, so pull it or paste it inline:
//
//   USDA_API_KEY=<key> node .qa-visual/usda-rank-check.mjs
//
// A run where every case was skipped exits NON-ZERO on purpose. "Nothing was verified" must not be
// able to read as a pass, which is the same rule the re-engagement ladder's 5,000-row cap follows.
//
// It replicates pickBestUsda rather than importing it: that function lives in external-foods.ts,
// which is `server-only`. The RULES it depends on are imported from the shipped modules, so the part
// that decides the answer is real. Restate the loop here if that function is restructured.
import { readPreparation, preparationAgreement } from '../src/lib/nutrition/preparation.ts';
import { brandConflicts, isPlausiblePer100g, penaltyApplies, usdaBrandOf } from '../src/lib/nutrition/usda-match.ts';

const KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const NUT = { kcal: 1008, protein: 1003, carbs: 1005, fat: 1004 };
const USDA_PENALTY = ['oil', 'supplement', 'infant', 'baby', 'formula', 'flavored'];
const val = (f, id) => (f.foodNutrients ?? []).find((n) => n.nutrientId === id)?.value ?? null;

function pickBestUsda(query, foods) {
  const ql = query.toLowerCase();
  const qWords = ql.split(/\s+/).filter((w) => w.length > 2);
  const wantedPrep = readPreparation(query);
  let best = null;
  let bestScore = 0;
  for (const f of foods) {
    const desc = (f.description ?? '').toLowerCase();
    if (!desc) continue;
    if (brandConflicts(query, f)) continue;
    const kcal = val(f, NUT.kcal);
    if (kcal != null && !isPlausiblePer100g(kcal, val(f, NUT.protein) ?? 0, val(f, NUT.carbs) ?? 0, val(f, NUT.fat) ?? 0)) continue;
    let s = 0;
    for (const w of qWords) if (desc.includes(w)) s += 2;
    for (const b of USDA_PENALTY) if (penaltyApplies(desc, b) && !ql.includes(b)) s -= 5;
    s += preparationAgreement(wantedPrep, readPreparation(desc)) * 6;
    s -= desc.length / 200;
    if (usdaBrandOf(f)) s -= 1;
    if (s > bestScore) { bestScore = s; best = f; }
  }
  return best;
}

/**
 * `minFatG` is the floor the OLD scorer failed, not a target. The point is never a specific row: it
 * is that a fried, breaded piece of chicken cannot resolve to a row carrying single-digit fat.
 */
const CASES = [
  { q: 'fried chicken thigh, cooked, breaded', minFatG: 14, reject: /meat only/i },
  { q: 'fried chicken drumstick, cooked, breaded', minFatG: 12, reject: /meat only/i },
  { q: 'KFC fried chicken thigh, breaded, with skin', minFatG: 18, expect: /kfc/i },
  { q: 'KFC fried chicken drumstick, breaded, with skin', minFatG: 14, expect: /kfc/i },
  // A mix is not the food. 428 kcal/100g is the flour in the box.
  { q: 'buttermilk biscuit', reject: /dry mix|unprepared/i },
  // Regressions. Nothing about a food that was never fried should have moved, and a lean row is the
  // RIGHT answer when the member says the food is lean.
  { q: 'grilled chicken breast', maxFatG: 6 },
  { q: 'boiled egg', reject: /fried/i },
  { q: 'steamed broccoli', reject: /fried|oil/i },
];

const fails = [];
let checked = 0;

for (const c of CASES) {
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(c.q)}` +
    `&dataType=Foundation,SR%20Legacy&pageSize=20&api_key=${KEY}`;
  let foods = [];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  SKIP  "${c.q}" (USDA returned HTTP ${res.status})`);
      continue;
    }
    foods = (await res.json()).foods ?? [];
  } catch (e) {
    console.error(`  SKIP  "${c.q}" (${String(e).slice(0, 60)})`);
    continue;
  }
  if (!foods.length) {
    console.error(`  SKIP  "${c.q}" (USDA returned nothing)`);
    continue;
  }

  checked += 1;
  const hit = pickBestUsda(c.q, foods);
  const desc = hit?.description ?? '';
  const fat = hit ? val(hit, NUT.fat) : null;
  const kcal = hit ? val(hit, NUT.kcal) : null;
  const bad = [];
  if (!hit) bad.push('no row chosen');
  if (c.minFatG != null && (fat ?? 0) < c.minFatG) bad.push(`fat ${fat}g is below the ${c.minFatG}g floor`);
  if (c.maxFatG != null && (fat ?? 0) > c.maxFatG) bad.push(`fat ${fat}g is above the ${c.maxFatG}g ceiling`);
  if (c.reject && c.reject.test(desc)) bad.push(`chose a rejected row (${c.reject})`);
  if (c.expect && !c.expect.test(desc)) bad.push(`expected ${c.expect}`);

  console.log(`  ${bad.length ? 'FAIL' : 'ok  '}  "${c.q}"`);
  console.log(`          -> ${desc.slice(0, 70)}  (${Math.round(kcal ?? 0)} kcal, ${fat ?? '?'}g fat)`);
  for (const b of bad) console.log(`          !! ${b}`);
  if (bad.length) fails.push(`${c.q}: ${bad.join('; ')}`);
}

if (!checked) {
  console.error('\nUSDA was unreachable for every case, so nothing was verified.');
  process.exit(1);
}
if (fails.length) {
  console.error(`\nFAIL (${fails.length}/${checked})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\nusda rank: PASS (${checked} queries), no fried food resolves to a lean row`);
