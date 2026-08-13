// Move the 873 Lenus files off this laptop and into Supabase Storage.
//
// `scripts/download-lenus-assets.mjs` pulled 470 MB from her account before it closes on 31 August:
// 43 lesson assets (her content library, 261 MB), 114 per-client plan PDFs, 716 payment receipts.
// Until they are in Storage they exist on one machine, are not in git (they are her IP and far too
// large), and the app cannot render a single one.
//
// Destinations are the buckets that already existed and sat empty, which is where these were
// always meant to go:
//   lessons  -> lenus-coach-media/lessons/    (private; joins the 286 exercise demos)
//   plans    -> lenus-client-media/plans/     (private; per-client deliverables)
//   receipts -> lenus-billing-docs/receipts/  (private; document retention)
//
// RESUMABLE AND VERIFIED. It lists what each bucket already holds and skips those, then re-lists
// afterwards and asserts the object count matches the file count. The download script reported 873
// files when 813 existed because it counted downloads rather than files; this one refuses to make
// the same claim without checking.
//
// Usage: node scripts/upload-lenus-assets.mjs [lessons|plans|receipts|all] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SRC = '.capture/sweep/files';
const SETS = {
  lessons: { bucket: 'lenus-coach-media', prefix: 'lessons' },
  plans: { bucket: 'lenus-client-media', prefix: 'plans' },
  receipts: { bucket: 'lenus-billing-docs', prefix: 'receipts' },
};
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WHICH = args.find((a) => !a.startsWith('--')) || 'all';

// .env.local is the only place these live locally. Values are used, never printed.
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

const MIME = {
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry transient Storage failures.
 *
 * A 716-file run hit six "fetch failed" uploads and then died outright on a Gateway Timeout while
 * LISTING, after all the bytes were already up. Both are network weather, not a rejected request,
 * and neither should end a job this size. Same lesson as scripts/lib/mgmt-sql.mjs.
 */
async function withRetry(label, fn, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i += 1) {
    try {
      const out = await fn();
      if (!out?.error) return out;
      last = out.error.message || String(out.error);
    } catch (e) {
      last = String(e?.message || e);
    }
    await sleep(600 * (i + 1) * (i + 1));
  }
  throw new Error(`${label}: ${last}`);
}

/** Every object under a prefix. list() pages at 100, so a single call would quietly see 100 of 716. */
async function listAll(bucket, prefix) {
  const names = new Set();
  for (let offset = 0; offset < 5000; offset += 100) {
    const { data } = await withRetry(`list ${bucket}/${prefix}`, () =>
      sb.storage.from(bucket).list(prefix, { limit: 100, offset }),
    );
    if (!data || data.length === 0) break;
    for (const o of data) names.add(o.name);
    if (data.length < 100) break;
  }
  return names;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      await fn(items[k], k);
    }
  }));
}

const chosen = WHICH === 'all' ? Object.keys(SETS) : [WHICH];
let grandFiles = 0;
let grandUploaded = 0;
let failedTotal = 0;

for (const set of chosen) {
  const cfg = SETS[set];
  if (!cfg) { console.error(`unknown set "${set}"`); process.exit(1); }
  const dir = path.join(SRC, set);
  if (!fs.existsSync(dir)) { console.log(`${set}: no directory, skipping`); continue; }

  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('_'));
  const already = await listAll(cfg.bucket, cfg.prefix);
  const todo = files.filter((f) => !already.has(f));
  grandFiles += files.length;
  console.log(`${set}: ${files.length} on disk | ${already.size} already in ${cfg.bucket}/${cfg.prefix} | ${todo.length} to upload`);

  if (!DRY && todo.length) {
    let done = 0, failed = 0;
    await pool(todo, CONCURRENCY, async (name) => {
      const body = fs.readFileSync(path.join(dir, name));
      const contentType = MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
      try {
        await withRetry(`upload ${name}`, () =>
          sb.storage.from(cfg.bucket).upload(`${cfg.prefix}/${name}`, body, { contentType, upsert: true }),
        );
        done += 1;
      } catch (e) {
        failed += 1;
        console.error(`  FAIL ${name}: ${String(e.message).slice(0, 120)}`);
      }
      if ((done + failed) % 50 === 0) console.log(`  ${done + failed}/${todo.length}`);
    });
    grandUploaded += done;
    failedTotal += failed;
    console.log(`  uploaded ${done}, failed ${failed}`);
  }

  // Re-list and assert. An upload that reported success but left no object is the exact failure
  // mode this script exists to rule out.
  if (!DRY) {
    const after = await listAll(cfg.bucket, cfg.prefix);
    const missing = files.filter((f) => !after.has(f));
    if (missing.length) {
      console.error(`  MISMATCH: ${missing.length} of ${files.length} files are not in the bucket. e.g. ${missing.slice(0, 3).join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log(`  verified: ${after.size} objects in ${cfg.bucket}/${cfg.prefix} covers all ${files.length} files`);
    }
  }
}

console.log(`\n${DRY ? 'DRY RUN. ' : ''}files ${grandFiles} | uploaded this run ${grandUploaded} | failed ${failedTotal}`);
