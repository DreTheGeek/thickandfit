// Column schema of every lenus.* table, so we can plan the import into our app.
// Schema only (no client PII values).
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
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { error: t.slice(0, 300) }; }
}

(async () => {
  const cols = await q(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'lenus'
    order by table_name, ordinal_position;`);
  const byTable = {};
  for (const row of cols) {
    (byTable[row.table_name] ||= []).push(`${row.column_name}:${row.data_type}`);
  }
  for (const [t, c] of Object.entries(byTable)) {
    console.log(`\n# lenus.${t}\n  ${c.join('\n  ')}`);
  }

  // contactability signal for clients/leads (counts only, no values)
  console.log('\n=== SIGNAL (counts only) ===');
  const sig = await q(`
    select
      (select count(*) from lenus.clients) as clients,
      (select count(*) from lenus.clients where email is not null and email <> '') as clients_with_email,
      (select count(*) from lenus.clients where active) as clients_active,
      (select count(*) from lenus.leads) as leads,
      (select count(*) from lenus.leads where email is not null and email <> '') as leads_with_email,
      (select count(*) from lenus.leads where phone is not null and phone <> '') as leads_with_phone,
      (select round(sum(coach_amount_whole)) from lenus.transactions) as coach_revenue_total,
      (select round(sum(lifetime_paid)) from lenus.active_billing) as active_lifetime_paid;`);
  console.log(JSON.stringify(sig, null, 2));
  const statuses = await q(`select subscription_status, count(*) from lenus.clients group by 1 order by 2 desc;`);
  console.log('client subscription_status:', JSON.stringify(statuses));
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
