// Discover the real categories already in Stephanie's Lenus data, so the new system's
// tags / filters / segments are built around HER business, not generic guesses.
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
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { error: t.slice(0, 300) }; }
}
const show = async (label, sql) => { console.log(`\n=== ${label} ===`); console.log(JSON.stringify(await q(sql))); };

(async () => {
  await show('CLIENT product_type', `select coalesce(nullif(product_type,''),'(blank)') v, count(*) from lenus.clients group by 1 order by 2 desc`);
  await show('CLIENT tags (individual, top 40)', `select trim(tag) tag, count(*) from lenus.clients, unnest(string_to_array(tags,',')) tag where tags is not null and tags<>'' group by 1 order by 2 desc limit 40`);
  await show('CLIENT start cohort by year', `select extract(year from start_at) yr, count(*) from lenus.clients group by 1 order by 1`);
  await show('ACTIVE_BILLING billing_health', `select coalesce(nullif(billing_health,''),'(blank)') v, count(*) from lenus.active_billing group by 1 order by 2 desc`);
  await show('ACTIVE_BILLING plan/product', `select coalesce(nullif(plan,''),'(blank)') v, count(*) from lenus.active_billing group by 1 order by 2 desc limit 20`);
  await show('CLIENT_PROFILES weight_goal', `select coalesce(nullif(weight_goal,''),'(blank)') v, count(*) from lenus.client_profiles group by 1 order by 2 desc`);
  await show('CLIENT_PROFILES goal_intensity', `select coalesce(nullif(goal_intensity,''),'(blank)') v, count(*) from lenus.client_profiles group by 1 order by 2 desc`);
  await show('CLIENT_PROFILES owner', `select coalesce(nullif(owner,''),'(blank)') v, count(*) from lenus.client_profiles group by 1 order by 2 desc`);
  await show('LEADS state', `select coalesce(nullif(state,''),'(blank)') v, count(*) from lenus.leads group by 1 order by 2 desc`);
  await show('LEADS lead_type', `select coalesce(nullif(lead_type,''),'(blank)') v, count(*) from lenus.leads group by 1 order by 2 desc`);
  await show('LEADS lost_reason', `select coalesce(nullif(lost_reason,''),'(blank)') v, count(*) from lenus.leads group by 1 order by 2 desc limit 20`);
  await show('LEADS referred/duplicate', `select (select count(*) from lenus.leads where is_referred) referred, (select count(*) from lenus.leads where is_duplicate) duplicate`);
  await show('LEADS tags (individual, top 30)', `select trim(tag) tag, count(*) from lenus.leads, unnest(string_to_array(tags,',')) tag where tags is not null and tags<>'' group by 1 order by 2 desc limit 30`);
  await show('RECIPES category', `select coalesce(nullif(category,''),'(blank)') v, count(*) from lenus.recipes group by 1 order by 2 desc limit 25`);
  await show('RECIPES recipe_book', `select coalesce(nullif(recipe_book,''),'(blank)') v, count(*) from lenus.recipes group by 1 order by 2 desc limit 25`);
  await show('MEAL_PLANS macro_timing', `select coalesce(nullif(macro_timing_name,''),'(blank)') v, count(*) from lenus.meal_plans group by 1 order by 2 desc limit 20`);
  await show('MEDIA category', `select coalesce(nullif(category,''),'(blank)') v, count(*) from lenus.media group by 1 order by 2 desc limit 20`);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
