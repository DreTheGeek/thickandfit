// Restore sample.casey@thickandfit.test as a coach fixture. The committed QA scripts
// (.qa-visual/qa-coach.cjs, qa-shot.cjs) already log in as this account, but the auth user has gone
// missing from the project, so every authed coach capture silently landed back on /auth/sign-in.
// Idempotent: re-running only re-asserts the role + company. Test company + .test email ONLY.
//
// Run: node .qa-visual/seed-coach-fixture.cjs
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

const EMAIL = 'sample.casey@thickandfit.test';
const PASSWORD = 'TFSample2026!';

// Guard: this script grants a coach role. Refuse to touch anything that is not a .test address, so
// it can never be pointed at a real person's account.
if (!EMAIL.endsWith('@thickandfit.test')) throw new Error('refusing to promote a non-test account');

// .env.local ships SUPABASE_SERVICE_ROLE_KEY blank (the real value lives in Vercel). Fall back to
// the Management API with SUPABASE_ACCESS_TOKEN. Held in memory only, never logged.
async function serviceKey() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`api-keys ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const keys = await res.json();
  const k = keys.find((x) => x.name === 'service_role');
  if (!k?.api_key) throw new Error('service_role key not returned');
  return k.api_key;
}

(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, await serviceKey(), {
    auth: { persistSession: false },
  });

  // Anchor to sam's company so the fixture shares the same tenant as the other sample accounts.
  const { data: sam } = await sb
    .from('profiles')
    .select('company_id')
    .eq('email', 'sample.sam@thickandfit.test')
    .maybeSingle();
  if (!sam) throw new Error('sample.sam not found; seed the base accounts first');
  const cid = sam.company_id;

  let { data: existing } = await sb.from('profiles').select('id').eq('email', EMAIL).maybeSingle();
  let uid = existing?.id;
  if (!uid) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    uid = created.user.id;
  }

  const { error: upErr } = await sb
    .from('profiles')
    .update({ role: 'coach', company_id: cid, full_name: 'Casey Sample' })
    .eq('id', uid);
  if (upErr) throw upErr;

  console.log(`coach fixture seeded: ${EMAIL} id=${uid} company=${cid}`);
})().catch((e) => {
  console.error('SEED COACH FAIL', e.message || e);
  process.exit(1);
});
