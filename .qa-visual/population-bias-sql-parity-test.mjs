// Parity: aggregateBias() in TypeScript vs the plpgsql translation in 0102.
//
// The job moved into Postgres so it stops depending on Vercel being up. That is only a win if the
// arithmetic survived the move, and this is exactly the kind of rewrite where it quietly does not:
// median on even counts, clamp-before-or-after-rounding, the distinct-member floor, and whitespace
// normalization are four independent chances to be subtly off. A prior that is wrong by 15% is not
// obviously wrong, it just makes every scan of that food a little worse forever.
//
// So: generate a corpus, run BOTH implementations over the identical rows, and require the outputs
// to be identical. Runs against the real database (the SQL is executed there) but touches no table.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { aggregateBias, normalizeFoodKey } from '../src/lib/nutrition/population-bias.ts';

// Deterministic PRNG so a failure is reproducible and a pass is not luck.
let seed = 0x2f6e2b1;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// Each food is given a TRUE bias and enough clustered samples to sit on a specific side of each
// threshold. Uniform noise across every food (the first version of this test) makes every median
// land near 1.0, so nothing clears MIN_DEVIATION, both sides keep zero priors and the test passes
// while proving nothing. Every row below is here to exercise a named branch.
//
// Names also carry the normalization cases: mixed case, padding, internal whitespace runs, a tab,
// and a >120-char name that must truncate identically on both sides.
const FOODS = [
  { name: 'white rice',            bias: 1.35, n: 40, members: 5, expect: 'keep' },
  { name: 'Olive\tOil',            bias: 0.72, n: 24, members: 4, expect: 'keep, over-estimate' },
  { name: '  Grilled  Chicken  ',  bias: 1.05, n: 30, members: 5, expect: 'drop, deviation < 0.12' },
  { name: 'avocado',               bias: 3.20, n: 18, members: 4, expect: 'keep, clamped to 2.0' },
  { name: 'peanut butter',         bias: 0.22, n: 20, members: 4, expect: 'keep, clamped to 0.5' },
  { name: 'pasta',                 bias: 1.40, n: 5,  members: 3, expect: 'drop, samples < 6' },
  { name: 'ground beef',           bias: 1.50, n: 12, members: 2, expect: 'drop, members < 3' },
  { name: 'A'.repeat(140),         bias: 1.60, n: 10, members: 3, expect: 'keep, name truncated' },
  { name: 'salmon fillet',         bias: 1.30, n: 9,  members: 3, expect: 'keep' },
  { name: 'plain yogurt',          bias: 1.28, n: 6,  members: 3, expect: 'keep, exactly at both floors' },
];

const raw = [];
for (const f of FOODS) {
  for (let i = 0; i < f.n; i++) {
    // Tight noise so the MEDIAN lands on the intended side of the threshold rather than wandering.
    const ratio = f.bias * (1 + (rnd() - 0.5) * 0.12);
    const p = Math.round((40 + rnd() * 360) * 10) / 10;
    raw.push({ name: f.name, pid: `m${i % f.members}`, p, c: Math.round(p * ratio * 10) / 10 });
  }
}

// Rows that must be dropped by BOTH sides, not silently turned into a ratio.
raw.push({ name: 'white rice', pid: 'z1', p: 0, c: 100 });      // zero predicted
raw.push({ name: 'white rice', pid: 'z1', p: 100, c: 0 });      // zero corrected
raw.push({ name: 'white rice', pid: 'z1', p: -50, c: 100 });    // negative
raw.push({ name: '   ', pid: 'z2', p: 100, c: 120 });           // blank after normalization
raw.push({ name: 'white rice', pid: 'z3', p: 10, c: 5000 });    // ratio 500, past the 10x guard
raw.push({ name: 'white rice', pid: 'z4', p: 5000, c: 10 });    // ratio 0.002, past the 0.1 guard

// --- TypeScript side ------------------------------------------------------------------------------
const tsRows = aggregateBias(
  raw.map((r) => ({
    food: normalizeFoodKey(r.name),
    predictedGrams: r.p,
    correctedGrams: r.c,
    profileId: r.pid,
  })),
);

// --- SQL side: the exact CTE chain from 0102, over the same rows -----------------------------------
const payload = JSON.stringify(raw).replace(/'/g, "''");
const sql = `
with samples as (
  select
    left(regexp_replace(lower(btrim(s->>'name')), '\\s+', ' ', 'g'), 120) as food,
    s->>'pid' as profile_id,
    (s->>'p')::numeric as predicted_grams,
    (s->>'c')::numeric as corrected_grams
  from jsonb_array_elements('${payload}'::jsonb) s
),
valid as (
  select food, profile_id, corrected_grams / predicted_grams as ratio
  from samples
  where food <> '' and predicted_grams > 0 and corrected_grams > 0
    and corrected_grams / predicted_grams between 0.1 and 10
),
counted as (
  select food, count(*)::int as samples, count(distinct profile_id)::int as members,
         percentile_cont(0.5) within group (order by ratio) as raw_ratio
  from valid group by food
),
kept as (
  select food, samples, members, round(least(2.0, greatest(0.5, raw_ratio::numeric)), 2) as ratio
  from counted
  where samples >= 6 and members >= 3 and abs(raw_ratio - 1) >= 0.12
)
select food, ratio::float8 as ratio, samples, members from kept order by food
`;

// Via a file: the corpus makes this query ~50KB, well past the Windows command-line cap.
const qf = join(mkdtempSync(join(tmpdir(), 'bias-parity-')), 'q.sql');
writeFileSync(qf, sql, 'utf8');
const out = execFileSync('node', ['.qa-visual/sql.cjs', `--file=${qf}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
const jsonStart = out.indexOf('[');
if (jsonStart < 0) {
  console.log('could not read SQL result:\n', out.slice(0, 800));
  process.exit(1);
}
const sqlRows = JSON.parse(out.slice(jsonStart, out.lastIndexOf(']') + 1));

// --- compare ---------------------------------------------------------------------------------------
const norm = (rows) =>
  [...rows]
    .map((r) => ({
      food: r.food,
      ratio: Number(r.ratio),
      samples: Number(r.samples),
      members: Number(r.members),
    }))
    .sort((a, b) => (a.food < b.food ? -1 : a.food > b.food ? 1 : 0));

const A = norm(tsRows.map((r) => ({ food: r.food, ratio: r.ratio, samples: r.samples, members: r.members })));
const B = norm(sqlRows);

console.log(`corpus: ${raw.length} corrections across ${FOODS.length} foods`);
console.log(`  TypeScript kept: ${A.length} priors`);
console.log(`  SQL kept:        ${B.length} priors\n`);

const fails = [];
if (A.length !== B.length) fails.push(`row count: ts=${A.length} sql=${B.length}`);

// Two implementations that both keep nothing agree perfectly and prove nothing. The corpus is built
// so that exactly the foods marked 'keep' survive; assert that, or this file is decoration.
const expectedKept = FOODS.filter((f) => f.expect.startsWith('keep')).length;
if (A.length !== expectedKept) {
  fails.push(`corpus no longer exercises the thresholds: expected ${expectedKept} kept, TS kept ${A.length}`);
}
// And that the clamps actually fired, rather than the noise happening to stay inside them.
if (!A.some((r) => r.ratio === 2) || !A.some((r) => r.ratio === 0.5)) {
  fails.push('neither clamp boundary was reached; the clamp path is untested');
}

const seen = new Set([...A.map((r) => r.food), ...B.map((r) => r.food)]);
for (const food of [...seen].sort()) {
  const a = A.find((r) => r.food === food);
  const b = B.find((r) => r.food === food);
  if (!a) { fails.push(`"${food}": only SQL kept it`); continue; }
  if (!b) { fails.push(`"${food}": only TS kept it`); continue; }
  const label = food.length > 30 ? `${food.slice(0, 27)}...` : food;
  const same = a.ratio === b.ratio && a.samples === b.samples && a.members === b.members;
  console.log(
    `  ${same ? 'ok  ' : 'FAIL'} ${label.padEnd(32)} ratio ${a.ratio} / ${b.ratio}   n ${a.samples} / ${b.samples}   members ${a.members} / ${b.members}`,
  );
  if (!same) fails.push(`"${food}": ts=${JSON.stringify(a)} sql=${JSON.stringify(b)}`);
}

if (fails.length) {
  console.log('\nFAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
console.log('\nPASS: plpgsql and TypeScript produce identical priors.');
