// RLS isolation test: sign in as a real non-coach subscriber and prove the database refuses to
// leak other users' rows or coach/operator-only tables via PostgREST. Run in CI. Exit 1 on any leak.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = 'TFSample2026!';

// owner tables: every returned row's owner column MUST equal the signed-in user.
// forbidden tables: a non-coach/non-operator user must get ZERO rows.
const OWNER = [
  ['profiles', 'id'], ['food_log', 'profile_id'], ['weight_entries', 'profile_id'],
  ['coach_messages', 'profile_id'], ['workout_logs', 'profile_id'], ['onboarding_responses', 'profile_id'],
  ['notifications', 'profile_id'], ['progress_photos', 'profile_id'], ['form_responses', 'profile_id'],
  ['user_insights', 'profile_id'], ['push_subscriptions', 'profile_id'],
  ['body_measurements', 'profile_id'], ['food_photos', 'profile_id'],
];
const FORBIDDEN = [
  'contacts', 'client_subscriptions', 'contact_transactions', 'opportunities', 'pipelines',
  'waitlist_leads', 'api_keys', 'security_events', 'audit_log', 'saved_segments', 'plans',
  'sessions', 'forms', 'ai_evals', 'email_send_log', 'legacy_client_snapshot', 'coach_knowledge',
  'coaching_assignments', 'approval_queue', 'coach_interview_answers', 'ai_inferences',
];

async function signIn(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(j).slice(0, 120)}`);
  return { token: j.access_token, id: j.user.id };
}
async function rest(table, select, token) {
  const r = await fetch(`${URL}/rest/v1/${table}?select=${select}&limit=1000`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { rows: [], blocked: true };
  return { rows: await r.json(), blocked: false };
}

(async () => {
  const sam = await signIn('sample.sam@thickandfit.test');
  console.log(`signed in as subscriber sam (${sam.id.slice(0, 8)})`);
  let fails = 0, checks = 0;

  for (const [table, col] of OWNER) {
    checks++;
    const { rows } = await rest(table, col, sam.token);
    const leaked = rows.filter((r) => r[col] && r[col] !== sam.id);
    if (leaked.length > 0) { console.log(`  LEAK  ${table}: ${leaked.length} row(s) not owned by sam`); fails++; }
    else console.log(`  ok    ${table}: ${rows.length} row(s), all own`);
  }
  for (const table of FORBIDDEN) {
    checks++;
    const { rows } = await rest(table, 'id', sam.token);
    if (rows.length > 0) { console.log(`  LEAK  ${table}: subscriber read ${rows.length} row(s) of coach/operator data`); fails++; }
    else console.log(`  ok    ${table}: 0 rows (blocked)`);
  }

  // Write isolation: a subscriber must NOT be able to write privileged tables via PostgREST. The
  // companies row is the tenant root (40+ tables cascade-delete from it), so a writable companies
  // row = one-request full-tenant wipe. We probe with a NO-OP update (name := current name) and
  // expect 0 rows back; any echoed row means write is reachable (regression of 0029).
  checks++;
  const co = await rest('companies', 'id,name', sam.token);
  if (!co.rows.length) {
    console.log('  ok    companies write: company not visible to subscriber');
  } else {
    const { id, name } = co.rows[0];
    const w = await fetch(`${URL}/rest/v1/companies?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: ANON, Authorization: `Bearer ${sam.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ name }),
    });
    let echoed = [];
    try { echoed = await w.json(); } catch { echoed = []; }
    if (w.ok && Array.isArray(echoed) && echoed.length > 0) {
      console.log(`  LEAK  companies write: subscriber UPDATEd the tenant root (status ${w.status}) -> cascade-wipe vector`);
      fails++;
    } else {
      console.log(`  ok    companies write: blocked (status ${w.status}, 0 rows)`);
    }
  }

  console.log(`\n${checks - fails}/${checks} isolation checks passed.`);
  if (fails > 0) { console.error(`FAIL: ${fails} RLS isolation leak(s).`); process.exit(1); }
  console.log('PASS: tenant/user isolation holds.');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
