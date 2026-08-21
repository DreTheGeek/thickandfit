// A coach account for driving the coach console headlessly, and a disposable legacy contact for
// proving the invite pipeline without emailing one of Stephanie's real clients.
//
// The test contact uses delivered@resend.dev, Resend's own always-delivers test address. That is
// the difference between proving the send works and burning a bounce on a domain that is about to
// email 272 people for the first time.
//
//   node .qa-visual/seed-qa-coach.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const EMAIL = 'qa.coach@teamthickandfit.com';
const PASSWORD = 'TFQaCoach2026!';
const TEST_CONTACT = 'delivered@resend.dev';

(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let { data: existing } = await sb.from('profiles').select('id').eq('email', EMAIL).maybeSingle();
  let uid = existing?.id;
  if (!uid) {
    const { data, error } = await sb.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    uid = data.user.id;
    console.log('created coach', uid);
  } else {
    await sb.auth.admin.updateUserById(uid, { password: PASSWORD });
    console.log('reusing coach', uid);
  }
  await sb.from('profiles').upsert(
    { id: uid, company_id: COMPANY, email: EMAIL, full_name: 'QA Coach', role: 'coach', ui_locale: 'en' },
    { onConflict: 'id' },
  );

  // The disposable invitee. Same shape the sender requires: legacy CLIENT, has an email, unclaimed.
  const { data: c } = await sb.from('contacts').select('id').eq('email', TEST_CONTACT).maybeSingle();
  if (!c) {
    const { error } = await sb.from('contacts').insert({
      company_id: COMPANY, email: TEST_CONTACT, first_name: 'QA', last_name: 'Invitee',
      type: 'client', is_legacy: true, language: 'en', product_type: 'bootcamp',
    });
    if (error) throw error;
    console.log('created test contact', TEST_CONTACT);
  } else {
    // Reset it so the test starts from "never invited".
    await sb.from('contacts').update({ profile_id: null }).eq('id', c.id);
    console.log('reset test contact', TEST_CONTACT);
  }

  console.log(`\n  ${EMAIL} / ${PASSWORD}`);
})().catch((e) => { console.error(e); process.exit(1); });
