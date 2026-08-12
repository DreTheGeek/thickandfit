// Prove what the Lenus sweep actually captured, before the account closes on 31 August.
//
// WHY THIS EXISTS. Every hole found in the July extract was invisible from the outside: the run
// reported success, raw_client_extract had rows in it, and nobody could see that
// ClientCheckinDashboardView_checkInResponse had returned nothing for 265 clients straight. A sweep
// that cannot be measured is a sweep you will discover the gaps in after the account is gone.
//
// Definition of done, from .planning/STATE.md: run it twice and the counts do not move. That is
// what --snapshot and --diff are for. Everything else here answers "and is what we captured
// actually the whole thing".
//
// Usage:
//   node scripts/lenus-verify.mjs                    summary table, cheap
//   node scripts/lenus-verify.mjs --checkins         the ids-vs-bodies gap, per client
//   node scripts/lenus-verify.mjs --shape <opName>   keys-only shape of one stored payload
//   node scripts/lenus-verify.mjs --freshness        newest timestamp per operation (SLOW, sampled)
//   node scripts/lenus-verify.mjs --snapshot         write a counts snapshot to .capture/
//   node scripts/lenus-verify.mjs --diff <file>      compare against a snapshot: the run-twice proof
//
// Reads only. Writes nothing to the database.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};

const n = (v) => Number(v ?? 0).toLocaleString('en-US');

// --- the summary ------------------------------------------------------------
// Bytes matter as much as row counts here. A pagination regression shows up as the same number of
// clients carrying a tenth of the payload, which a client count alone would report as healthy.
function summary() {
  const rows = sql(`
    select operation,
           count(*)                                        as clients,
           sum(pg_column_size(data))                       as bytes,
           min(fetched_at)::date                           as first_captured,
           max(fetched_at)::date                           as last_captured
    from lenus.raw_client_extract
    group by operation
    order by sum(pg_column_size(data)) desc
  `);
  const roster = sql(`select count(distinct profile_id) as c from lenus.raw_client_extract`);

  console.log(`\nraw_client_extract: ${n(roster[0]?.c)} distinct clients, ${rows.length} operations\n`);
  const w = Math.max(...rows.map((r) => r.operation.length), 9);
  console.log(`${'operation'.padEnd(w)}  ${'clients'.padStart(7)}  ${'MB'.padStart(8)}  captured`);
  console.log('-'.repeat(w + 40));
  for (const r of rows) {
    const mb = (Number(r.bytes) / 1048576).toFixed(1);
    const when = r.first_captured === r.last_captured ? r.last_captured : `${r.first_captured}..${r.last_captured}`;
    console.log(`${r.operation.padEnd(w)}  ${String(r.clients).padStart(7)}  ${mb.padStart(8)}  ${when}`);
  }

  // The operations we ASKED for but have zero rows of are the silent failures. This is the check
  // that would have caught the check-in hole on 3 July.
  const expected = expectedOps();
  const got = new Set(rows.map((r) => r.operation));
  const missing = expected.filter((o) => !got.has(o));
  if (missing.length) {
    console.log(`\nMISSING ENTIRELY (${missing.length}). The extractor asks for these and stored none:`);
    for (const m of missing) console.log(`  ${m}`);
  }
  return rows;
}

// Read the operation list out of the extractor itself rather than duplicating it, so the two cannot
// drift apart and quietly stop checking a newly added operation.
function expectedOps() {
  try {
    const src = readFileSync('scripts/lenus-export.js', 'utf8');
    const block = src.match(/const OPS = \[([\s\S]*?)\];/);
    if (!block) return [];
    return [...block[1].matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

// --- check-ins: the specific hole -------------------------------------------
// 765 response IDs were captured and 0 bodies. After a fixed sweep these two numbers should track
// each other. They will not match exactly (the fan-out is capped per client, and Lenus can refuse
// an individual body), but a bodies column of zeros means the fan-out is still broken.
function checkins() {
  const rows = sql(`
    select l.profile_id,
           l.full_name,
           jsonb_array_length(coalesce(jsonb_path_query_array(l.data, 'strict $.**.id'), '[]'::jsonb)) as id_count,
           coalesce(b.body_count, 0) as body_count
    from lenus.raw_client_extract l
    left join lateral (
      select case when jsonb_typeof(r.data) = 'array' then jsonb_array_length(r.data) else 1 end as body_count
      from lenus.raw_client_extract r
      where r.profile_id = l.profile_id
        and r.operation = 'ClientCheckinDashboardView_checkInResponse'
    ) b on true
    where l.operation = 'ClientInfoCheckinsContext_CheckInResponses'
    order by 3 desc
    limit 40
  `);
  const totals = rows.reduce(
    (a, r) => ({ ids: a.ids + Number(r.id_count), bodies: a.bodies + Number(r.body_count) }),
    { ids: 0, bodies: 0 },
  );
  console.log(`\ncheck-ins, top 40 clients by id count: ${n(totals.ids)} ids, ${n(totals.bodies)} bodies\n`);
  for (const r of rows.slice(0, 15)) {
    const flag = Number(r.body_count) === 0 && Number(r.id_count) > 0 ? '  <-- ids but no bodies' : '';
    console.log(`  ${String(r.full_name ?? r.profile_id).padEnd(28)} ${String(r.id_count).padStart(4)} ids  ${String(r.body_count).padStart(4)} bodies${flag}`);
  }
  if (totals.bodies === 0) {
    console.log('\n  Every body count is zero. The fan-out in scripts/lenus-export.js is not landing.');
    console.log('  Check the console during the sweep for the "ids, 0 bodies" warning: it names the variable it tried.');
  }
}

// --- shape, keys only -------------------------------------------------------
// Keys, never values. This gets pasted into a commit message or a chat to design the mapper against,
// and the values are her members' bodies and moods.
function shape(op) {
  const rows = sql(`
    select data from lenus.raw_client_extract
    where operation = '${op.replace(/'/g, "''")}'
    order by pg_column_size(data) desc
    limit 1
  `);
  if (!rows.length) return console.log(`\nno stored payload for ${op}`);
  const keysOnly = (node, depth = 0) => {
    if (depth > 8) return '...';
    if (Array.isArray(node)) return node.length ? [keysOnly(node[0], depth + 1), `+${node.length - 1} more`] : [];
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = keysOnly(v, depth + 1);
      return out;
    }
    return typeof node;
  };
  console.log(`\nshape of ${op} (keys and types only, no values):\n`);
  console.log(JSON.stringify(keysOnly(rows[0].data), null, 2));
}

// --- content freshness ------------------------------------------------------
// The capture date says when we ASKED. This says how recent the newest record inside actually is,
// which is the number that showed the extract was frozen at 3 July. Sampled and bounded because an
// unbounded regex over ~400MB of jsonb will sit there.
function freshness() {
  console.log('\nnewest timestamp found inside each operation (sampled, 40 rows per operation):\n');
  const ops = sql(`select distinct operation from lenus.raw_client_extract order by 1`);
  for (const { operation } of ops) {
    try {
      const r = sql(`
        with sample as (
          select data::text as t from lenus.raw_client_extract
          where operation = '${operation.replace(/'/g, "''")}'
          order by pg_column_size(data) desc limit 40
        )
        select max(m[1]) as newest
        from sample, lateral regexp_matches(t, '(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})', 'g') as m
      `);
      console.log(`  ${operation.padEnd(46)} ${r[0]?.newest ?? 'no timestamps'}`);
    } catch {
      console.log(`  ${operation.padEnd(46)} (probe failed, payload too large)`);
    }
  }
}

// --- the run-twice proof ----------------------------------------------------
function snapshot(rows) {
  mkdirSync('.capture', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `.capture/lenus-verify-${stamp}.json`;
  const doc = Object.fromEntries(rows.map((r) => [r.operation, { clients: Number(r.clients), bytes: Number(r.bytes) }]));
  writeFileSync(path, JSON.stringify(doc, null, 2));
  console.log(`\nsnapshot written: ${path}`);
  console.log(`re-run the sweep, then: node scripts/lenus-verify.mjs --diff ${path}`);
}

function diff(rows, file) {
  const before = JSON.parse(readFileSync(file, 'utf8'));
  const after = Object.fromEntries(rows.map((r) => [r.operation, { clients: Number(r.clients), bytes: Number(r.bytes) }]));
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  let moved = 0;
  let shrank = 0;
  console.log(`\ndiff against ${file}\n`);
  for (const op of names) {
    const b = before[op] ?? { clients: 0, bytes: 0 };
    const a = after[op] ?? { clients: 0, bytes: 0 };
    const dc = a.clients - b.clients;
    const db = a.bytes - b.bytes;
    if (dc === 0 && db === 0) continue;
    moved++;
    if (db < 0) shrank++;
    const pct = b.bytes ? ((db / b.bytes) * 100).toFixed(1) : 'new';
    console.log(`  ${op.padEnd(46)} clients ${dc >= 0 ? '+' : ''}${dc}  bytes ${db >= 0 ? '+' : ''}${n(db)} (${pct}%)${db < 0 ? '   <-- SHRANK' : ''}`);
  }
  if (!moved) {
    console.log('  nothing moved. The sweep is idempotent and the capture is complete.');
  } else {
    console.log(`\n  ${moved} operations moved, ${shrank} shrank.`);
    if (shrank) {
      console.log('  A shrink means the second run captured LESS than the first. That is the failure mode');
      console.log('  the ingest shrink guard exists to block, so check the function logs for');
      console.log('  "refused shrinking writes" before assuming Lenus lost the rows.');
    }
  }
}

// --- main -------------------------------------------------------------------
try {
  if (has('--shape')) {
    shape(val('--shape'));
  } else {
    const rows = summary();
    if (has('--checkins')) checkins();
    if (has('--freshness')) freshness();
    if (has('--snapshot')) snapshot(rows);
    if (has('--diff')) diff(rows, val('--diff'));
  }
} catch (e) {
  console.error('\nFAILED:', e.message);
  console.error('This runs against the live database via .qa-visual/sql.cjs, so it needs .env.local');
  console.error('with SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL. It does not work from CI.');
  process.exit(1);
}
