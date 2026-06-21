// Use the Supabase Management API (SUPABASE_ACCESS_TOKEN) to inspect ALL schemas/tables,
// including anything Rodney may have loaded outside the public schema. Schema + counts only.
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

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) return { error: `${r.status}: ${text.slice(0, 200)}` };
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

(async () => {
  console.log('ref:', ref, '\n');

  console.log('=== ALL NON-SYSTEM SCHEMAS ===');
  const schemas = await q(`
    select nspname as schema, count(c.*) as tables
    from pg_namespace n
    left join pg_class c on c.relnamespace = n.oid and c.relkind = 'r'
    where nspname not in ('pg_catalog','information_schema','pg_toast')
    group by nspname order by 2 desc;`);
  console.log(JSON.stringify(schemas, null, 2));

  console.log('\n=== EVERY USER TABLE WITH ROW ESTIMATES (all schemas) ===');
  const tables = await q(`
    select schemaname, relname, n_live_tup
    from pg_stat_user_tables
    where n_live_tup > 0
    order by n_live_tup desc;`);
  console.log(JSON.stringify(tables, null, 2));

  console.log('\n=== AUTH USERS ===');
  const users = await q(`select count(*) as auth_users from auth.users;`);
  console.log(JSON.stringify(users));

  console.log('\n=== STORAGE BUCKETS / OBJECTS ===');
  const storage = await q(`
    select b.name as bucket, count(o.*) as objects
    from storage.buckets b left join storage.objects o on o.bucket_id = b.id
    group by b.name order by 2 desc;`);
  console.log(JSON.stringify(storage));

  console.log('\n=== ANYTHING NAMED lenus/import/staging/legacy/raw? ===');
  const named = await q(`
    select table_schema, table_name from information_schema.tables
    where (table_name ilike '%lenus%' or table_name ilike '%import%' or table_name ilike '%staging%'
        or table_name ilike '%legacy%' or table_name ilike '%raw%' or table_name ilike '%migrat%'
        or table_schema ilike '%lenus%' or table_schema ilike '%import%' or table_schema ilike '%staging%')
    order by 1,2;`);
  console.log(JSON.stringify(named));
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
