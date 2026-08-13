// Bring her clients' progress photos up to date.
//
// progress_photos held 2,289 rows stopping on 2 July, while her clients kept submitting check-ins
// with pictures right through August. The photos are the single thing a coach and a client both
// look at first, and six weeks of them were missing.
//
// The URLs come from the check-in capture already on disk (.capture/sweep/lenus-checkins.json,
// 2,484 photo answers) and their CloudFront signatures run to 11 September, so this needs no new
// Lenus session. That is unusual and worth saying: everything else signed expires in hours.
//
// Downloads to the PRIVATE progress-photos bucket under the same {owner}/{uuid}.{ext} convention
// the app already uses (0032), and writes a row only after the object is confirmed uploaded.
//
// IDEMPOTENT on (company_id, storage_path): a re-run re-uses the deterministic path derived from
// the Lenus media id, so the same photo never lands twice.
//
// Run: node scripts/import-lenus-progress-photos.mjs [--apply]

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-checkins.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const BUCKET = 'progress-photos';
const CONCURRENCY = 4;

function loadEnv() {
  const out = {};
  if (!fs.existsSync('.env.local')) return out;
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;

// front / back / side, from the Lenus metric name. The app stores this as pose_source and the
// before/after comparison groups on it, so getting it wrong silently breaks that pairing.
const POSE = { frontSnapshot: 'front', backSnapshot: 'back', sideSnapshot: 'side' };

const doc = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

// What we already hold, keyed on (client, day, pose) rather than on the storage path.
//
// THE PATHS DO NOT MATCH ACROSS IMPORTS. July wrote {contact}/{checkInResponseId}-{pose}-{n}.jpg;
// the media uuid is the natural identity here and produces a different path for the same picture.
// Comparing paths reported "0 already stored" against 2,289 rows and would have re-downloaded and
// duplicated every photo she has. A client submits one front, one back and one side per check-in,
// so the triple is what actually identifies a photo.
const existing = new Set(
  sql(
    `select contact_id, taken_on::text as taken_on, pose_source from progress_photos
     where company_id = '${COMPANY}' and contact_id is not null`,
  ).map((r) => `${r.contact_id}|${r.taken_on}|${r.pose_source ?? ''}`),
);

const jobs = [];
const stat = { seen: 0, noContact: 0, noId: 0, already: 0 };

for (const c of doc.checkins) {
  const contactId = byLenus.get(c.profileId);
  const takenOn = new Date(c.response.submittedAt).toISOString().slice(0, 10);
  for (const b of c.response.blocks || []) {
    for (const a of b.answers || []) {
      const la = a.latestAnswer;
      if (!la || !la.value) continue;
      const q = la.question || {};
      if (q.type !== 'media') continue;
      stat.seen += 1;
      if (!contactId) { stat.noContact += 1; continue; }
      // The media uuid out of the URL path IS the identity: same photo, same path, every run.
      const m = String(la.value).match(/\/([0-9a-f-]{36})(?:_[^/?]*)?\.(jpe?g|png|webp)/i);
      if (!m) { stat.noId += 1; continue; }
      const pose = POSE[q.metricType] ?? null;
      if (existing.has(`${contactId}|${takenOn}|${pose ?? ''}`)) { stat.already += 1; continue; }
      const path = `${contactId}/${m[1]}.${m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase()}`;
      jobs.push({ contactId, path, url: String(la.value), takenOn, pose });
    }
  }
}

// Two check-ins can carry the same photo; keep one job per destination.
const seenPath = new Set();
const work = jobs.filter((j) => (seenPath.has(j.path) ? false : (seenPath.add(j.path), true)));

console.log(`photo answers ${stat.seen} | already stored ${stat.already} | to fetch ${work.length}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);
if (stat.noId) console.log(`skipped, no media id in the URL: ${stat.noId}`);

if (!APPLY) {
  console.log(`\nDRY RUN. Nothing written. Re-run with --apply.`);
  process.exit(0);
}
if (!work.length) process.exit(0);

let ok = 0, failed = 0, bytes = 0;
const done = [];
let i = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const k = i++;
      if (k >= work.length) return;
      const w = work[k];
      try {
        const r = await fetch(w.url);
        if (!r.ok) {
          // 403 means the CloudFront signature aged out. Re-capture the check-ins, do not retry.
          console.error(`  FAIL ${w.path}: HTTP ${r.status}${r.status === 403 ? ' (signature expired, re-capture)' : ''}`);
          failed += 1;
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        const { error } = await sb.storage.from(BUCKET).upload(w.path, buf, {
          contentType: r.headers.get('content-type') || 'image/jpeg',
          upsert: true,
        });
        if (error) { console.error(`  FAIL ${w.path}: ${error.message}`); failed += 1; continue; }
        bytes += buf.length;
        ok += 1;
        done.push(w);
        if (ok % 40 === 0) console.log(`  ${ok}/${work.length}  ${(bytes / 1048576).toFixed(0)} MB`);
      } catch (e) {
        console.error(`  FAIL ${w.path}: ${String(e.message || e).slice(0, 80)}`);
        failed += 1;
      }
    }
  }),
);

console.log(`uploaded ${ok}, failed ${failed}, ${(bytes / 1048576).toFixed(1)} MB`);

if (done.length) {
  runBatched(
    sql,
    'photo rows',
    done.map(
      (w) =>
        `insert into progress_photos (company_id, contact_id, storage_path, taken_on, pose_source)
         values (${lit(COMPANY)}, ${lit(w.contactId)}, ${lit(w.path)}, ${lit(w.takenOn)}, ${lit(w.pose)})
         on conflict do nothing;`,
    ),
  );
}
const after = sql(`select count(*) n, max(taken_on)::text newest from progress_photos where company_id = '${COMPANY}'`);
console.log(`progress_photos now ${after[0].n}, newest ${after[0].newest}`);
