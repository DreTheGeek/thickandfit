// Run a .sql file against the project via the Management API. Usage: node apply-file.cjs path.sql
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
const file = process.argv[2];
const sql = fs.readFileSync(file, 'utf8');

fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
  .then(async (r) => {
    const t = await r.text();
    if (!r.ok) { console.error('HTTP', r.status, t.slice(0, 600)); process.exit(1); }
    console.log('OK', file);
    try { console.log(JSON.stringify(JSON.parse(t))); } catch { console.log(t.slice(0, 200)); }
  })
  .catch((e) => { console.error('FATAL', e.message); process.exit(1); });
