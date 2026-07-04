// TWO-TENANT RLS leak probe (the critical cross-company isolation proof the single-tenant test cannot
// give). The app is service-client-everywhere (BYPASSRLS), so RLS policies are the SOLE backstop
// between company A and a future company B - and this repo has leaked cross-tenant 3x. This test:
//   1. Provisions an isolated company B + a subscriber in it (idempotent; labeled test tenant).
//   2. Signs in as company B's subscriber via the ANON client (real JWT, company_id=B from the hook).
//   3. Reads EVERY public table that has a company_id column and asserts ZERO rows belong to company A.
//   4. Attempts a cross-company UPDATE + DELETE against a company A row and asserts 0 affected.
//   5. Reverse check: company A's subscriber (sam) must see ZERO of the seeded company B rows.
// Exit 1 on ANY leak. Run in CI after any migration or policy change.
const fs = require('fs');
const path = require('path');
const REPO = 'c:/Users/dre/OneDrive/Desktop/Kaldr Tech/Website Building/thickandfit';
const env = {};
fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const MGMT_REF = (URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
const COMPANY_A = 'c0ffee00-0000-4000-8000-000000000001';
const COMPANY_B = 'c0ffee00-0000-4000-8000-000000000002';
const B_EMAIL = 'tenantb.sam@thickandfit.test';
const PW = 'TFSample2026!';
const A_EMAIL = 'sample.sam@thickandfit.test';

async function mgmt(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${MGMT_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('mgmt ' + r.status + ': ' + t.slice(0, 300));
  return t ? JSON.parse(t) : [];
}
async function adminUser(email) {
  // Find or create the auth user via GoTrue admin API (service role).
  const list = await fetch(`${URL}/auth/v1/admin/users?filter=${encodeURIComponent('email eq "' + email + '"')}`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  }).then((r) => r.json()).catch(() => ({}));
  const found = (list.users || []).find((u) => u.email === email);
  if (found) return found.id;
  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW, email_confirm: true }),
  }).then((r) => r.json());
  if (!created.id) throw new Error('create user failed: ' + JSON.stringify(created).slice(0, 160));
  return created.id;
}
async function signIn(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(j).slice(0, 140)}`);
  return { token: j.access_token, id: j.user.id, claims: JSON.parse(Buffer.from(j.access_token.split('.')[1], 'base64').toString()) };
}
async function readAs(table, token, select = 'company_id') {
  const r = await fetch(`${URL}/rest/v1/${table}?select=${select}&limit=2000`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { rows: [], status: r.status };
  return { rows: await r.json(), status: 200 };
}

(async () => {
  console.log('== TWO-TENANT RLS PROBE ==');
  // 1. Provision company B + subscriber (idempotent).
  await mgmt(`insert into public.companies (id, name, slug) values ('${COMPANY_B}', 'RLS Test Tenant B', 'rls-test-tenant-b') on conflict (id) do nothing;`);
  const bId = await adminUser(B_EMAIL);
  // Upsert the profile to company B (override any trigger default). role=subscriber.
  await mgmt(`insert into public.profiles (id, company_id, email, role, full_name) values ('${bId}', '${COMPANY_B}', '${B_EMAIL}', 'subscriber', 'Tenant B Sam')
    on conflict (id) do update set company_id='${COMPANY_B}', role='subscriber';`);
  // Seed a couple of company-B-owned rows so the reverse (A cannot see B) is meaningful.
  await mgmt(`insert into public.food_log (company_id, profile_id, log_date, name, kcal, protein_g, carb_g, fat_g)
    values ('${COMPANY_B}', '${bId}', current_date, 'TENANT-B-SECRET-FOOD', 500, 40, 30, 20) on conflict do nothing;`).catch(() => {});
  console.log(`company B ready: ${bId.slice(0, 8)} (${B_EMAIL})`);

  // 2. Sign in as company B; verify the JWT actually carries company_id=B (else the probe is invalid).
  const b = await signIn(B_EMAIL);
  if (b.claims.company_id !== COMPANY_B) {
    console.log(`  FATAL: company B JWT company_id=${b.claims.company_id} (expected ${COMPANY_B}). Auth hook not applying; probe invalid.`);
    process.exit(1);
  }
  console.log(`signed in as B; JWT company_id=${String(b.claims.company_id).slice(0, 8)} user_role=${b.claims.user_role}`);

  // 3. Every tenant-scoped table: company B must read ZERO company-A rows.
  const tables = (await mgmt(`select table_name from information_schema.columns where table_schema='public' and column_name='company_id' order by table_name;`)).map((r) => r.table_name);
  let leaks = 0, checked = 0, blocked = 0, visible = 0;
  for (const t of tables) {
    checked++;
    const { rows, status } = await readAs(t, b.token);
    if (status !== 200) { blocked++; continue; }
    const aRows = rows.filter((r) => r.company_id === COMPANY_A);
    if (aRows.length > 0) { console.log(`  LEAK  ${t}: company B read ${aRows.length} company-A row(s)`); leaks++; }
    else if (rows.length > 0) visible++;
  }
  console.log(`tables probed: ${checked} | company-A rows leaked to B: ${leaks} | tables that returned only B/empty: ${checked - leaks}`);

  // 4. Cross-company WRITE: company B attempts to UPDATE + DELETE a company A food_log row.
  const aRow = (await mgmt(`select id from public.food_log where company_id='${COMPANY_A}' limit 1;`))[0];
  if (aRow) {
    const upd = await fetch(`${URL}/rest/v1/food_log?id=eq.${aRow.id}`, {
      method: 'PATCH', headers: { apikey: ANON, Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ note: 'HACKED-BY-TENANT-B' }),
    });
    const updRows = upd.ok ? await upd.json() : [];
    if (updRows.length > 0) { console.log(`  LEAK  food_log UPDATE: company B modified a company-A row!`); leaks++; }
    else console.log(`  ok    cross-company UPDATE blocked (0 rows affected)`);
    const del = await fetch(`${URL}/rest/v1/food_log?id=eq.${aRow.id}`, {
      method: 'DELETE', headers: { apikey: ANON, Authorization: `Bearer ${b.token}`, Prefer: 'return=representation' },
    });
    const delRows = del.ok ? await del.json() : [];
    if (delRows.length > 0) { console.log(`  LEAK  food_log DELETE: company B deleted a company-A row!`); leaks++; }
    else console.log(`  ok    cross-company DELETE blocked (0 rows affected)`);
    // Verify the row is intact.
    const still = (await mgmt(`select note from public.food_log where id='${aRow.id}';`))[0];
    if (!still) { console.log(`  LEAK  company-A row was actually deleted!`); leaks++; }
    else if (still.note === 'HACKED-BY-TENANT-B') { console.log(`  LEAK  company-A row was actually modified!`); leaks++; }
  }

  // 5. Reverse: company A subscriber (sam) must see ZERO seeded company B rows.
  const a = await signIn(A_EMAIL);
  const { rows: samFood } = await readAs('food_log', a.token, 'company_id,name');
  const bLeak = samFood.filter((r) => r.company_id === COMPANY_B || r.name === 'TENANT-B-SECRET-FOOD');
  if (bLeak.length > 0) { console.log(`  LEAK  sam (company A) saw ${bLeak.length} company-B food_log row(s)`); leaks++; }
  else console.log(`  ok    company A subscriber sees 0 company-B rows`);

  console.log(`\n== RESULT: ${leaks === 0 ? 'PASS - full cross-tenant isolation' : 'FAIL - ' + leaks + ' LEAK(S)'} (${checked} tables + write + reverse) ==`);
  process.exit(leaks === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
