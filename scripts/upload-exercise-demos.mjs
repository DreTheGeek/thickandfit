// Move her filmed demos off this laptop and into the app.
//
// The 287 MP4s in .capture/videos/ were pulled from Lenus before the contract ends on 31 Aug. Until
// they are in Supabase Storage they exist in exactly one place, on one machine, not in git (406 MB),
// and the app cannot show her a single one of them. That is the whole of "i dont see her recorded
// video in this software anywhere".
//
// RESUMABLE AND IDEMPOTENT. It lists what the bucket already holds, skips those, and only writes
// exercises.demo_storage_path for a file it has confirmed is actually up there. A row whose upload
// failed keeps a null path, so the player shows "no footage yet" instead of handing the browser a
// URL that 404s.
//
// Usage: node scripts/upload-exercise-demos.mjs [--limit=N] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DIR = '.capture/videos';
const BUCKET = 'lenus-coach-media';
const PREFIX = 'exercise-demos';
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : Infinity;
const DRY = args.includes('--dry');

// .env.local is the only place these live locally; read it here rather than requiring an exported
// shell. Values are used, never printed.
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// Every key the library expects, so a stray file on disk that matches no exercise is reported
// rather than silently uploaded.
const { data: rows, error: rowsErr } = await sb
  .from('exercises')
  .select('id, name_en, lenus_video_key, demo_storage_path')
  .eq('is_coach_authored', true)
  .not('lenus_video_key', 'is', null)
  .limit(2000);
if (rowsErr) {
  console.error('read exercises:', rowsErr.message);
  process.exit(1);
}
const byKey = new Map(rows.map((r) => [r.lenus_video_key, r]));

// What the bucket already holds, so a re-run is cheap.
const already = new Set();
for (let offset = 0; ; offset += 1000) {
  const { data: listed, error } = await sb.storage.from(BUCKET).list(PREFIX, { limit: 1000, offset });
  if (error) {
    console.error('list bucket:', error.message);
    break;
  }
  if (!listed?.length) break;
  for (const f of listed) already.add(f.name);
  if (listed.length < 1000) break;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mp4'));
const orphans = files.filter((f) => !byKey.has(f));
const todo = files.filter((f) => byKey.has(f) && !already.has(f)).slice(0, LIMIT);

console.log(
  `on disk ${files.length} · already in bucket ${already.size} · matched to an exercise ${files.length - orphans.length} · to upload ${todo.length}` +
    (orphans.length ? ` · ${orphans.length} on disk match no exercise` : ''),
);
if (DRY) process.exit(0);

let uploaded = 0;
let failed = 0;
let linked = 0;

async function one(file) {
  const dest = `${PREFIX}/${file}`;
  const body = fs.readFileSync(path.join(DIR, file));
  const { error } = await sb.storage.from(BUCKET).upload(dest, body, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (error) {
    console.error(`upload ${file}: ${error.message}`);
    failed += 1;
    return;
  }
  uploaded += 1;
}

// Bounded concurrency: 4 parallel uploads keeps a 400 MB push to a few minutes without tripping
// the storage rate limit.
for (let i = 0; i < todo.length; i += CONCURRENCY) {
  await Promise.all(todo.slice(i, i + CONCURRENCY).map(one));
  if ((i / CONCURRENCY) % 10 === 0) console.log(`  ${Math.min(i + CONCURRENCY, todo.length)}/${todo.length}`);
}

// Link ONLY what is verifiably in the bucket now, re-listing rather than trusting the upload calls.
const confirmed = new Set();
for (let offset = 0; ; offset += 1000) {
  const { data: listed, error } = await sb.storage.from(BUCKET).list(PREFIX, { limit: 1000, offset });
  if (error || !listed?.length) break;
  for (const f of listed) confirmed.add(f.name);
  if (listed.length < 1000) break;
}

const toLink = rows.filter(
  (r) => confirmed.has(r.lenus_video_key) && r.demo_storage_path !== `${PREFIX}/${r.lenus_video_key}`,
);
for (let i = 0; i < toLink.length; i += 20) {
  await Promise.all(
    toLink.slice(i, i + 20).map(async (r) => {
      const { error } = await sb
        .from('exercises')
        .update({ demo_storage_path: `${PREFIX}/${r.lenus_video_key}` })
        .eq('id', r.id);
      if (error) console.error(`link ${r.name_en}: ${error.message}`);
      else linked += 1;
    }),
  );
}

const missing = rows.filter((r) => !confirmed.has(r.lenus_video_key));
console.log(
  `\nuploaded ${uploaded} · failed ${failed} · linked ${linked} · in bucket ${confirmed.size}\n` +
    `${missing.length} of her ${rows.length} still have no footage (never downloaded from Lenus; those keys 403).`,
);
