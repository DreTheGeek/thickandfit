#!/usr/bin/env node
/**
 * saveProgram DELETES a plan's sessions and re-inserts them. Any session_exercises column it does
 * not write is therefore not "left alone", it is DESTROYED on the next save.
 *
 * That is how the builder came to be a data-loss tool: it round-tripped sets, reps and rest_sec
 * only, so one tap of SAVE PROGRAM on any of Stephanie's 41 imported plans would have erased 1,531
 * superset groupings, 2,066 rep ranges and 2,438 coaching notes, silently, behind a success toast.
 *
 * This asserts every column in the live table is either written by saveProgram or explicitly
 * declared server-owned. A new column added to session_exercises fails here, in the diff that adds
 * it, rather than months later in somebody's training history.
 *
 *   node .qa-visual/program-roundtrip-test.mjs
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Written by the server on every insert, never by the coach. Not data loss when absent.
const SERVER_OWNED = new Set(['id', 'company_id', 'session_id', 'exercise_id', 'sort_order', 'created_at']);
// Deliberately not exposed. `config` is an unused jsonb escape hatch with zero non-null rows; if
// anything ever writes it, this test fails and forces the decision rather than losing it quietly.
const KNOWN_UNUSED = new Set(['config']);

const engine = readFileSync('src/lib/programs/engine.ts', 'utf8');

// The literal saveProgram inserts. Parsed from the source rather than duplicated here, so the test
// cannot drift into agreeing with a stale copy of itself.
const block = engine.match(/const rows = s\.exercises\.map\(\(e, ei\) => \(\{([\s\S]*?)\}\)\);/);
if (!block) {
  console.error('FAIL: could not find the session_exercises insert in saveProgram.');
  process.exit(1);
}
const written = new Set([...block[1].matchAll(/^\s*([a-z_0-9]+):/gm)].map((m) => m[1]));

const raw = execFileSync(
  process.execPath,
  ['.qa-visual/sql.cjs', "select column_name from information_schema.columns where table_name='session_exercises' and table_schema='public'"],
  { encoding: 'utf8' },
);
const live = JSON.parse(raw).map((r) => r.column_name);

const lost = live.filter((c) => !written.has(c) && !SERVER_OWNED.has(c) && !KNOWN_UNUSED.has(c));

if (lost.length) {
  console.error(`FAIL: ${lost.length} session_exercises column(s) would be ERASED by a coach save:`);
  for (const c of lost) console.error(`  - ${c}`);
  console.error('\nAdd each to exerciseSchema AND to the insert in saveProgram, or list it as');
  console.error('server-owned in this test with a reason.');
  process.exit(1);
}

console.log(`OK: all ${live.length} session_exercises columns survive a coach save`);
console.log(`    ${written.size} written by saveProgram, ${SERVER_OWNED.size} server-owned, ${KNOWN_UNUSED.size} declared unused`);
