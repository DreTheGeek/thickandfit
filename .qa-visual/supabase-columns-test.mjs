#!/usr/bin/env node
/**
 * Every column name this codebase asks Supabase for, checked against the live database.
 *
 * THE FAILURE THIS CATCHES, which has now happened three times in three days:
 *
 *   getCoachOnboarding counted `knowledge_entries`      -> the table is `coach_knowledge`
 *   getCoachOnboarding selected `id` from coach_settings -> that table has no id column
 *   getCoachOnboarding filtered plan_assignments.created_by -> the column is assigned_by (0149)
 *
 * None of them throws. PostgREST returns an error object, this codebase's convention is to log it
 * and return an empty result, and the screen renders a plausible zero. A checklist step sits
 * permanently unticked, a queue reads as empty, a library looks like it has nothing in it. tsc
 * cannot see column names and eslint cannot either, so a typo here is invisible until somebody
 * notices a number that should not be zero, which for a churn queue is never.
 *
 * It is the same shape as .qa-visual/schema-applied-test.mjs, from the other direction: that one
 * asks whether the migrations were run, this one asks whether the code agrees with what they made.
 *
 *   node .qa-visual/supabase-columns-test.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------- the live schema
const raw = execFileSync(
  process.execPath,
  [
    '.qa-visual/sql.cjs',
    "select table_schema, table_name, column_name from information_schema.columns where table_schema in ('public','lenus')",
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);
// Keyed 'schema.table'. The Lenus import reads a hidden `lenus` schema through PostgREST's
// .schema() switch, and a checker that only knew about `public` reported both of those tables as
// missing - which is the fastest way to get a test like this switched off.
const schema = new Map();
for (const r of JSON.parse(raw)) {
  const key = `${r.table_schema}.${r.table_name}`;
  if (!schema.has(key)) schema.set(key, new Set());
  schema.get(key).add(r.column_name);
}

// ---------------------------------------------------------------- the source
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const problems = [];
// PostgREST accepts modifiers and embedded resources that are not plain column names. Anything with
// these in it is skipped rather than guessed at: a false alarm here would get the whole test
// switched off, which costs more than the cases it would catch.
// `${...}` is a template literal: the column list is assembled elsewhere and this cannot read it.
const SKIP = /[()!:*]|->|\$\{/;

/**
 * Comments are stripped before scanning, and that is not cosmetic. This file's own convention is to
 * write the query you must NOT make directly above the one you should - "NEVER add
 * .is('archived_at', null) here" - so a scanner that reads comments reports the warning as the bug.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ 	]*\/\/.*$/gm, '');
}
const COUNT_ONLY = new Set(['count', 'exact', 'head']);

for (const file of walk('src')) {
  const src = stripComments(readFileSync(file, 'utf8'));
  // Each .from('table') opens a chain; the chain ends at the next .from( or the end of statement.
  const froms = [...src.matchAll(/(?:\.schema\(\s*['"`]([a-z0-9_]+)['"`]\s*\)\s*)?\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g)];
  for (let i = 0; i < froms.length; i++) {
    const table = `${froms[i][1] ?? 'public'}.${froms[i][2]}`;
    // A table name that is itself unknown is the loudest version of this bug.
    if (!schema.has(table)) {
      // Not every .from() is Supabase (Array.from, and a few local helpers). Only flag it when the
      // chain that follows looks like a query.
      const tail0 = src.slice(froms[i].index, froms[i].index + 400);
      if (/\.(select|insert|upsert|update|delete)\(/.test(tail0)) {
        problems.push(`${file}: table '${table}' does not exist`);
      }
      continue;
    }
    const cols = schema.get(table);
    /**
     * Where this chain ENDS, and getting it wrong is how a checker invents findings.
     *
     * A fixed lookahead window ran past the end of the statement and picked up
     * `rowQuery.in('user_id', ids)` - a different query object entirely - as though it were a
     * filter on the profiles select above it. Bounded at the statement terminator instead, or at
     * the next .from(), whichever comes first.
     */
    const semi = src.indexOf(';', froms[i].index);
    const nextFrom = i + 1 < froms.length ? froms[i + 1].index : src.length;
    const end = Math.min(nextFrom, semi === -1 ? src.length : semi);
    const chain = src.slice(froms[i].index, end);

    // .select('a, b, c')
    for (const m of chain.matchAll(/\.select\(\s*['"`]([^'"`]*)['"`]/g)) {
      const body = m[1];
      if (SKIP.test(body)) continue;
      for (const piece of body.split(',')) {
        const col = piece.trim();
        if (!col || COUNT_ONLY.has(col)) continue;
        if (!cols.has(col)) problems.push(`${file}: ${table}.select -> no column '${col}'`);
      }
    }

    // .eq('col', ...) and friends. Only the filters whose first argument is a bare column.
    for (const m of chain.matchAll(
      /\.(eq|neq|gt|gte|lt|lte|is|in|like|ilike|contains|order|not)\(\s*['"`]([^'"`]+)['"`]/g,
    )) {
      const col = m[2].trim();
      if (SKIP.test(col) || col.includes('.')) continue;
      if (!cols.has(col)) problems.push(`${file}: ${table}.${m[1]}('${col}') -> no such column`);
    }
  }
}

if (problems.length) {
  console.error(`FAIL: ${problems.length} query/schema mismatch(es).`);
  console.error('Each one FAILS OPEN at runtime: an error object, a logged line, and a zero.\n');
  for (const p of [...new Set(problems)]) console.error('  - ' + p);
  process.exit(1);
}
console.log(`OK: every table and column referenced in src/ exists (${schema.size} tables checked)`);
