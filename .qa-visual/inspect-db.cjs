// Inspect the Supabase project: list every exposed table, its columns, and row counts,
// so we can see what Rodney migrated from Lenus. Reads .env.local internally; prints
// schema + counts only (no client PII values).
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// note any direct-postgres URL (lets us inspect non-public schemas later if needed)
const pgKeys = Object.keys(env).filter((k) => /(DATABASE_URL|POSTGRES|DB_URL|DIRECT_URL)/.test(k));
console.log('env keys present:', Object.keys(env).join(', '));
console.log('postgres-conn keys:', pgKeys.length ? pgKeys.join(', ') : 'none');
console.log('project url:', URL);
console.log('');

(async () => {
  // 1) table list + columns from the PostgREST OpenAPI root
  const res = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const spec = await res.json();
  const defs = spec.definitions || (spec.components && spec.components.schemas) || {};
  const tables = Object.keys(defs).sort();
  console.log('exposed tables (public schema):', tables.length);

  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const rows = [];
  for (const t of tables) {
    let count = null;
    try {
      const { count: c } = await sb.from(t).select('*', { count: 'exact', head: true });
      count = c;
    } catch {
      count = 'err';
    }
    const cols = Object.keys((defs[t] && defs[t].properties) || {});
    rows.push({ t, count: count ?? 0, cols });
  }
  rows.sort((a, b) => (b.count || 0) - (a.count || 0));

  console.log('\n=== TABLES BY ROW COUNT ===');
  for (const r of rows) console.log(`${String(r.count).padStart(7)}  ${r.t}`);

  console.log('\n=== NON-EMPTY TABLES: columns ===');
  for (const r of rows.filter((x) => (x.count || 0) > 0)) {
    console.log(`\n# ${r.t} (${r.count} rows)\n  ${r.cols.join(', ')}`);
  }

  // 2) legacy/Lenus signal in profiles
  try {
    const { count: legacy } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_legacy_client', true);
    const { count: lenus } = await sb.from('profiles').select('*', { count: 'exact', head: true }).not('lenus_profile_id', 'is', null);
    console.log(`\n=== LEGACY SIGNAL in profiles ===\nis_legacy_client=true: ${legacy}\nlenus_profile_id set: ${lenus}`);
  } catch (e) {
    console.log('legacy check error:', e.message);
  }

  // 3) companies
  try {
    const { data: cos } = await sb.from('companies').select('id, name, slug');
    console.log('\n=== COMPANIES ===');
    (cos || []).forEach((c) => console.log(`  ${c.slug || '-'}  ${c.name || '-'}  (${c.id})`));
  } catch (e) {
    console.log('companies error:', e.message);
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
