// Seed a FRESH, never-onboarded subscriber so the pre-paywall onboarding wizard can be walked E2E.
// Idempotent by design: re-running wipes the member's onboarding_responses + client_intake + CRM
// contact so the wizard is reachable again from a clean slate. Test company + .test email ONLY.
//
// Run: node .qa-visual/seed-onboard-test.cjs
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

const EMAIL = 'sample.onboard@thickandfit.test';
const PASSWORD = 'TFSample2026!';

// Guard: this script deletes data. Refuse to touch anything that is not a .test address.
if (!EMAIL.endsWith('@thickandfit.test')) throw new Error('refusing to reset a non-test account');

// .env.local ships SUPABASE_SERVICE_ROLE_KEY blank (the real value lives in Vercel). Fall back to
// reading it from the Management API with SUPABASE_ACCESS_TOKEN, which is present. Held in memory for
// this process only and never logged.
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
    console.log('created auth user');
  } else {
    console.log('reusing auth user');
  }

  await sb
    .from('profiles')
    .update({ role: 'subscriber', company_id: cid, full_name: 'Onboard Tester' })
    .eq('id', uid);

  // Reset to never-onboarded: drop the wizard row, then the intake + contact it wrote.
  const { error: dOnb } = await sb.from('onboarding_responses').delete().eq('profile_id', uid);
  if (dOnb) console.error('delete onboarding_responses:', dOnb.message);

  const { data: contacts } = await sb
    .from('contacts')
    .select('id')
    .eq('company_id', cid)
    .eq('profile_id', uid);
  for (const c of contacts ?? []) {
    await sb.from('client_intake').delete().eq('company_id', cid).eq('contact_id', c.id);
  }
  const { error: dC } = await sb.from('contacts').delete().eq('company_id', cid).eq('profile_id', uid);
  if (dC) console.error('delete contacts:', dC.message);

  console.log(JSON.stringify({ email: EMAIL, profileId: uid, companyId: cid, reset: true }, null, 2));
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
