// Every table and column the migrations declare must actually exist in the database.
//
// THE BUG CLASS THIS EXISTS FOR. Migrations in this repo are applied by hand, so code and schema
// ship separately, and this app fails open everywhere: a call site that selects a missing column
// logs to console and returns []. So an unapplied migration produces no error page, no Sentry
// spike, and no failing test. It produces a calm, empty screen.
//
// It has happened twice, and cost real things both times:
//
//   0140-0143 sat unapplied for five days. Her whole 41-program library read as EMPTY in the coach
//   console and in the assignment picker; getEngagementSweep returned zero rows, so the daily cron
//   ran, logged success and sent nothing to anybody; and every app-signup member record 404'd.
//
//   0144 sat unapplied for six. generateSeasonalCampaigns reads seasonal_campaigns, so the third of
//   the three automated senders was silently dead.
//
// tenant-boundary-test.mjs reads the SQL FILES and passed throughout both. That is the gap: it
// checks what the migrations SAY, and this checks whether anyone ran them.
//
// Run: node .qa-visual/schema-applied-test.mjs
import fs from 'node:fs';
import path from 'node:path';

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(`query failed: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

// What the migrations declare.
const dir = 'supabase/migrations';
const wantTables = new Set();
const wantColumns = new Set();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of text.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi)) {
    wantTables.add(m[1].toLowerCase());
  }
  // Only ADD COLUMN. A column introduced inside CREATE TABLE is covered by the table check, and
  // parsing those bodies would mean parsing SQL rather than grepping it.
  for (const m of text.matchAll(/alter table (?:only )?(?:public\.)?([a-z_]+)\s+add column (?:if not exists )?([a-z_]+)/gi)) {
    wantColumns.add(`${m[1].toLowerCase()}.${m[2].toLowerCase()}`);
  }
}

// What the database has.
const [{ t: haveTablesRaw }] = await sql(
  `select string_agg(table_name, ',' order by table_name) t
     from information_schema.tables where table_schema='public'`,
);
const [{ c: haveColumnsRaw }] = await sql(
  `select string_agg(table_name||'.'||column_name, ',') c
     from information_schema.columns where table_schema='public'`,
);
const haveTables = new Set((haveTablesRaw ?? '').split(','));
const haveColumns = new Set((haveColumnsRaw ?? '').split(','));

const missingTables = [...wantTables].filter((t) => !haveTables.has(t));
const missingColumns = [...wantColumns].filter((c) => !haveColumns.has(c));

console.log(`migrations declare ${wantTables.size} tables and ${wantColumns.size} added columns`);
console.log(`database has ${haveTables.size} tables`);

for (const t of missingTables) console.error(`  x TABLE MISSING: ${t}`);
for (const c of missingColumns) console.error(`  x COLUMN MISSING: ${c}`);

const failures = missingTables.length + missingColumns.length;
if (failures) {
  console.error(
    `\nFAILED: ${failures} declared object(s) are not in the database.\n` +
      `Apply the migration that declares them:\n` +
      `  node .qa-visual/sql.cjs --file=supabase/migrations/<file>.sql\n` +
      `Nothing will throw while they are missing. The screens that read them just go quiet.`,
  );
  process.exit(1);
}
console.log('\nOK: every table and column the migrations declare exists');
