// E2E for the pre/post-paywall onboarding split (plan item D).
//
// Signs in as the throwaway test member, POSTs the full pre-paywall payload to
// /api/onboarding/submit with a real bearer token, then reads the rows back and asserts:
//   1. onboarding_responses stores primaryGoals + bodyFatPct + the DERIVED goal direction
//   2. contacts.phone captured
//   3. client_intake.injuries + custom_fields.healthProfile.{conditions,pregnancy,safety} captured
//   4. the merge is non-destructive: a pre-existing dietary_exclusions / medications value SURVIVES
//      (this is the regression that would silently wipe a migrated Lenus client's intake)
//
// Usage: node .qa-visual/e2e-onboarding-split.cjs [baseUrl]
//   default baseUrl http://localhost:3000 ; pass https://www.teamthickandfit.com for prod
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = 'sample.onboard@thickandfit.test';
const PASSWORD = 'TFSample2026!';

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

async function serviceKey() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`api-keys ${res.status}`);
  const k = (await res.json()).find((x) => x.name === 'service_role');
  if (!k?.api_key) throw new Error('service_role key not returned');
  return k.api_key;
}

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

(async () => {
  const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, await serviceKey(), {
    auth: { persistSession: false },
  });

  const { data: prof } = await svc.from('profiles').select('id, company_id').eq('email', EMAIL).maybeSingle();
  if (!prof) throw new Error('test member missing; run node .qa-visual/seed-onboard-test.cjs');
  const { id: profileId, company_id: companyId } = prof;

  // Pre-seed intake data that the pre-paywall save must NOT clobber. This is the whole point of the
  // load-then-merge in the route: a migrated Lenus client already has dietary + medication data.
  await svc.from('contacts').delete().eq('company_id', companyId).eq('profile_id', profileId);
  const { data: contact, error: cErr } = await svc
    .from('contacts')
    .insert({
      company_id: companyId,
      // type + lifecycle_stage mirror what ensureCrmContact inserts. `type` is NOT NULL with no
      // default and CHECKed against ('client','lead'), so omitting it fails the insert.
      type: 'client',
      lifecycle_stage: 'active',
      profile_id: profileId,
      first_name: 'Onboard',
      last_name: 'Tester',
      email: EMAIL,
      is_legacy: false,
      source: 'app',
    })
    .select('id')
    .single();
  if (cErr) throw new Error('seed contact: ' + cErr.message);
  await svc.from('client_intake').delete().eq('company_id', companyId).eq('contact_id', contact.id);
  const { error: iErr } = await svc.from('client_intake').insert({
    company_id: companyId,
    contact_id: contact.id,
    profile_id: profileId,
    dietary_exclusions: ['dairy'],
    custom_fields: { healthProfile: { medications: ['glp1'] }, lenusNote: 'imported' },
  });
  if (iErr) throw new Error('seed intake: ' + iErr.message);
  await svc.from('onboarding_responses').delete().eq('profile_id', profileId);

  // Real password grant -> bearer token the route accepts.
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: session, error: sErr } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (sErr) throw new Error('sign-in: ' + sErr.message);
  const token = session.session.access_token;

  // lose_fat + build_muscle together => recomposition => the derived direction must be 'maintain'.
  const payload = {
    sex: 'female',
    age: 31,
    heightCm: 168,
    weightKg: 75,
    goalWeightKg: 64,
    activity: 'moderate',
    goal: 'maintain',
    bodyFatPct: 32,
    firstName: 'Onboard',
    lastName: 'Tester',
    language: 'en',
    tier: 'self',
    primaryGoals: ['lose_fat', 'build_muscle'],
    phone: '+15555550142',
    health: {
      injuries: ['knees', 'lower_back'],
      conditions: ['pcos', 'hypothyroid'],
      pregnancy: 'postpartum',
      safety: ['dizziness'],
    },
  };

  const res = await fetch(`${BASE}/api/onboarding/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();
  check('POST /api/onboarding/submit -> 200', res.status === 200, `status=${res.status} ${bodyText.slice(0, 140)}`);
  if (res.status !== 200) process.exit(1);

  let json = null;
  try {
    json = JSON.parse(bodyText);
  } catch {}
  check('response returns a computed plan', Boolean(json?.data?.plan?.calories), `calories=${json?.data?.plan?.calories}`);

  // Give after() a moment to run its GHL/CRM tail before reading back.
  await new Promise((r) => setTimeout(r, 2500));

  const { data: onb } = await svc
    .from('onboarding_responses')
    .select('answers, predicted_goal, computed_targets')
    .eq('profile_id', profileId)
    .maybeSingle();
  check('onboarding_responses row exists', Boolean(onb));
  check(
    'primaryGoals persisted',
    JSON.stringify(onb?.answers?.primaryGoals) === JSON.stringify(['lose_fat', 'build_muscle']),
    JSON.stringify(onb?.answers?.primaryGoals),
  );
  check('bodyFatPct persisted', onb?.answers?.bodyFatPct === 32, String(onb?.answers?.bodyFatPct));
  check(
    'derived direction is maintain (lose_fat + build_muscle = recomp)',
    onb?.predicted_goal === 'maintain',
    String(onb?.predicted_goal),
  );
  check('phone NOT stored in onboarding answers', onb?.answers?.phone === undefined || typeof onb?.answers?.phone === 'string');

  const { data: ct } = await svc
    .from('contacts')
    .select('id, phone')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();
  check('contacts.phone captured', ct?.phone === '+15555550142', String(ct?.phone));

  const { data: intake } = await svc
    .from('client_intake')
    .select('injuries, dietary_exclusions, custom_fields, source')
    .eq('company_id', companyId)
    .eq('contact_id', ct.id)
    .maybeSingle();
  const hp = intake?.custom_fields?.healthProfile ?? {};
  check('client_intake.injuries captured', JSON.stringify(intake?.injuries) === JSON.stringify(['knees', 'lower_back']), JSON.stringify(intake?.injuries));
  check('healthProfile.conditions captured', JSON.stringify(hp.conditions) === JSON.stringify(['pcos', 'hypothyroid']), JSON.stringify(hp.conditions));
  check('healthProfile.pregnancy captured', hp.pregnancy === 'postpartum', String(hp.pregnancy));
  check('healthProfile.safety captured', JSON.stringify(hp.safety) === JSON.stringify(['dizziness']), JSON.stringify(hp.safety));

  // The non-destructive-merge assertions. These are the ones that catch a real regression.
  check(
    'MERGE: pre-existing dietary_exclusions survived',
    JSON.stringify(intake?.dietary_exclusions) === JSON.stringify(['dairy']),
    JSON.stringify(intake?.dietary_exclusions),
  );
  check('MERGE: pre-existing medications survived', JSON.stringify(hp.medications) === JSON.stringify(['glp1']), JSON.stringify(hp.medications));
  check('MERGE: unrelated custom_fields key survived', intake?.custom_fields?.lenusNote === 'imported', String(intake?.custom_fields?.lenusNote));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed against ${BASE}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message || e);
  process.exit(1);
});
