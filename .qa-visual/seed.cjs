// Seed sample.sam with onboarding + an assigned program so the subscriber app shows
// fully populated. Test company only. Reads .env.local internally (no secret output).
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

(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: sam } = await sb
    .from('profiles')
    .select('id, company_id')
    .eq('email', 'sample.sam@thickandfit.test')
    .maybeSingle();
  const { data: casey } = await sb
    .from('profiles')
    .select('id')
    .eq('email', 'sample.casey@thickandfit.test')
    .maybeSingle();
  if (!sam) throw new Error('sam not found');
  const cid = sam.company_id;

  // Onboarding (drives Today content + You goal card)
  const answers = {
    sex: 'female', age: 29, heightCm: 165, weightKg: 74,
    goalWeightKg: 66, activity: 'moderate', goal: 'lose',
  };
  const computed_targets = {
    bmr: 1480, tdee: 2294, calories: 1850,
    macros: { protein_g: 148, carbs_g: 165, fat_g: 62 },
    weeklyKg: -0.45, curve: [],
  };
  await sb.from('onboarding_responses').upsert(
    { company_id: cid, profile_id: sam.id, answers, predicted_goal: 'lose', computed_targets, completed_at: new Date().toISOString() },
    { onConflict: 'profile_id' },
  );

  // Program (idempotent by name)
  let { data: existing } = await sb
    .from('plans')
    .select('id')
    .eq('company_id', cid)
    .eq('name_en', 'Glute Builder')
    .maybeSingle();
  let planId = existing?.id;
  if (!planId) {
    const { data: plan, error: pe } = await sb
      .from('plans')
      .insert({ company_id: cid, name_en: 'Glute Builder', name_es: 'Constructor de Glúteos', weeks: 8, created_by: casey?.id ?? sam.id })
      .select('id')
      .single();
    if (pe) throw pe;
    planId = plan.id;
    const { data: exs } = await sb.from('exercises').select('id').is('company_id', null).limit(4);
    const { data: sess } = await sb
      .from('sessions')
      .insert({ company_id: cid, plan_id: planId, day_label: 'Day 1 - Glutes', sort_order: 0 })
      .select('id')
      .single();
    const rows = (exs ?? []).map((e, i) => ({
      company_id: cid, session_id: sess.id, exercise_id: e.id,
      format: 'straight', sets: 4, reps: 12, rest_sec: 60, sort_order: i,
    }));
    if (rows.length) await sb.from('session_exercises').insert(rows);
  }

  await sb.from('plan_assignments').upsert(
    { company_id: cid, plan_id: planId, profile_id: sam.id },
    { onConflict: 'plan_id,profile_id' },
  );

  fs.writeFileSync(path.join(__dirname, 'seed.json'), JSON.stringify({ samId: sam.id, planId }, null, 2));
  console.log('seeded sam=' + sam.id + ' plan=' + planId);
})().catch((e) => {
  console.error('SEED FAIL', e.message || e);
  process.exit(1);
});
