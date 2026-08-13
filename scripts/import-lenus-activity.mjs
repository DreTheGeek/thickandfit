// Import the three remaining per-client datasets from the August sweep:
//   habits    126 tiny habits (if-then pairs) -> public.habits            [0135]
//   intake    her good/bad habit notes and cycle summary -> client_intake [0135]
//   activity  2,659 device-tracked activities -> public.activity_logs     [0136]
//
// Sources: .capture/sweep/lenus-extra.json (habits, cycle, habit preferences) and
// .capture/sweep/lenus-threads.json (activity, which Lenus returns inside the chat thread).
//
// WHAT IS NOT HERE, and why the numbers will not match the raw capture:
//   * 3,865 TrackingActivityLogBundle rows carry only {id, createdAt, count}. No type, no duration,
//     no calories. They are not importable and no re-query fixes that: 2,659 is the honest total.
//   * Lenus returns habit DEFINITIONS with no completion history, so habit_logs stays empty. A
//     missing row there means "not known", not "she never did it".
//   * The cycle capture is a summary (type, typical length) with no day or period logs behind it,
//     so it lands on client_intake rather than cycle_profiles. See 0135's header.
//
// IDEMPOTENT: (company_id, lenus_id) for habits, (company_id, external_id) for activity, and a
// subset UPDATE for client_intake so a partial payload cannot blank the migrated intake beside it.
//
// Run: node scripts/import-lenus-activity.mjs [--apply]

import { readFileSync } from 'node:fs';
import { makeSql, runBatched } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = makeSql();
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
const int = (v) => (Number.isFinite(v) ? Math.round(v) : null);

const extra = JSON.parse(readFileSync('.capture/sweep/lenus-extra.json', 'utf8'));
const threads = JSON.parse(readFileSync('.capture/sweep/lenus-threads.json', 'utf8'));

const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

const statements = [];
const stat = {
  habits: 0, habitCats: {}, intake: 0, cycles: 0, prefs: 0,
  activity: 0, activityTypes: {}, bundles: 0, noContact: 0, noDate: 0,
};

// --- habits ------------------------------------------------------------------
for (const [pid, v] of Object.entries(extra.extra || {})) {
  const contactId = byLenus.get(pid);
  const h = v.habits;
  if (!h) continue;

  for (const t of h.tinyHabitsCoach || []) {
    if (!contactId) { stat.noContact += 1; continue; }
    const behaviour = String(t.behaviour || '').trim();
    if (!behaviour) continue;
    stat.habits += 1;
    stat.habitCats[t.category || '(none)'] = (stat.habitCats[t.category || '(none)'] || 0) + 1;
    statements.push(
      `insert into habits (company_id, contact_id, lenus_id, title, trigger_text, category, source, is_active, sort_order)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(t.id)}, ${lit(behaviour.slice(0, 300))},
               ${lit(t.trigger ? String(t.trigger).trim().slice(0, 300) : null)}, ${lit(t.category || null)}, 'lenus', true, 0)
       on conflict (company_id, lenus_id) where lenus_id is not null
       do update set title = excluded.title, trigger_text = excluded.trigger_text, category = excluded.category;`,
    );
  }

  // Her own words on what is and is not working, plus the cycle summary. ONE update per contact,
  // touching only these columns: a full-row upsert here is how migrated intake gets blanked.
  const prefs = h.fitnessPackage && h.fitnessPackage.profileDataTyped && h.fitnessPackage.profileDataTyped.habitsPreferences;
  const cycle = v.cycle;
  const good = prefs && prefs.goodHabits ? String(prefs.goodHabits).trim() : null;
  const bad = prefs && prefs.badHabits ? String(prefs.badHabits).trim() : null;
  const cType = cycle && ['regular', 'irregular', 'unsure'].includes(cycle.cycleType) ? cycle.cycleType : null;
  const cLen = cycle && Number.isFinite(cycle.cycleLengthDays) && cycle.cycleLengthDays >= 15 && cycle.cycleLengthDays <= 90
    ? Math.round(cycle.cycleLengthDays) : null;

  if (contactId && (good || bad || cType || cLen)) {
    if (good || bad) stat.prefs += 1;
    if (cType || cLen) stat.cycles += 1;
    stat.intake += 1;
    statements.push(
      `insert into client_intake (company_id, contact_id, good_habits, bad_habits, cycle_type, cycle_length_days)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(good)}, ${lit(bad)}, ${lit(cType)}, ${lit(cLen)})
       on conflict (company_id, contact_id) do update set
         good_habits = coalesce(excluded.good_habits, client_intake.good_habits),
         bad_habits = coalesce(excluded.bad_habits, client_intake.bad_habits),
         cycle_type = coalesce(excluded.cycle_type, client_intake.cycle_type),
         cycle_length_days = coalesce(excluded.cycle_length_days, client_intake.cycle_length_days);`,
    );
  }
}

// --- device activity ---------------------------------------------------------
for (const [pid, events] of Object.entries(threads.threads || {})) {
  const contactId = byLenus.get(pid);
  for (const e of events) {
    if (e.__typename === 'TrackingActivityLogBundle') { stat.bundles += 1; continue; }
    if (e.__typename !== 'TrackingActivityLog') continue;
    if (!contactId) { stat.noContact += 1; continue; }
    // trackedAt is when it happened; createdAt is when the phone synced it. Fall back only if the
    // real time is absent, which it never is in this capture.
    const at = iso(e.trackedAt || e.createdAt);
    if (!at) { stat.noDate += 1; continue; }
    const type = String(e.trackingActivityType || 'unknown');
    stat.activity += 1;
    stat.activityTypes[type] = (stat.activityTypes[type] || 0) + 1;
    statements.push(
      `insert into activity_logs
         (company_id, contact_id, external_id, activity_type, custom_name, tracked_at,
          distance_meters, duration_seconds, energy_kcal, rating, comment, source)
       values (${lit(COMPANY)}, ${lit(contactId)}, ${lit(e.id)}, ${lit(type)}, ${lit(e.customActivityName || null)}, ${lit(at)},
               ${lit(int(e.distanceInMeters))}, ${lit(int(e.durationInSeconds))}, ${lit(int(e.energyInCalories))},
               ${lit(Number.isFinite(e.rating) && e.rating >= 1 && e.rating <= 5 ? Math.round(e.rating) : null)},
               ${lit(e.comment || null)}, 'lenus')
       on conflict (company_id, external_id) where external_id is not null
       do update set distance_meters = excluded.distance_meters, duration_seconds = excluded.duration_seconds,
                     energy_kcal = excluded.energy_kcal, comment = excluded.comment;`,
    );
  }
}

const topTypes = Object.entries(stat.activityTypes).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(`habits ${stat.habits} | intake rows touched ${stat.intake} (habit notes ${stat.prefs}, cycle ${stat.cycles})`);
console.log(`habit categories: ${JSON.stringify(stat.habitCats)}`);
console.log(`activity ${stat.activity} | top types ${JSON.stringify(Object.fromEntries(topTypes))}`);
console.log(`bundles skipped (carry no activity detail, not importable): ${stat.bundles}`);
if (stat.noContact) console.log(`skipped, no matching contact: ${stat.noContact}`);
if (stat.noDate) console.log(`skipped, no timestamp: ${stat.noDate}`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${statements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

runBatched(sql, 'activity', statements, {
  onProgress: (done, total) => {
    if (done % 600 < 12) console.log(`  ${done}/${total}`);
  },
});
