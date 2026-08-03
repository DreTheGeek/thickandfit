// Generic read/inspect SQL runner against the project via the Management API.
// Usage: node .qa-visual/sql.cjs "select ..."
//        node .qa-visual/sql.cjs --file=path/to/query.sql
//
// The --file form exists because Windows caps a command line around 32KB, and a query carrying an
// inline corpus (the population-bias parity test sends ~50KB of jsonb) dies with ENAMETOOLONG before
// it ever reaches Postgres.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
const arg = process.argv[2];
if (!arg) { console.error('pass SQL as arg, or --file=path'); process.exit(1); }
const sql = arg.startsWith('--file=') ? fs.readFileSync(arg.slice(7), 'utf8') : arg;

fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.text())
  .then((t) => { try { console.log(JSON.stringify(JSON.parse(t), null, 2)); } catch { console.log(t); } })
  .catch((e) => { console.error('FATAL', e.message); process.exit(1); });
