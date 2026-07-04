// Seed sample.dani@thickandfit.test as an assistant_coach in the test company (for WP8 mid-ticket QA).
// Idempotent: re-running only ensures the role + company are correct. Test company only.
// Reads .env.local internally (no secret output). Run: node .qa-visual/seed-assistant.cjs
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

const EMAIL = 'sample.dani@thickandfit.test';
const PASSWORD = 'TFSample2026!';

(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Anchor to sam's company so the assistant shares the test tenant.
  const { data: sam } = await sb
    .from('profiles')
    .select('company_id')
    .eq('email', 'sample.sam@thickandfit.test')
    .maybeSingle();
  if (!sam) throw new Error('sample.sam not found; seed the base accounts first');
  const cid = sam.company_id;

  // Create the auth user if absent (handle_new_user creates a blank subscriber profile via trigger).
  let { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('email', EMAIL)
    .maybeSingle();
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

  // Promote the profile to assistant_coach in the test company.
  const { error: upErr } = await sb
    .from('profiles')
    .update({ role: 'assistant_coach', company_id: cid, full_name: 'Dani Assistant' })
    .eq('id', uid);
  if (upErr) throw upErr;

  console.log('assistant seeded: ' + EMAIL + ' id=' + uid + ' company=' + cid + ' (pw ' + PASSWORD + ')');
})().catch((e) => {
  console.error('SEED ASSISTANT FAIL', e.message || e);
  process.exit(1);
});
