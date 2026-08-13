// Pull every Lenus file asset onto disk before the account ends on 31 August.
//
// Three sets, in the order they matter if the run is interrupted:
//   lessons   her content library: 19 videos + 15 documents across 24 lessons. Pure IP, held
//             nowhere else, and the thing we had zero of before 2026-08-12.
//   plans     117 per-client deliverable PDFs (77 training, 40 meal) from profile history.
//   receipts  716 payment receipt PDFs. Lowest value, since the installment rows carry the
//             amounts, but they are the documents an accountant would ask for.
//
// The URLs are pre-signed and EXPIRE, which is why this is a download and not a link we store.
// They also work from plain Node, no session cookie: the signature is the auth.
//
// RESUMABLE. A ledger records every completed file, so a re-run skips what is already on disk and
// only retries what failed. Interrupt it freely.
//
// Run: node scripts/download-lenus-assets.mjs [lessons|plans|receipts|all] [--retry-failed]

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const WHICH = process.argv[2] || 'all';
const RETRY_FAILED = process.argv.includes('--retry-failed');
const OUT = '.capture/sweep/files';
const LEDGER_PATH = join(OUT, '_ledger.json');

mkdirSync(OUT, { recursive: true });
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : { done: {}, failed: {} };
const saveLedger = () => writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 1));

// Strip an extension the source name already carries, or every meal plan lands as `.pdf.pdf`.
const safe = (s) =>
  String(s || 'file')
    .replace(/\.(pdf|mp4|webm|mov|jpe?g|png|mp3|m4a)$/i, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'file';

// Extension from the mime type, because the URL path is a uuid with no useful suffix and a wrong
// extension makes a video unplayable in exactly the quiet way that is found months later.
const EXT = {
  'application/pdf': '.pdf', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'image/jpeg': '.jpg', 'image/png': '.png', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
};
const extFor = (mime, url) => {
  const base = String(mime || '').split(';')[0].trim();
  if (EXT[base]) return EXT[base];
  const fromUrl = extname(new URL(url).pathname);
  return /^\.[a-z0-9]{2,4}$/i.test(fromUrl) ? fromUrl : '.bin';
};

/**
 * The last 8 of the asset id, appended to every filename.
 *
 * Without it the first run lost 60 of 114 plan PDFs in silence: the name comes from the history
 * event, and two clients who both have a "Training Plan 1" wrote to the same path, so the second
 * clobbered the first. The ledger recorded 114 fetched because 114 distinct ids WERE fetched; only
 * 54 distinct paths existed on disk. A ledger that counts downloads is not a ledger that counts
 * files, and the difference is invisible unless you compare the two.
 */
const uniq = (id) => String(id).replace(/-/g, '').slice(-8);

// --- build the work list -----------------------------------------------------
const jobs = [];
const extra = existsSync('.capture/sweep/lenus-extra.json') ? JSON.parse(readFileSync('.capture/sweep/lenus-extra.json', 'utf8')) : null;
const detail = existsSync('.capture/sweep/lenus-detail.json') ? JSON.parse(readFileSync('.capture/sweep/lenus-detail.json', 'utf8')) : null;

if ((WHICH === 'lessons' || WHICH === 'all') && extra) {
  for (const l of extra.coachLessons || []) {
    for (const a of l.attachments || []) {
      const url = (a.convertedVersion && a.convertedVersion.publicPath) || a.publicPath;
      if (!url) continue;
      jobs.push({ set: 'lessons', id: a.id, url, name: `${safe(l.name)}__${safe(a.name || a.kind || a.id)}__${uniq(a.id)}`, mime: a.mimeType });
    }
    if (l.coverImage && l.coverImage.thumbnailPath) {
      jobs.push({ set: 'lessons', id: 'cover-' + l.id, url: l.coverImage.thumbnailPath, name: `${safe(l.name)}__cover__${uniq(l.id)}`, mime: 'image/jpeg' });
    }
  }
}

if ((WHICH === 'plans' || WHICH === 'all') && detail) {
  const isBilling = (n) => /receipt|purchase details|subscription details/i.test(n || '');
  for (const [pid, rec] of Object.entries(detail.detail)) {
    for (const h of rec.history || []) {
      if (isBilling(h.name)) continue;
      for (const f of h.files || []) {
        if (!f.publicPath) continue;
        jobs.push({ set: 'plans', id: f.id, url: f.publicPath, name: `${safe(h.name)}__${uniq(f.id)}`, mime: 'application/pdf', pid });
      }
    }
  }
}

if ((WHICH === 'receipts' || WHICH === 'all') && extra) {
  for (const [pid, v] of Object.entries(extra.extra || {})) {
    for (const i of (v.payments && v.payments.installments) || []) {
      if (!i.receipt || !i.receipt.publicPath) continue;
      jobs.push({ set: 'receipts', id: i.receipt.id, url: i.receipt.publicPath, name: `${safe(i.chargedAt || i.dueDate)}__${safe(i.id)}`, mime: 'application/pdf', pid });
    }
  }
}

// De-dupe: the same file can hang off several history events.
const seen = new Set();
const work = jobs.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));

// Resolve each job's destination up front so two things become checkable rather than assumed:
// whether any two jobs would collide, and whether the file a ledger entry claims is really there.
for (const j of work) j.path = join(OUT, j.set, `${j.name}${extFor(j.mime, j.url)}`);

const byPath = new Map();
for (const j of work) byPath.set(j.path, (byPath.get(j.path) || 0) + 1);
const collisions = [...byPath.entries()].filter(([, n]) => n > 1);
if (collisions.length) {
  console.error(`ABORT: ${collisions.length} destination paths are claimed by more than one asset.`);
  for (const [p, n] of collisions.slice(0, 10)) console.error(`   ${n}x  ${p}`);
  process.exit(1);
}

// "Done" means the BYTES are on disk, not that the ledger once said so. This is what re-fetches
// the 60 plan PDFs the old naming scheme overwrote: their ledger entries survive, their files do
// not, and only checking the filesystem can tell the difference.
const pending = work.filter((j) => {
  if (ledger.done[j.id] && existsSync(j.path)) return false;
  if (ledger.failed[j.id] && !RETRY_FAILED) return false;
  return true;
});

const bySet = {};
for (const j of work) bySet[j.set] = (bySet[j.set] || 0) + 1;
const onDisk = work.filter((j) => existsSync(j.path)).length;
console.log(`assets ${work.length} ${JSON.stringify(bySet)} | verified on disk ${onDisk} | to fetch ${pending.length}`);
if (!RETRY_FAILED && Object.keys(ledger.failed).length) {
  console.log(`previously failed ${Object.keys(ledger.failed).length}, skipped. Re-run with --retry-failed to try them again.`);
}
if (!pending.length) process.exit(0);

// --- fetch -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, bad = 0, bytes = 0;

for (let i = 0; i < pending.length; i += 1) {
  const j = pending[i];
  mkdirSync(join(OUT, j.set), { recursive: true });
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    try {
      const r = await fetch(j.url);
      if (!r.ok) {
        // 403 on an expiring signature is terminal for this capture, not worth three tries.
        if (r.status === 403 || r.status === 404) { ledger.failed[j.id] = `HTTP ${r.status}`; bad += 1; break; }
        await sleep(800 * (attempt + 1));
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      // j.path, decided up front and collision-checked, rather than recomputed here from a
      // content-type header that may disagree with the manifest.
      writeFileSync(j.path, buf);
      ledger.done[j.id] = { path: j.path, bytes: buf.length };
      delete ledger.failed[j.id];
      bytes += buf.length;
      ok += 1;
      saved = true;
    } catch (e) {
      if (attempt === 2) { ledger.failed[j.id] = String(e.message || e).slice(0, 120); bad += 1; }
      else await sleep(800 * (attempt + 1));
    }
  }
  if ((i + 1) % 25 === 0 || i === pending.length - 1) {
    saveLedger();
    console.log(`  ${i + 1}/${pending.length}  ok ${ok}  failed ${bad}  ${(bytes / 1048576).toFixed(1)} MB`);
  }
}
saveLedger();

console.log(`\ndone. saved ${ok}, failed ${bad}, ${(bytes / 1048576).toFixed(1)} MB -> ${OUT}`);
if (bad) {
  const kinds = {};
  for (const v of Object.values(ledger.failed)) kinds[v] = (kinds[v] || 0) + 1;
  console.log('failures:', JSON.stringify(kinds));
}

// Close the loop the first run left open: assert every expected file is actually present. A
// download count is not a file count, and reporting the former as the latter is how 60 of her
// client plan PDFs went missing while the run said it succeeded.
const missing = work.filter((j) => !existsSync(j.path));
if (missing.length) {
  console.log(`\nWARNING: ${missing.length} of ${work.length} expected files are not on disk.`);
  for (const m of missing.slice(0, 10)) console.log(`   ${m.set}  ${m.id}  ${ledger.failed[m.id] || 'no reason recorded'}`);
  process.exitCode = 1;
} else {
  console.log(`verified: all ${work.length} expected files present on disk.`);
}
