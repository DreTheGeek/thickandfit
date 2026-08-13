// Import Stephanie's Lenus content library into lessons / lesson_assets / lesson_plans /
// lesson_plan_items / lesson_sends (migration 0133).
//
// Source: .capture/sweep/lenus-extra.json (`coachLessons`, 24 entries) plus the download ledger at
// .capture/sweep/files/_ledger.json, which maps each Lenus asset id to the file on disk and hence
// to its object path in the private lenus-coach-media bucket.
//
// 24 lessons, 34 attachments (19 videos + 15 documents), 9 cover images, 3 content plans and 1,757
// delivery records. Before this ran there was no table and no row: her library existed only on an
// account that closes 31 August.
//
// SENDS ARE HISTORY. The 1,757 lessonLogs import so her client records are complete. Nothing reads
// them to deliver anything. All of them carry state 'received' and NO timestamp, so sent_at lands
// null rather than being back-filled from a content-plan start date that would be a guess.
//
// IDEMPOTENT on (company_id, lenus_id) for lessons, plans and sends, and on
// (company_id, storage_path) for assets.
//
// Run: node scripts/import-lenus-lessons.mjs [--apply]

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-extra.json';
const LEDGER = '.capture/sweep/files/_ledger.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const BUCKET_PREFIX = 'lessons';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { done: {} };

// Asset id -> object path in the bucket. Only assets whose bytes are confirmed on disk get a row,
// so a lesson_assets row always means the file exists. This is the rule 0122 set for
// exercises.demo_storage_path and the reason her demos never hand the browser a 404.
const pathFor = (assetId) => {
  const rec = ledger.done[assetId];
  if (!rec || !rec.path) return null;
  return `${BUCKET_PREFIX}/${basename(rec.path)}`;
};
const bytesFor = (assetId) => (ledger.done[assetId] || {}).bytes ?? null;

// Her categories arrive dirty: trailing spaces and seven blanks. Trim, and leave a blank as null
// rather than inventing a bucket she did not choose.
const cleanCategory = (c) => {
  const t = String(c || '').trim();
  return t.length ? t : null;
};

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'lesson';

// --- lessons + assets --------------------------------------------------------
const statements = [];
const stat = { lessons: 0, assets: 0, covers: 0, missingAsset: [], plans: 0, planItems: 0, sends: 0, sendNoContact: 0, retired: new Map() };
const slugSeen = new Set();

doc.coachLessons.forEach((l, i) => {
  const title = String(l.name || '').trim() || 'Untitled lesson';
  let slug = slugify(title);
  while (slugSeen.has(slug)) slug = `${slug}-${i}`;
  slugSeen.add(slug);
  stat.lessons += 1;

  statements.push(
    `insert into lessons (company_id, lenus_id, slug, title_en, body_html_en, category, sort_order, is_published)
     values (${lit(COMPANY)}, ${lit(l.id)}, ${lit(slug)}, ${lit(title)}, ${lit(l.message || null)}, ${lit(cleanCategory(l.category))}, ${i}, false)
     on conflict (company_id, lenus_id) where lenus_id is not null
     do update set slug = excluded.slug, title_en = excluded.title_en, body_html_en = excluded.body_html_en,
                   category = excluded.category, sort_order = excluded.sort_order;`,
  );

  (l.attachments || []).forEach((a, ai) => {
    const p = pathFor(a.id);
    if (!p) { stat.missingAsset.push(`${title} / ${a.kind || a.id}`); return; }
    const kind = a.kind === 'video' ? 'video' : 'document';
    stat.assets += 1;
    statements.push(
      `insert into lesson_assets (company_id, lesson_id, lenus_id, kind, storage_path, mime_type, duration_seconds, bytes, sort_order)
       select ${lit(COMPANY)}, le.id, ${lit(a.id)}, ${lit(kind)}, ${lit(p)}, ${lit(a.mimeType || null)},
              ${lit(a.metadata && a.metadata.mediaDurationInSeconds ? Math.round(a.metadata.mediaDurationInSeconds) : null)},
              ${lit(bytesFor(a.id))}, ${ai}
       from lessons le where le.company_id = ${lit(COMPANY)} and le.lenus_id = ${lit(l.id)}
       on conflict (company_id, storage_path)
       do update set mime_type = excluded.mime_type, duration_seconds = excluded.duration_seconds, bytes = excluded.bytes;`,
    );
  });

  const coverPath = pathFor('cover-' + l.id);
  if (coverPath) {
    stat.covers += 1;
    statements.push(
      `insert into lesson_assets (company_id, lesson_id, lenus_id, kind, storage_path, mime_type, bytes, sort_order)
       select ${lit(COMPANY)}, le.id, ${lit('cover-' + l.id)}, 'cover', ${lit(coverPath)}, 'image/jpeg', ${lit(bytesFor('cover-' + l.id))}, 99
       from lessons le where le.company_id = ${lit(COMPANY)} and le.lenus_id = ${lit(l.id)}
       on conflict (company_id, storage_path) do update set bytes = excluded.bytes;`,
    );
  }
});

// --- content plans, and which lessons sit in them ----------------------------
// The plan itself comes from contentPlanSchedules; membership comes from the per-client lesson
// rows, each of which carries contentPlanId. Neither is available on the coach-level query.
const plans = new Map();
const planMembers = new Map();
for (const v of Object.values(doc.extra || {})) {
  for (const s of (v.lessons && v.lessons.contentPlanSchedules) || []) {
    if (s.contentPlan) plans.set(s.contentPlan.id, s.contentPlan.name);
  }
  for (const l of (v.lessons && v.lessons.lessons) || []) {
    if (!l.contentPlanId) continue;
    if (!planMembers.has(l.contentPlanId)) planMembers.set(l.contentPlanId, new Set());
    planMembers.get(l.contentPlanId).add(l.id);
  }
}
let pi = 0;
for (const [planId, name] of plans) {
  stat.plans += 1;
  statements.push(
    `insert into lesson_plans (company_id, lenus_id, name_en, sort_order)
     values (${lit(COMPANY)}, ${lit(planId)}, ${lit(String(name).trim())}, ${pi++})
     on conflict (company_id, lenus_id) where lenus_id is not null
     do update set name_en = excluded.name_en;`,
  );
  let si = 0;
  for (const lessonId of planMembers.get(planId) || []) {
    stat.planItems += 1;
    statements.push(
      `insert into lesson_plan_items (company_id, lesson_plan_id, lesson_id, sort_order)
       select ${lit(COMPANY)}, lp.id, le.id, ${si++}
       from lesson_plans lp, lessons le
       where lp.company_id = ${lit(COMPANY)} and lp.lenus_id = ${lit(planId)}
         and le.company_id = ${lit(COMPANY)} and le.lenus_id = ${lit(lessonId)}
       on conflict (lesson_plan_id, lesson_id) do nothing;`,
    );
  }
}

// --- sends: history, and only for people we can attribute --------------------
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));
const lessonIds = new Set(doc.coachLessons.map((l) => l.id));

for (const [pid, v] of Object.entries(doc.extra || {})) {
  if (!byLenus.has(pid)) { stat.sendNoContact += ((v.lessons && v.lessons.lessonLogs) || []).length; continue; }
  for (const g of (v.lessons && v.lessons.lessonLogs) || []) {
    // A log can point at a lesson she has since retired or replaced. The coach-level library query
    // returns only what is live, so those ids resolve to nothing here. Counted by name rather than
    // dropped in silence: it is the difference between "she never sent that" and "we cannot see it".
    if (!g.lesson) continue;
    if (!lessonIds.has(g.lesson.id)) {
      const nm = String(g.lesson.name || g.lesson.id).trim();
      stat.retired.set(nm, (stat.retired.get(nm) || 0) + 1);
      continue;
    }
    stat.sends += 1;
    statements.push(
      `insert into lesson_sends (company_id, lesson_id, contact_id, lenus_id, state, sent_at, source)
       select ${lit(COMPANY)}, le.id, c.id, ${lit(g.id)}, ${lit(g.state === 'received' ? 'received' : 'sent')}, null, 'lenus'
       from lessons le, contacts c
       where le.company_id = ${lit(COMPANY)} and le.lenus_id = ${lit(g.lesson.id)}
         and c.company_id = ${lit(COMPANY)} and c.lenus_id = ${lit(pid)}
       on conflict (company_id, lenus_id) where lenus_id is not null do nothing;`,
    );
  }
}

console.log(`lessons ${stat.lessons} | assets ${stat.assets} | covers ${stat.covers} | plans ${stat.plans} | plan items ${stat.planItems} | sends ${stat.sends}`);
if (stat.missingAsset.length) {
  console.log(`assets with no confirmed file on disk (skipped, run download-lenus-assets first): ${stat.missingAsset.length}`);
  for (const m of stat.missingAsset.slice(0, 8)) console.log(`   ${m}`);
}
if (stat.sendNoContact) console.log(`sends skipped, no matching contact: ${stat.sendNoContact}`);
if (stat.retired.size) {
  const n = [...stat.retired.values()].reduce((a, b) => a + b, 0);
  console.log(`sends pointing at lessons no longer in her library: ${n} across ${stat.retired.size} titles`);
  for (const [name, c] of [...stat.retired.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${c}x  ${name}`);
}

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'lessons', statements, {
  onProgress: (done, total) => {
    if (done % 400 < 12) console.log(`  ${done}/${total}`);
  },
});
