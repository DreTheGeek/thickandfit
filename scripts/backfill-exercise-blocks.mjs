// Give her 367 movements the grouping she already thinks in.
//
// muscle_group is null on 360 of them, so the library's chips were built from the 7 rows that
// happen to carry one and everything else was a flat A-Z grid ten pages deep. `block` fixes that
// using her own session vocabulary; see src/lib/exercises/blocks.ts for where those names come from.
//
// Re-runnable: it recomputes every row and only writes the ones whose block changed, so tightening
// a rule in blocks.ts and running this again is the intended workflow.
//
// Usage: node scripts/backfill-exercise-blocks.mjs [--dry] [--all]
//   --all  also classify the imported seed library, not just her own rows
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { blockFor, BLOCK_ORDER } from '../src/lib/exercises/blocks.ts';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ALL = args.includes('--all');

function loadEnv() {
  const out = {};
  if (!fs.existsSync('.env.local')) return out;
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let q = sb.from('exercises').select('id, name_en, muscle_group, block').is('archived_at', null).limit(3000);
if (!ALL) q = q.eq('is_coach_authored', true);
const { data: rows, error } = await q;
if (error) {
  console.error('read:', error.message);
  process.exit(1);
}

const counts = new Map();
const changes = [];
for (const r of rows) {
  const block = blockFor(r.name_en, r.muscle_group);
  counts.set(block ?? 'unsorted', (counts.get(block ?? 'unsorted') ?? 0) + 1);
  if (block !== r.block) changes.push({ id: r.id, name: r.name_en, from: r.block, to: block });
}

console.log(`${rows.length} rows considered`);
for (const b of [...BLOCK_ORDER, 'unsorted']) if (counts.get(b)) console.log(`  ${b}: ${counts.get(b)}`);

// Unsorted names are printed in full, never hidden: they are the input to the next rule tweak, and
// a movement quietly filed under a wrong heading is worse than one she has to eyeball.
const unsorted = rows.filter((r) => blockFor(r.name_en, r.muscle_group) === null);
if (unsorted.length) console.log(`\nunsorted (${unsorted.length}): ${unsorted.map((r) => r.name_en).join(' | ')}`);

console.log(`\n${changes.length} row(s) would change`);
if (DRY || !changes.length) process.exit(0);

let written = 0;
for (let i = 0; i < changes.length; i += 25) {
  await Promise.all(
    changes.slice(i, i + 25).map(async (c) => {
      const { error: upErr } = await sb.from('exercises').update({ block: c.to }).eq('id', c.id);
      if (upErr) console.error(`${c.name}: ${upErr.message}`);
      else written += 1;
    }),
  );
}
console.log(`wrote ${written}`);
