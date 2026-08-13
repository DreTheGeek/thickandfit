// Import her per-client tracking goals: 551 targets across 227 clients (migration 0139).
//
// The last gap found by walking every Lenus operation against a destination in this database.
// Everything else had one; TrackingGoalCoachQuery had none, so 551 goals had been captured in July,
// captured again in August, and never stored either time.
//
// These are what her check-in's "Did you hit your step goal?" is asking about. We imported 859
// check-ins full of yes and no answers without the number they were answering to.
//
// Run: node scripts/import-lenus-tracking-goals.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/sweep/lenus-tracking-goals.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = { goals: 0, clients: 0, noContact: 0, types: {}, selfSet: 0 };

for (const [pid, goals] of Object.entries(doc.goals || {})) {
  const contactId = byLenus.get(pid);
  if (!contactId) { stat.noContact += goals.length; continue; }
  stat.clients += 1;
  for (const g of goals) {
    if (!g.type || !Number.isFinite(Number(g.target))) continue;
    stat.goals += 1;
    stat.types[g.type] = (stat.types[g.type] || 0) + 1;
    if (g.createdByClient) stat.selfSet += 1;
    // frequency is CHECKed to daily|weekly; anything else lands null rather than failing the row.
    const freq = ['daily', 'weekly'].includes(String(g.frequency)) ? String(g.frequency) : null;
    statements.push(
      `insert into tracking_goals (company_id, contact_id, external_id, goal_type, target, display_unit, frequency, starts_on, created_by_client, source)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(g.id)}, ${lit(g.type)}, ${lit(Number(g.target))},
               ${lit(g.displayUnit || null)}, ${lit(freq)}, ${lit(day(g.start))}, ${lit(Boolean(g.createdByClient))}, 'lenus')
       on conflict (company_id, external_id) where external_id is not null
       do update set target = excluded.target, display_unit = excluded.display_unit,
                     frequency = excluded.frequency, starts_on = excluded.starts_on,
                     created_by_client = excluded.created_by_client, updated_at = now();`,
    );
  }
}

console.log(`goals ${stat.goals} across ${stat.clients} clients | set by the client herself: ${stat.selfSet}`);
console.log(`types ${JSON.stringify(stat.types)}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'tracking goals', statements, { onProgress: (d, t) => { if (d % 200 < 8) console.log(`  ${d}/${t}`); } });

const after = sql(`select count(*) n, count(distinct contact_id) people from tracking_goals where company_id = '${COMPANY}'`);
console.log(`tracking_goals now ${after[0].n} across ${after[0].people} clients`);
