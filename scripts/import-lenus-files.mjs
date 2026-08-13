// Attach the recovered files to the records they belong to.
//
//   114 plan PDFs  -> contact_files, category training_plan / meal_plan, on the client who got them
//   716 receipts   -> contact_transactions.receipt_storage_path, on the payment they evidence
//
// Both sets are already in private Supabase buckets (scripts/upload-lenus-assets.mjs) and both
// carry a storage path rather than a URL, so readers sign them per request. Migration 0137 added
// the columns and explains why receipts do not go in the Files tab.
//
// The plan PDFs are the point of this script: 77 training plans and 40 meal plans she wrote FOR a
// named client and sent them. They are the only per-client deliverable in the whole migration and
// we held none of them.
//
// IDEMPOTENT on (company_id, storage_path) for files and (company_id, lenus_txn_id) for receipts.
//
// Run: node scripts/import-lenus-files.mjs [--apply]

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const LEDGER = '.capture/sweep/files/_ledger.json';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;

const detail = JSON.parse(readFileSync('.capture/sweep/lenus-detail.json', 'utf8'));
const extra = JSON.parse(readFileSync('.capture/sweep/lenus-extra.json', 'utf8'));
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { done: {} };

// Only files whose bytes are confirmed on disk (and therefore uploaded) get a row. A row pointing
// at an object the bucket does not have is worse than no row: it renders as a broken link.
const pathFor = (assetId, prefix) => {
  const rec = ledger.done[assetId];
  if (!rec || !rec.path) return null;
  return `${prefix}/${basename(rec.path)}`;
};

const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = { plans: 0, meal: 0, training: 0, receipts: 0, noContact: 0, noFile: 0 };

// --- plan PDFs ---------------------------------------------------------------
const isBilling = (n) => /receipt|purchase details|subscription details/i.test(n || '');
const isMealPlan = (n) => /meal\s*plan/i.test(n || '');

for (const [pid, rec] of Object.entries(detail.detail || {})) {
  const contactId = byLenus.get(pid);
  for (const h of rec.history || []) {
    if (isBilling(h.name)) continue;
    for (const f of h.files || []) {
      const p = pathFor(f.id, 'plans');
      if (!p) { stat.noFile += 1; continue; }
      if (!contactId) { stat.noContact += 1; continue; }
      const category = isMealPlan(h.name) ? 'meal_plan' : 'training_plan';
      if (category === 'meal_plan') stat.meal += 1; else stat.training += 1;
      stat.plans += 1;
      const bytes = (ledger.done[f.id] || {}).bytes ?? null;
      statements.push(
        // url is NOT NULL and carries unique (contact_id, url), but these files have a storage path
        // and no public URL. Keyed on the Lenus file id rather than the event name: a client can
        // have two documents under one "Training Plan 1" heading, and the name collides.
        // Deliberately not URL-shaped, so nothing tries to follow it: the reader signs
        // storage_path instead.
        `insert into contact_files (company_id, contact_id, category, url, storage_path, bucket, bytes)
         values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(category)}, ${lit(`lenus-file:${f.id}`)},
                 ${lit(p)}, 'lenus-client-media', ${lit(bytes)})
         on conflict (company_id, storage_path) where storage_path is not null
         do update set category = excluded.category, bytes = excluded.bytes;`,
      );
    }
  }
}

// --- receipts ----------------------------------------------------------------
//
// Matched on the installment id OR the natural key, because the payment this receipt evidences may
// be stored under either. Only 168 of these installments became new rows; the other 540 were
// already present from the Lenus CSV export under a sequential integer id (see
// import-lenus-billing.mjs). Keying on lenus_txn_id alone linked 158 of 716 receipts and left the
// rest orphaned in the bucket.
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

for (const [pid, v] of Object.entries(extra.extra || {})) {
  const contactId = byLenus.get(pid);
  for (const i of (v.payments && v.payments.installments) || []) {
    if (!i.receipt || !i.receipt.id) continue;
    const p = pathFor(i.receipt.id, 'receipts');
    if (!p) { stat.noFile += 1; continue; }
    if (!contactId) { stat.noContact += 1; continue; }
    const occurred = day(i.chargedAt || i.dueDate);
    const refunded = Boolean(i.isRefunded || i.isPartiallyRefunded);
    const cents = refunded && Number.isFinite(i.amountAfterRefund) ? i.amountAfterRefund : i.amount;
    stat.receipts += 1;
    statements.push(
      `update contact_transactions set receipt_storage_path = ${lit(p)}
       where company_id = ${lit(COMPANY)}
         and receipt_storage_path is null
         and (
           lenus_txn_id = ${lit(i.id)}
           or (contact_id = ${lit(contactId)} and occurred_at = ${lit(occurred)} and gross_cents = ${lit(cents)})
         );`,
    );
  }
}

console.log(`plan PDFs ${stat.plans} (training ${stat.training}, meal ${stat.meal}) | receipts linked ${stat.receipts}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);
if (stat.noFile) console.log(`skipped, file not confirmed on disk: ${stat.noFile}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'files', statements, {
  onProgress: (done, total) => {
    if (done % 300 < 10) console.log(`  ${done}/${total}`);
  },
});
