// Seed a weekly check-in for sample.sam so the coach Check-ins tab has real data: a published
// check_in form + fields, an assignment, two submissions (answers keyed by field id), and progress
// photos (rows only - no storage objects, so they render as placeholders, same as food photos).
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; } });
const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const SAM = 'aaee8065-5489-4acf-a548-e7c2b5b0de0d';

async function api(method, path, body, prefer) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 250)}`);
  return text ? JSON.parse(text) : [];
}
function iso(off) { const d = new Date(Date.UTC(2026, 6, 2)); d.setUTCDate(d.getUTCDate() - off); return d.toISOString().slice(0, 10); }

(async () => {
  // Idempotency: drop any prior seeded check-in form (cascades fields/assignments/responses).
  await api('DELETE', `forms?company_id=eq.${COMPANY}&title_en=eq.${encodeURIComponent('Weekly Check-in')}`);
  await api('DELETE', `progress_photos?profile_id=eq.${SAM}&pose=like.seed-*`);

  const coach = await api('GET', `profiles?company_id=eq.${COMPANY}&role=in.(coach,operator,assistant_coach)&select=id&limit=1`);
  const createdBy = coach[0]?.id ?? SAM;

  const form = (await api('POST', 'forms', { company_id: COMPANY, title_en: 'Weekly Check-in', title_es: 'Check-in semanal', type: 'check_in', status: 'published', created_by: createdBy }, 'return=representation'))[0];

  const fieldDefs = [
    { type: 'multiline', label_en: 'How did this week go?', label_es: 'Como te fue esta semana?' },
    { type: 'multiline', label_en: 'Wins this week', label_es: 'Logros de la semana' },
    { type: 'multiline', label_en: 'Challenges / opportunities', label_es: 'Retos / oportunidades' },
    { type: 'text', label_en: 'Non-scale victory', label_es: 'Victoria sin bascula' },
    { type: 'sleep_duration', label_en: 'Average sleep', label_es: 'Sueno promedio' },
    { type: 'rating', label_en: 'Energy level', label_es: 'Nivel de energia' },
  ];
  const fields = await api('POST', 'form_fields', fieldDefs.map((f, i) => ({ company_id: COMPANY, form_id: form.id, type: f.type, label_en: f.label_en, label_es: f.label_es, config: {}, required: false, sort_order: i })), 'return=representation');
  const byOrder = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const F = (i) => byOrder[i].id;

  await api('POST', 'form_assignments', { company_id: COMPANY, form_id: form.id, profile_id: SAM });

  const submissions = [
    {
      submitted_at: `${iso(1)}T15:00:00Z`,
      answers: {
        [F(0)]: 'Really solid week. Hit all my workouts and stayed on my macros 6 of 7 days.',
        [F(1)]: 'Down another pound, and my jeans fit better. Meal prepping on Sunday saved me.',
        [F(2)]: 'Weekend social dinners are tough. Could use a couple of restaurant swap ideas.',
        [F(3)]: 'Did a full push-up for the first time!',
        [F(4)]: 7,
        [F(5)]: 4,
      },
    },
    {
      submitted_at: `${iso(8)}T15:00:00Z`,
      answers: {
        [F(0)]: 'Decent week but energy dipped mid-week. Slept less than usual.',
        [F(1)]: 'Stayed consistent with water and steps.',
        [F(2)]: 'Late nights hurt my sleep. Want to work on an evening routine.',
        [F(3)]: 'Took the stairs every day at work.',
        [F(4)]: 5.5,
        [F(5)]: 3,
      },
    },
  ];
  for (const s of submissions) {
    await api('POST', 'form_responses', { company_id: COMPANY, form_id: form.id, profile_id: SAM, answers: s.answers, form_version: 1, submitted_at: s.submitted_at });
  }

  const photos = [
    { pose: 'seed-front', taken_on: iso(1), weight_kg: 70.4 },
    { pose: 'seed-side', taken_on: iso(1), weight_kg: 70.4 },
    { pose: 'seed-back', taken_on: iso(1), weight_kg: 70.4 },
  ];
  await api('POST', 'progress_photos', photos.map((p, i) => ({ company_id: COMPANY, profile_id: SAM, storage_path: `${SAM}/seed-${i}.jpg`, taken_on: p.taken_on, pose: p.pose, weight_kg: p.weight_kg })));

  console.log('seeded check-in form', form.id, 'fields', fields.length, 'submissions', submissions.length, 'photos', photos.length);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
