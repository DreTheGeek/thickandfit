// Fill in the last of her filmed demos.
//
// 286 of her 367 movements already play in the app. The other 81 were downloaded from a PUBLIC GCS
// bucket in an earlier pass and 403'd there, so they had no footage and the player showed a camera
// icon. The August sweep found the real route: CoachExercises_Data returns a SIGNED CloudFront URL
// per video, minted from her session. 80 of the 81 match on the lenus_video_key we already store.
//
// THE SIGNATURES EXPIRE. .capture/sweep/lenus-exercise-videos.json is only useful for a few hours
// after capture; re-capture before re-running. Everything else in this migration can be replayed
// from disk indefinitely, this one cannot.
//
// Uploads to lenus-coach-media/exercise-demos/, beside the 286 that already work, and writes
// exercises.demo_storage_path ONLY after confirming the object is in the bucket. A row whose upload
// failed keeps a null path, so the player shows "not filmed yet" rather than handing the browser a
// URL that 404s. That rule is from 0122 and it is why the existing 286 never break.
//
// Run: node scripts/import-lenus-exercise-videos.mjs [--apply]

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { makeSql } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-exercise-videos.json';
const BUCKET = 'lenus-coach-media';
const PREFIX = 'exercise-demos';
const TMP = '.capture/sweep/exercise-videos';
const CONCURRENCY = 3;

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
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = makeSql();

const doc = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// Video key out of the signed URL path, which is what exercises.lenus_video_key already holds.
const keyOf = (url) => {
  const m = String(url || '').match(/media\/([^?]+)/);
  return m ? m[1] : null;
};
const byKey = new Map();
for (const e of doc.exercises || []) {
  const k = keyOf(e.url);
  if (k && e.url) byKey.set(k, e);
}

const need = sql(
  `select id, name_en, lenus_video_key from exercises
   where is_coach_authored and demo_storage_path is null and lenus_video_key is not null`,
);
const work = need.map((n) => ({ ...n, hit: byKey.get(n.lenus_video_key) })).filter((n) => n.hit);

console.log(`missing a demo: ${need.length} | matched in this capture: ${work.length}`);
const unmatched = need.filter((n) => !byKey.has(n.lenus_video_key));
if (unmatched.length) {
  console.log(`no video in the capture for ${unmatched.length}:`);
  for (const u of unmatched.slice(0, 6)) console.log(`   ${u.name_en}`);
}

if (!APPLY) {
  console.log(`\nDRY RUN. Would fetch and upload ${work.length} videos. Re-run with --apply.`);
  process.exit(0);
}

fs.mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, failed = 0, bytes = 0;

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; await fn(items[k]); }
  }));
}

const linked = [];
await pool(work, CONCURRENCY, async (w) => {
  const path = `${PREFIX}/${w.lenus_video_key}`;
  try {
    const r = await fetch(w.hit.url);
    if (!r.ok) {
      // A 403 here means the signature aged out mid-run. Say so plainly: the fix is to re-capture,
      // not to retry.
      console.error(`  FAIL ${w.name_en}: HTTP ${r.status}${r.status === 403 ? ' (signature expired, re-capture)' : ''}`);
      failed += 1;
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'video/mp4', upsert: true });
    if (error) { console.error(`  FAIL ${w.name_en}: ${error.message}`); failed += 1; return; }
    bytes += buf.length;
    ok += 1;
    linked.push({ id: w.id, path });
    if (ok % 20 === 0) console.log(`  ${ok}/${work.length}  ${(bytes / 1048576).toFixed(0)} MB`);
  } catch (e) {
    console.error(`  FAIL ${w.name_en}: ${String(e.message || e).slice(0, 90)}`);
    failed += 1;
  }
});
await sleep(500);

// Confirm the objects are REALLY there before pointing a row at one.
const present = new Set();
for (let offset = 0; offset < 2000; offset += 100) {
  const { data } = await sb.storage.from(BUCKET).list(PREFIX, { limit: 100, offset });
  if (!data || !data.length) break;
  for (const o of data) present.add(`${PREFIX}/${o.name}`);
  if (data.length < 100) break;
}
const confirmed = linked.filter((l) => present.has(l.path));
console.log(`uploaded ${ok}, failed ${failed}, ${(bytes / 1048576).toFixed(1)} MB | confirmed in bucket ${confirmed.length}`);

if (confirmed.length) {
  const chunk = 60;
  for (let i = 0; i < confirmed.length; i += chunk) {
    const part = confirmed.slice(i, i + chunk);
    const cases = part.map((c) => `when '${c.id}' then '${c.path.replace(/'/g, "''")}'`).join(' ');
    const ids = part.map((c) => `'${c.id}'`).join(', ');
    sql(`update exercises set demo_storage_path = case id::text ${cases} end where id in (${ids});`);
  }
}
const after = sql(`select count(demo_storage_path) n from exercises where is_coach_authored`);
console.log(`her exercises with a playable demo: ${after[0].n} of 367`);
