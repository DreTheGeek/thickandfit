// Import Stephanie's Lenus weekly check-ins.
//
// Source: .capture/sweep/lenus-checkins.json, 859 submitted responses across 247 clients, captured
// 2026-08-12. Before this ran, public.form_responses held TWO rows, both belonging to the sample QA
// subscriber. The July extract fetched only the check-in IDs (765 of them) and never the bodies,
// so every answer she has ever read in Lenus was missing from her own app.
//
// Writes three places, because one check-in IS three things:
//   form_responses     the answers, keyed to the fields 0129 rebuilt from her real question set
//   weight_entries     the weight, so the trend chart has points
//   body_measurements  the five circumferences
//
// IDEMPOTENT. form_responses on (company_id, external_id); the other two on the per-day partial
// indexes from 0131. Re-run freely: this runs again before the 31 August cutoff.
//
// Run: node scripts/import-lenus-checkins.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-checkins.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const FORM = '6b22fe6e-3b90-4910-b437-3bc0640b92eb';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const jlit = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

// --- lookups ----------------------------------------------------------------
// Lenus profile id -> our contact id. Migrated rows key on contact_id: profile_id is only set once
// a member claims an app account, and these members have not.
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

// Field lookup keyed by the Lenus block title AND type. Both are needed: "Steps" and "Water" are
// each TWO questions in her form, a yes/no select and a free-text amount, and keying on title alone
// would collapse them into one and lose whichever came second.
const fields = sql(
  `select id, type, label_en, config->'lenus'->>'title' as l_title, config->'lenus'->>'type' as l_type
   from form_fields where company_id = '${COMPANY}' and form_id = '${FORM}'`,
);
const fieldKey = (title, type) => `${String(title || '').trim()}|${type}`;
const byField = new Map(fields.map((f) => [fieldKey(f.l_title, f.l_type), f.id]));

// --- value mapping ----------------------------------------------------------
// Selects answer with an OPTION ID, and the human label lives in question.data[].value[]. Storing
// the raw id would render "9346de21-c997-..." where she expects "Good", so resolve it here and
// fall back to the id only if the option list is missing.
function resolveSelect(answer) {
  const q = answer?.question || {};
  const opts = (q.data || []).find((d) => d.type === 'options');
  const list = Array.isArray(opts?.value) ? opts.value : [];
  const hit = list.find((o) => o.id === answer.value);
  if (!hit) return answer.value ?? null;
  // Sleep quality is a 0-10 scale where the label is the number and the description is the word.
  return hit.description ? `${hit.label} (${hit.description})` : hit.label;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const CIRC = {
  waistCircumference: 'waist_cm',
  hipCircumference: 'hips_cm',
  chestCircumference: 'chest_cm',
  upperArmCircumference: 'arms_cm',
  thighCircumference: 'thighs_cm',
  fatPercent: 'body_fat_pct',
};

// Two sites she has measured but our table has no column for: glutes (1 row) and stomach (1 row).
// Counted and reported rather than silently dropped, and deliberately NOT given columns: two rows
// across 859 check-ins does not justify widening the schema, but it does justify saying so.
const CIRC_NO_COLUMN = new Set(['glutesCircumference', 'stomachCircumference']);

// --- walk -------------------------------------------------------------------
const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const statements = [];
const stat = { responses: 0, answers: 0, weights: 0, measures: 0, noContact: 0, noField: new Map(), photos: 0, whys: 0, noColumn: new Map() };

// "Your why" is asked once, at intake, inside the same check-in machinery as the weekly questions.
// It is not a weekly answer and does not belong on the weekly form: it belongs on the client's
// record, in client_intake.client_why, which 0117 added and which is empty for all 267 rows.
const whys = new Map();

for (const c of doc.checkins) {
  const contactId = byLenus.get(c.profileId);
  if (!contactId) { stat.noContact += 1; continue; }
  const submittedAt = new Date(c.response.submittedAt).toISOString();
  const day = submittedAt.slice(0, 10);

  const answers = {};
  let weightKg = null;
  const circ = {};

  for (const block of c.response.blocks || []) {
    const fb = block.formBlock || {};
    const title = String(fb.title || '').trim();
    for (const a of block.answers || []) {
      const la = a.latestAnswer;
      if (!la || la.value == null || la.value === '') continue;
      const q = la.question || {};
      const metric = q.metricType;

      // Numbers that belong in their own tables. They are NOT written to answers as well: the
      // trend charts read the dedicated tables, and two copies drift the first time one is edited.
      if (metric === 'weight') { weightKg = num(la.value); continue; }
      if (CIRC[metric]) { circ[CIRC[metric]] = num(la.value); continue; }
      if (CIRC_NO_COLUMN.has(metric)) { stat.noColumn.set(metric, (stat.noColumn.get(metric) || 0) + 1); continue; }

      // Asked once at intake, not weekly. Newest submission wins if a client answered twice.
      if (title === 'Your "why"') {
        const prev = whys.get(contactId);
        if (!prev || prev.at < submittedAt) whys.set(contactId, { at: submittedAt, value: String(la.value) });
        continue;
      }
      // Progress photos are already migrated (2,289 rows in progress_photos) and these URLs are
      // signed and expiring, so recording the fact is useful and recording the link is not.
      if (q.type === 'media') { stat.photos += 1; continue; }

      const fid = byField.get(fieldKey(title, fb.type));
      if (!fid) {
        stat.noField.set(fieldKey(title, fb.type), (stat.noField.get(fieldKey(title, fb.type)) || 0) + 1);
        continue;
      }
      const value =
        fb.type === 'select' || fb.type === 'sleepQuality' ? resolveSelect(la)
        : fb.type === 'rating' ? num(la.value)
        : la.value;
      if (value === null || value === '') continue;
      answers[fid] = value;
      stat.answers += 1;
    }
  }

  stat.responses += 1;
  statements.push(
    `insert into form_responses (company_id, form_id, contact_id, external_id, answers, submitted_at)
     values (${lit(COMPANY)}, ${lit(FORM)}, ${lit(contactId)}, ${lit(c.response.id)}, ${jlit(answers)}, ${lit(submittedAt)})
     on conflict (company_id, external_id) where external_id is not null
     do update set answers = excluded.answers, submitted_at = excluded.submitted_at;`,
  );

  if (weightKg !== null) {
    stat.weights += 1;
    statements.push(
      `insert into weight_entries (company_id, contact_id, recorded_on, weight_kg, source)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(day)}, ${lit(weightKg)}, 'lenus')
       on conflict (company_id, contact_id, recorded_on) where source = 'lenus' and contact_id is not null
       do update set weight_kg = excluded.weight_kg;`,
    );
  }

  if (Object.keys(circ).length) {
    stat.measures += 1;
    const cols = Object.keys(circ);
    statements.push(
      `insert into body_measurements (company_id, contact_id, recorded_on, ${cols.join(', ')}, source)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(day)}, ${cols.map((k) => lit(circ[k])).join(', ')}, 'lenus')
       on conflict (company_id, contact_id, recorded_on) where source = 'lenus' and contact_id is not null
       do update set ${cols.map((k) => `${k} = excluded.${k}`).join(', ')};`,
    );
  }
}

// Only client_why is set on conflict, so an existing intake row keeps every other answer. Writing
// a subset of client_intake with a full-row upsert is how migrated Lenus data gets blanked.
for (const [contactId, w] of whys) {
  stat.whys += 1;
  statements.push(
    `insert into client_intake (company_id, contact_id, client_why)
     values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(w.value)})
     on conflict (company_id, contact_id) do update set client_why = excluded.client_why;`,
  );
}

console.log(`responses ${stat.responses} | answers ${stat.answers} | weights ${stat.weights} | measurements ${stat.measures}`);
console.log(`client "why" statements ${stat.whys} | photo answers skipped (already migrated) ${stat.photos} | check-ins with no matching contact ${stat.noContact}`);
if (stat.noColumn.size) {
  console.log('measured but no column (reported, not dropped silently):');
  for (const [k, n] of stat.noColumn) console.log(`   ${n}x  ${k}`);
}
if (stat.noField.size) {
  console.log('UNMAPPED BLOCKS (these answers would be dropped):');
  for (const [k, n] of [...stat.noField.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${n}x  ${k}`);
}

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

// Batched by CHARACTER budget: one call per statement rate-limits the Management API, and batching
// by statement count blows the OS argument limit because the query travels as an argv entry.
runBatched(sql, 'check-ins', statements, {
  pauseMs: 150,
  onProgress: (done, total) => {
    if (done % 400 < 10) console.log(`  ${done}/${total}`);
  },
});
