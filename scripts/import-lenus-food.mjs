// Import her clients' Lenus food diary: 8,419 entries across 263 people.
//
// Source: .capture/sweep/lenus-food.json, a FULL-HISTORY sweep (2024-01 to today), not just the
// delta. One extra pass over data we already hold is cheap, and it turned "the delta looks right"
// into "the whole diary reconciles".
//
// WHAT THIS REPLACES. The July import wrote 6,924 rows with no source id, so nothing could tell
// "the same entry, fetched again" from "a second helping". Before deleting a single one, the
// capture was proved a strict superset: every held row matched on (contact, day, name, kcal), zero
// missing. Then 0138 added external_id, so the NEXT run is an upsert and no such proof is needed.
//
// THE SIX WHO ALMOST GOT LOST. The live client list is 257 people; six more had left Lenus but
// still held 175 food entries here. A delete-and-replace scoped to the live list would have wiped
// them with no error and no trace. They were swept separately and merged in, which is why the
// capture covers 263.
//
// GOALS TOO. Every one of the 257 live clients carries a foodDiaryGoals (kcal and macro targets).
// That is what her coach view compares a day against, and we held none of it.
//
// Run: node scripts/import-lenus-food.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-food.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

// food_log.meal_slot is constrained to these four; Lenus uses the same words.
const SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = { entries: 0, goals: 0, noContact: 0, noDate: 0, slots: {}, sources: {} };

for (const [pid, f] of Object.entries(doc.food || {})) {
  const contactId = byLenus.get(pid);
  if (!contactId) { stat.noContact += (f.entries || []).length; continue; }

  for (const e of f.entries || []) {
    const d = day(e.logDate);
    if (!d) { stat.noDate += 1; continue; }
    const slot = SLOTS.has(String(e.mealType)) ? String(e.mealType) : 'snack';
    stat.slots[slot] = (stat.slots[slot] || 0) + 1;
    stat.sources[e.foodSource || '?'] = (stat.sources[e.foodSource || '?'] || 0) + 1;
    stat.entries += 1;
    const m = e.macros || {};
    statements.push(
      `insert into food_log
         (company_id, contact_id, external_id, logged_at, log_date, source, name, meal_slot,
          amount, kcal, protein_g, carb_g, fat_g)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(e.id)}, ${lit(iso(e.logDate))}, ${lit(d)}, 'lenus',
               ${lit(e.name ? String(e.name).slice(0, 300) : null)}, ${lit(slot)},
               ${lit(Number.isFinite(e.amount) ? e.amount : null)},
               ${lit(Number.isFinite(e.kcal) ? Math.round(e.kcal) : 0)},
               ${lit(Number.isFinite(m.protein) ? m.protein : 0)},
               ${lit(Number.isFinite(m.carbohydrate) ? m.carbohydrate : 0)},
               ${lit(Number.isFinite(m.fat) ? m.fat : 0)})
       on conflict (company_id, external_id) where external_id is not null
       do update set kcal = excluded.kcal, protein_g = excluded.protein_g, carb_g = excluded.carb_g,
                     fat_g = excluded.fat_g, name = excluded.name, meal_slot = excluded.meal_slot;`,
    );
  }

  // Her calorie and macro target for this client. Subset update only: a full-row upsert on
  // client_intake is how migrated intake gets blanked.
  const g = f.goals;
  if (g && Number.isFinite(g.kcal) && g.kcal > 0) {
    stat.goals += 1;
    statements.push(
      `insert into client_intake (company_id, contact_id, calorie_goal_kcal)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(Math.round(g.kcal))})
       on conflict (company_id, contact_id)
       do update set calorie_goal_kcal = coalesce(excluded.calorie_goal_kcal, client_intake.calorie_goal_kcal);`,
    );
  }
}

console.log(`entries ${stat.entries} | calorie goals ${stat.goals}`);
console.log(`meal slots ${JSON.stringify(stat.slots)}`);
console.log(`lenus sources ${JSON.stringify(stat.sources)}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);
if (stat.noDate) console.log(`skipped, no log date: ${stat.noDate}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

// Clear only what this import owns, and only ONCE: rows written by the July import carry no
// external_id, so they cannot be upserted onto and would otherwise sit beside their replacements
// forever. Scoped to source = 'lenus' and a null external_id, so nothing this run writes, and
// nothing a member logs in the app, is touched.
const cleared = sql(
  `with gone as (delete from food_log where company_id = '${COMPANY}' and source = 'lenus' and external_id is null returning 1)
   select count(*)::int as n from gone`,
);
console.log(`cleared ${cleared[0]?.n ?? 0} un-keyed rows from the July import`);

runBatched(sql, 'food', statements, {
  onProgress: (done, total) => {
    if (done % 1500 < 14) console.log(`  ${done}/${total}`);
  },
});
