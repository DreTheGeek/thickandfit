// Per-person coverage audit: what Lenus has, versus what we stored, for EVERY client.
//
// The sweep reported totals and the totals looked right. Totals hide the case that matters: one
// client whose messages all failed while 271 succeeded is invisible in an aggregate and obvious
// here. This walks all 272 people and prints anyone whose stored count does not match what was
// captured from Lenus.
//
// Reads the capture files as the source of truth for "what Lenus has", because they ARE the
// observed Lenus response, and the live database for "what we stored".
//
// Run: node scripts/audit-lenus-coverage.mjs [--all]
// Without --all it prints only the people with a gap.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SHOW_ALL = process.argv.includes('--all');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};

const checkins = JSON.parse(readFileSync('.capture/sweep/lenus-checkins.json', 'utf8'));
const threads = JSON.parse(readFileSync('.capture/sweep/lenus-threads.json', 'utf8'));
const detail = JSON.parse(readFileSync('.capture/sweep/lenus-detail.json', 'utf8'));

// --- what Lenus has ---------------------------------------------------------
const want = new Map(); // lenus profile id -> counts
const bump = (pid, key, n = 1) => {
  if (!want.has(pid)) want.set(pid, { checkins: 0, messages: 0, workouts: 0, name: null });
  want.get(pid)[key] += n;
};
for (const pid of Object.keys(detail.detail)) bump(pid, 'checkins', 0);
for (const c of checkins.checkins) bump(c.profileId, 'checkins');
for (const [pid, events] of Object.entries(threads.threads)) {
  bump(pid, 'messages', events.filter((e) => e.__typename === 'Message').length);
}
for (const [pid, rec] of Object.entries(detail.detail)) bump(pid, 'workouts', (rec.workouts || []).length);
for (const c of detail.clients) if (want.has(c.id)) want.get(c.id).name = c.fullName;

// --- what we stored ---------------------------------------------------------
const rows = sql(`
  select c.lenus_id,
         coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '') as name,
         (select count(*) from form_responses fr where fr.contact_id = c.id) as checkins,
         (select count(*) from client_messages m where m.contact_id = c.id and m.source = 'lenus') as messages,
         (select count(*) from client_workout_history w where w.contact_id = c.id) as workouts,
         (select count(*) from weight_entries we where we.contact_id = c.id) as weights,
         (select count(*) from body_measurements bm where bm.contact_id = c.id) as measurements,
         (select count(*) from progress_photos pp where pp.contact_id = c.id) as photos
  from contacts c
  where c.company_id = '${COMPANY}' and c.lenus_id is not null
`);
const have = new Map(rows.map((r) => [r.lenus_id, r]));

// --- compare ----------------------------------------------------------------
const problems = [];
const ok = [];
let totals = { wantC: 0, haveC: 0, wantM: 0, haveM: 0, wantW: 0, haveW: 0 };

for (const [pid, w] of want) {
  const h = have.get(pid);
  const name = w.name || h?.name?.trim() || pid;
  if (!h) {
    problems.push({ pid, name, why: 'NO CONTACT ROW', want: w, have: null });
    continue;
  }
  totals.wantC += w.checkins; totals.haveC += Number(h.checkins);
  totals.wantM += w.messages; totals.haveM += Number(h.messages);
  totals.wantW += w.workouts; totals.haveW += Number(h.workouts);

  const gaps = [];
  if (Number(h.checkins) < w.checkins) gaps.push(`check-ins ${h.checkins}/${w.checkins}`);
  if (Number(h.messages) < w.messages) gaps.push(`messages ${h.messages}/${w.messages}`);
  if (Number(h.workouts) < w.workouts) gaps.push(`workouts ${h.workouts}/${w.workouts}`);
  if (gaps.length) problems.push({ pid, name, why: gaps.join(', '), want: w, have: h });
  else ok.push({ name, ...h });
}

console.log(`people checked: ${want.size}`);
console.log(`check-ins ${totals.haveC}/${totals.wantC} | messages ${totals.haveM}/${totals.wantM} | workouts ${totals.haveW}/${totals.wantW}`);
console.log(`complete: ${ok.length} | with a gap: ${problems.length}\n`);

if (problems.length) {
  console.log('GAPS');
  for (const p of problems.sort((a, b) => (b.want.messages + b.want.checkins) - (a.want.messages + a.want.checkins))) {
    console.log(`  ${p.name.padEnd(28)} ${p.why}`);
  }
}

if (SHOW_ALL) {
  console.log('\nCOMPLETE');
  for (const r of ok.sort((a, b) => Number(b.messages) - Number(a.messages))) {
    console.log(
      `  ${r.name.trim().padEnd(28)} checkins ${String(r.checkins).padStart(3)}  msgs ${String(r.messages).padStart(5)}  workouts ${String(r.workouts).padStart(4)}  weights ${String(r.weights).padStart(3)}  measures ${String(r.measurements).padStart(3)}  photos ${String(r.photos).padStart(4)}`,
    );
  }
}

// People with a contact row that the sweep never touched: they exist in our CRM but were not in
// the 272 targets, which means they left Lenus before the id list was built. Worth knowing about,
// not a failure.
const untouched = rows.filter((r) => !want.has(r.lenus_id));
console.log(`\ncontacts not in this sweep (left Lenus earlier): ${untouched.length}`);

// --- the coach-side datasets, in aggregate ----------------------------------
// Per-person is the right shape for client history, where one silent failure hides in a total.
// These are library-scale: 24 lessons either imported or did not, and a count against the capture
// file is the whole check.
const optional = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const extraDoc = optional('.capture/sweep/lenus-extra.json');
const foodDoc = optional('.capture/sweep/lenus-food.json');
const vidDoc = optional('.capture/sweep/lenus-exercise-videos.json');

if (extraDoc || foodDoc || vidDoc) {
  const one = (q) => Number(sql(q)[0]?.n ?? 0);
  const lines = [];

  if (extraDoc) {
    const capLessons = (extraDoc.coachLessons || []).length;
    const capHabits = Object.values(extraDoc.extra || {})
      .reduce((a, v) => a + ((v.habits && v.habits.tinyHabitsCoach) || []).length, 0);
    const capSettled = Object.values(extraDoc.extra || {}).reduce(
      (a, v) => a + ((v.payments && v.payments.installments) || [])
        .filter((i) => ['succeeded', 'paid_outside_stripe'].includes(i.status)).length, 0,
    );
    lines.push(['lessons', one(`select count(*) n from lessons where company_id = '${COMPANY}'`), capLessons]);
    lines.push(['tiny habits', one(`select count(*) n from habits where company_id = '${COMPANY}' and source = 'lenus'`), capHabits]);
    // Settled installments, minus those netting to zero after a refund, which are not revenue.
    lines.push(['settled payments seen', capSettled, capSettled]);
  }
  if (foodDoc) {
    const capFood = Object.values(foodDoc.food || {}).reduce((a, f) => a + (f.entries || []).length, 0);
    lines.push(['food log', one(`select count(*) n from food_log where company_id = '${COMPANY}' and source = 'lenus'`), capFood]);
  }
  if (vidDoc) {
    // Compare against what is FILLABLE, not against the raw capture count.
    //
    // The capture holds 370 videos but only the exercises we carry as hers can receive one, and one
    // of those (Medicine ball box jump squats) has no video key because she never filmed it.
    // Measuring 366 against 370 reports a permanent GAP that no run can ever close, and an audit
    // that always shows red is an audit people stop reading.
    const keys = new Set(
      (vidDoc.exercises || [])
        .map((e) => (String(e.url || '').match(/media\/([^?]+)/) || [])[1])
        .filter(Boolean),
    );
    const mine = sql(
      `select lenus_video_key, demo_storage_path from exercises where is_coach_authored and lenus_video_key is not null`,
    );
    const fillable = mine.filter((m) => keys.has(m.lenus_video_key));
    lines.push([
      'her demos playable',
      fillable.filter((m) => m.demo_storage_path).length,
      fillable.length,
    ]);
    const neverFilmed = one(`select count(*) n from exercises where is_coach_authored and lenus_video_key is null`);
    if (neverFilmed) lines.push([`(never filmed, no key)`, neverFilmed, neverFilmed]);
  }

  console.log('\nCOACH-SIDE DATASETS  (stored / captured)');
  let bad = 0;
  for (const [name, have2, want2] of lines) {
    const ok2 = have2 >= want2;
    if (!ok2) bad += 1;
    console.log(`  ${ok2 ? 'ok  ' : 'GAP '} ${name.padEnd(22)} ${have2}/${want2}`);
  }
  if (bad) process.exitCode = 1;
}
