// A member account for driving the real member flows headlessly.
//
// The sample.* fixtures were deleted at the owner's request so those addresses could be reused, and
// that took the login out from under portal-shots.mjs and every other harness that signs in. This
// recreates ONE, at an address nobody wants back, and gives it what a member needs to be walked
// through a workout: a profile, an onboarding row, and the assigned plan.
//
//   node .qa-visual/seed-qa-member.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const EMAIL = 'qa.member@teamthickandfit.com';
const PASSWORD = 'TFQaMember2026!';

(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pinned. There are TWO companies: Thick & Fit and an RLS test tenant, and `limit(1)` picked the
  // test tenant, which owns no plans.
  const companyId = 'c0ffee00-0000-4000-8000-000000000001';

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
    console.log('created auth user', uid);
  } else {
    // Keep the password predictable across re-runs.
    await sb.auth.admin.updateUserById(uid, { password: PASSWORD });
    console.log('reusing', uid);
  }

  await sb.from('profiles').upsert(
    { id: uid, company_id: companyId, email: EMAIL, full_name: 'QA Member', role: 'subscriber', ui_locale: 'en' },
    { onConflict: 'id' },
  );

  // Onboarded, so the app does not bounce her to /onboarding before she can reach a workout.
  await sb.from('onboarding_responses').upsert(
    {
      company_id: companyId,
      profile_id: uid,
      answers: {
        firstName: 'QA', lastName: 'Member', sex: 'female', age: 30,
        heightCm: 165, weightKg: 75, goalWeightKg: 68, goal: 'lose', tier: 'team',
        activity: 'light', language: 'en', primaryGoals: ['lose_fat'],
        health: { trainingLocation: 'home', trainingExperience: 'some', trainingDays: 3, injuries: [], conditions: [], safety: [], pregnancy: 'none' },
      },
    },
    { onConflict: 'profile_id' },
  );

  // The @HOME starter, so /workouts has a session to open.
  const { data: plan } = await sb
    .from('plans')
    .select('id, name_en')
    .eq('company_id', companyId)
    .eq('is_starter_candidate', true)
    .eq('location', 'home')
    .order('days_per_week')
    .limit(1)
    .single();
  await sb
    .from('plan_assignments')
    .upsert(
      { company_id: companyId, plan_id: plan.id, profile_id: uid, assigned_at: new Date().toISOString() },
      { onConflict: 'plan_id,profile_id' },
    );

  console.log(`\n  ${EMAIL} / ${PASSWORD}`);
  console.log(`  plan: ${plan.name_en}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
