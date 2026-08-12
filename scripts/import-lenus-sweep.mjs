// Import the Lenus sweep: new clients, messages, workouts.
//
// Sources, all captured 2026-08-12 from her logged-in session:
//   .capture/sweep/lenus-detail.json   272 profiles, 4,678 workouts, emails, history
//   .capture/sweep/lenus-threads.json  19,862 chat events across 272 threads
//
// The July extract stopped on 3 July. Everything since was missing, and six clients who joined
// after it ran did not exist in our database at all. Check-ins are a separate script
// (import-lenus-checkins.mjs) because they fan out into three tables.
//
// ORDER MATTERS. Contacts first: messages and workouts key on contact_id, so importing them
// before their person exists silently drops every row belonging to the six new clients.
//
// IDEMPOTENT throughout, on (company_id, external_id) for messages and workouts and on lenus_id
// for contacts. Re-run before the 31 August cutoff.
//
// Run: node scripts/import-lenus-sweep.mjs [--apply]

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};
const lit = (v) =>
  v === null || v === undefined || v === '' ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const jlit = (o) => (o == null ? 'null' : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

const detail = JSON.parse(readFileSync('.capture/sweep/lenus-detail.json', 'utf8'));
const threads = JSON.parse(readFileSync('.capture/sweep/lenus-threads.json', 'utf8'));

const contacts = sql(`select id, lenus_id from contacts where company_id = '${COMPANY}' and lenus_id is not null`);
const byLenus = new Map(contacts.map((c) => [c.lenus_id, c.id]));

// --- phase 1: clients who arrived after the July extract ---------------------
// Names come from the live client list, email from InfoSectionQuery, everything else from
// fitnessPackage.profileData. Marked is_legacy like every other Lenus contact, because that is
// what they are: people whose relationship with her started on the old platform.
const nameById = new Map(detail.clients.map((c) => [c.id, c]));
const newContacts = [];
for (const [pid, rec] of Object.entries(detail.detail)) {
  if (byLenus.has(pid)) continue;
  const live = nameById.get(pid);
  const prof = rec.profile || {};
  const full = String(prof.fullName || live?.fullName || '').trim();
  if (!full) continue;
  const parts = full.split(/\s+/);
  const period = prof.clientPeriod || {};
  // "unpaid" is what the existing Lenus rows use for a live subscription; canceled means the
  // period has ended. Guessing a richer lifecycle here would put a status on her screen that no
  // payment record supports.
  const ended = period.endAt && period.endAt < Date.now();
  newContacts.push({
    lenus_id: pid,
    first_name: parts[0],
    last_name: parts.slice(1).join(' ') || null,
    email: rec.info?.email || null,
    language: String(prof.locale || live?.locale || 'en-US').slice(0, 2),
    lifecycle_stage: ended ? 'canceled' : 'unpaid',
  });
}

// --- phase 2: messages -------------------------------------------------------
const msgStatements = [];
const msgStat = { total: 0, skippedNoContact: 0, tracking: 0, withAttachments: 0 };
for (const [pid, events] of Object.entries(threads.threads)) {
  for (const e of events) {
    if (e.__typename !== 'Message') { msgStat.tracking += 1; continue; }
    // Resolved at write time via a subquery on lenus_id rather than the map, so the six contacts
    // created moments earlier in this same run resolve without re-reading the table.
    if (!byLenus.has(pid) && !newContacts.some((c) => c.lenus_id === pid)) { msgStat.skippedNoContact += 1; continue; }
    const atts = (e.attachments || []).map((a) => ({ id: a.id, name: a.name, mimeType: a.mimeType, kind: a.kind, url: a.publicPath }));
    if (atts.length) msgStat.withAttachments += 1;
    msgStat.total += 1;
    msgStatements.push(
      `insert into client_messages (company_id, contact_id, external_id, is_from_coach, sender_name, body, msg_type, sent_at, read_at, has_attachments, attachments, source)
       select ${lit(COMPANY)}, c.id, ${lit(e.id)}, ${lit(!!e.isFromCoach)}, ${lit(e.createdByName || null)}, ${lit(e.body || null)},
              ${lit(e.type || null)}, ${lit(iso(e.createdAt))}, ${lit(iso(e.readAt))}, ${lit(atts.length > 0)}, ${jlit(atts.length ? atts : null)}, 'lenus'
       from contacts c where c.company_id = ${lit(COMPANY)} and c.lenus_id = ${lit(pid)}
       on conflict (company_id, external_id)
       do update set body = excluded.body, read_at = excluded.read_at, has_attachments = excluded.has_attachments, attachments = excluded.attachments;`,
    );
  }
}

// --- phase 3: workouts -------------------------------------------------------
const woStatements = [];
const woStat = { total: 0, skippedNoContact: 0 };
for (const [pid, rec] of Object.entries(detail.detail)) {
  for (const w of rec.workouts || []) {
    if (!byLenus.has(pid) && !newContacts.some((c) => c.lenus_id === pid)) { woStat.skippedNoContact += 1; continue; }
    woStat.total += 1;
    woStatements.push(
      `insert into client_workout_history (company_id, contact_id, external_id, session_name, plan_name, completion_pct, enjoyment, exhaustion, is_client_created, performed_at, source)
       select ${lit(COMPANY)}, c.id, ${lit(w.id)}, ${lit(w.sessionName || null)}, ${lit(w.workoutPlanName || null)},
              ${lit(w.completionPct ?? null)}, ${lit(w.enjoymentScore ?? null)}, ${lit(w.exhaustionScore ?? null)},
              ${lit(!!w.isClientCreated)}, ${lit(iso(w.startAt))}, 'lenus'
       from contacts c where c.company_id = ${lit(COMPANY)} and c.lenus_id = ${lit(pid)}
       on conflict (company_id, external_id)
       do update set completion_pct = excluded.completion_pct, enjoyment = excluded.enjoyment, exhaustion = excluded.exhaustion;`,
    );
  }
}

console.log(`new contacts ${newContacts.length}`);
for (const c of newContacts) console.log(`   ${c.first_name} ${c.last_name || ''} <${c.email || 'no email'}> ${c.lifecycle_stage}`);
console.log(`messages ${msgStat.total} (tracking events ignored ${msgStat.tracking}, with attachments ${msgStat.withAttachments}, no contact ${msgStat.skippedNoContact})`);
console.log(`workouts ${woStat.total} (no contact ${woStat.skippedNoContact})`);

if (!APPLY) {
  console.log(`\nDRY RUN. ${newContacts.length + msgStatements.length + woStatements.length} statements, nothing written. Re-run with --apply.`);
  process.exit(0);
}

const MAX_CHARS = 6000;
function run(label, statements) {
  let done = 0;
  let buf = [];
  let bufLen = 0;
  const flush = () => {
    if (!buf.length) return;
    sql(buf.join('\n'));
    done += buf.length;
    if (done % 500 < buf.length) console.log(`  ${label} ${done}/${statements.length}`);
    buf = [];
    bufLen = 0;
  };
  for (const st of statements) {
    if (bufLen + st.length > MAX_CHARS) {
      flush();
      execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 120)']);
    }
    buf.push(st);
    bufLen += st.length;
  }
  flush();
  console.log(`${label}: applied ${done}`);
}

run(
  'contacts',
  newContacts.map(
    (c) =>
      `insert into contacts (company_id, lenus_id, type, first_name, last_name, email, language, lifecycle_stage, source, is_legacy, legacy_source)
       values (${lit(COMPANY)}, ${lit(c.lenus_id)}, 'client', ${lit(c.first_name)}, ${lit(c.last_name)}, ${lit(c.email)}, ${lit(c.language)}, ${lit(c.lifecycle_stage)}, 'lenus', true, 'lenus')
       on conflict do nothing;`,
  ),
);
run('messages', msgStatements);
run('workouts', woStatements);
