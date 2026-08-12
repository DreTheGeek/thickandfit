// Promote Lenus check-in bodies out of lenus.raw_client_extract into form_responses, which is where
// her coach portal actually reads them from.
//
// WHY THIS IS SEPARATE FROM THE SWEEP. Raw capture first, mapping second: the network pass against
// an account that dies on 31 August cannot be repeated, turning JSON into rows can be redone any
// evening. Same doctrine as scripts/import-lenus-programs.mjs.
//
// WHAT IT DEPENDS ON. scripts/lenus-export.js must have run AFTER the 2026-08-12 fix. Before that
// fix the check-in fan-out sent a profile id where a check-in response id belonged, so
// ClientCheckinDashboardView_checkInResponse stored nothing for anybody. If this script reports
// "0 bodies found", the sweep has not been re-run, not that the mapping is broken.
//
// THE ONE THING HERE THAT IS NOT VERIFIED. Every structural piece below is checked against the live
// schema: the lenus_profile_id join, the answers-keyed-by-field-id contract that
// src/lib/coach/client-checkin.ts reads, the check_in form type. The ANSWER EXTRACTION is not,
// because no check-in body had ever been fetched when this was written, so its shape has never been
// observed. extractAnswers() below is therefore written to RECOGNISE rather than assume, and to
// refuse rather than guess. Run without --apply first and read what it says it found.
//
// Usage:
//   node scripts/import-lenus-checkins.mjs                 dry run: report only, writes nothing
//   node scripts/import-lenus-checkins.mjs --shape         print one body's keys, no values
//   node scripts/import-lenus-checkins.mjs --apply         write
//   node scripts/import-lenus-checkins.mjs --apply --limit 5   write a handful first
//
// IDEMPOTENT with no migration. form_responses has no natural key for an imported row and
// supabase/migrations/ is a protected path, so the row id is derived deterministically from the
// Lenus check-in response id (uuidFor below). Re-running updates in place instead of duplicating.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const SHAPE = argv.includes('--shape');
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? Number(argv[i + 1]) : Infinity;
})();

const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';
const OP = 'ClientCheckinDashboardView_checkInResponse';

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};
const lit = (v) =>
  v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const jsonLit = (v) => `${lit(JSON.stringify(v))}::jsonb`;

// Deterministic UUID from a stable source string. Formatted as a v5 UUID (version nibble 5, RFC
// variant bits) so it is a legal uuid and cannot collide with gen_random_uuid()'s v4 output.
export function uuidFor(source) {
  const h = createHash('sha256').update(`lenus:checkin:${source}`).digest('hex');
  const v = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  return v;
}

// --- answer extraction, the unverified part ---------------------------------
// Recognises a question/answer pair by SHAPE, because the field names are unknown. Anything with a
// question-ish key and an answer-ish key counts. Returns [] when it recognises nothing, and the
// caller treats [] as "do not write", never as "an empty check-in".
const Q_KEYS = ['question', 'questionText', 'label', 'title', 'name', 'prompt', 'text'];
const A_KEYS = ['answer', 'answerText', 'value', 'response', 'reply', 'content'];

export function extractAnswers(body) {
  const found = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const keys = Object.keys(n);
    const qKey = Q_KEYS.find((k) => keys.includes(k) && typeof n[k] === 'string' && n[k].trim());
    const aKey = A_KEYS.find((k) => keys.includes(k) && n[k] !== null && n[k] !== undefined && n[k] !== '');
    if (qKey && aKey) found.push({ question: String(n[qKey]).trim(), answer: n[aKey] });
    Object.values(n).forEach(walk);
  };
  walk(body);
  // De-duplicate on the question: a nested payload can surface the same pair at two depths.
  const seen = new Set();
  return found.filter((f) => (seen.has(f.question) ? false : seen.add(f.question)));
}

// The first timestamp that looks like a submission. Falls back to null rather than now(), because a
// check-in dated today that actually happened in May is worse than one with no date.
export function extractSubmittedAt(body) {
  let best = null;
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (/^(submitted|created|completed|answered)(_?at)$|^date$/i.test(k) && typeof v === 'string') {
        if (!best || v > best) best = v;
      }
    }
    Object.values(n).forEach(walk);
  };
  walk(body);
  return best;
}

export function extractId(body) {
  let id = null;
  const walk = (n) => {
    if (id || !n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== 'object') return;
    if (typeof n.id === 'string' && n.id.length >= 8) { id = n.id; return; }
    Object.values(n).forEach(walk);
  };
  walk(body);
  return id;
}

// Conservative on type. form_fields.type drives how client-checkin.ts renders the value, and a wrong
// type actively corrupts the display (a 'rating' renders "x/5" whatever the value is), while 'text'
// always renders the raw answer. So: text, or multiline when it is long enough to need the room.
// Retyping a field by hand later is a one-row update; un-garbling a rendered answer is not.
export const typeFor = (answer) => (typeof answer === 'string' && answer.length > 120 ? 'multiline' : 'text');
export const asText = (a) => (a === null || a === undefined ? '' : typeof a === 'string' ? a : JSON.stringify(a));

function main() {
  // --- load -------------------------------------------------------------------
  console.log(APPLY ? 'APPLY: writing.\n' : 'DRY RUN: nothing is written. Add --apply once the numbers look right.\n');

  const holders = sql(`
    select profile_id, full_name
    from lenus.raw_client_extract
    where operation = ${lit(OP)}
    order by profile_id
  `);

  if (!holders.length) {
    console.log(`No ${OP} rows in lenus.raw_client_extract.`);
    console.log('The sweep has not been re-run since the 2026-08-12 fan-out fix. Run the sweep first:');
    console.log('  1. node .qa-visual/lenus-export-test.mjs');
    console.log('  2. paste scripts/lenus-export.js into her logged-in us.lenus.io tab, lenusExport.start()');
    console.log('  3. node scripts/lenus-verify.mjs --checkins');
    process.exit(0);
  }
  console.log(`${holders.length} clients carry check-in bodies.`);

  if (SHAPE) {
    const one = sql(`select data from lenus.raw_client_extract where operation = ${lit(OP)} order by pg_column_size(data) desc limit 1`);
    const keysOnly = (node, d = 0) => {
      if (d > 8) return '...';
      if (Array.isArray(node)) return node.length ? [keysOnly(node[0], d + 1), `+${node.length - 1} more`] : [];
      if (node && typeof node === 'object') {
        const o = {};
        for (const [k, v] of Object.entries(node)) o[k] = keysOnly(v, d + 1);
        return o;
      }
      return typeof node;
    };
    console.log('\nkeys and types only, no values:\n');
    console.log(JSON.stringify(keysOnly(one[0]?.data), null, 2));
    process.exit(0);
  }

  // Lenus profile id -> our profile. A client who has not been created in our system yet simply has no
  // row, and is reported rather than skipped silently.
  const profiles = sql(`select id, lenus_profile_id from profiles where lenus_profile_id is not null`);
  const byLenusId = new Map(profiles.map((p) => [p.lenus_profile_id, p.id]));
  console.log(`${byLenusId.size} of our profiles carry a lenus_profile_id.\n`);

  // --- the form ---------------------------------------------------------------
  // One check-in form for the imported history. Her live check-in form is a separate thing she edits;
  // mixing imported Lenus questions into it would rewrite a form she is actively using.
  const TITLE = 'Check-in (imported from Lenus)';
  let form = sql(`select id, version from forms where company_id = ${lit(COMPANY)} and title_en = ${lit(TITLE)} limit 1`)[0];
  if (!form) {
    if (APPLY) {
      sql(`insert into forms (company_id, title_en, title_es, type, status)
           values (${lit(COMPANY)}, ${lit(TITLE)}, ${lit('Check-in (importado de Lenus)')}, 'check_in', 'published')`);
      form = sql(`select id, version from forms where company_id = ${lit(COMPANY)} and title_en = ${lit(TITLE)} limit 1`)[0];
      console.log(`created form ${form.id}`);
    } else {
      console.log(`would create form "${TITLE}" (type check_in, published)`);
    }
  }

  const fieldByLabel = new Map();
  if (form) {
    for (const f of sql(`select id, label_en from form_fields where form_id = ${lit(form.id)}`)) {
      fieldByLabel.set(f.label_en, f.id);
    }
  }

  // --- walk the clients --------------------------------------------------------
  let bodiesSeen = 0;
  let unrecognised = 0;
  let noProfile = 0;
  let written = 0;
  const newQuestions = new Set();
  const samples = [];
  let processed = 0;

  for (const h of holders) {
    if (processed >= LIMIT) break;
    processed++;

    const row = sql(`
      select data from lenus.raw_client_extract
      where operation = ${lit(OP)} and profile_id = ${lit(h.profile_id)}
      limit 1
    `)[0];
    if (!row) continue;

    // The fixed extractor stores an ARRAY of bodies. A single object is tolerated in case a future
    // capture stores one.
    const bodies = Array.isArray(row.data) ? row.data : [row.data];
    const profileId = byLenusId.get(h.profile_id) ?? null;
    if (!profileId) noProfile++;

    for (const body of bodies) {
      bodiesSeen++;
      const pairs = extractAnswers(body);
      if (!pairs.length) {
        unrecognised++;
        continue;
      }
      if (samples.length < 3) samples.push({ who: h.full_name, pairs: pairs.slice(0, 4) });
      for (const p of pairs) if (!fieldByLabel.has(p.question)) newQuestions.add(p.question);

      if (!APPLY || !profileId || !form) continue;

      // Create any field this question needs, once, and reuse its id from then on. The answers object
      // is keyed by field id: that is the contract client-checkin.ts reads.
      const answers = {};
      for (const p of pairs) {
        let fieldId = fieldByLabel.get(p.question);
        if (!fieldId) {
          sql(`insert into form_fields (company_id, form_id, type, label_en, sort_order)
               values (${lit(COMPANY)}, ${lit(form.id)}, ${lit(typeFor(p.answer))}, ${lit(p.question)}, ${fieldByLabel.size})`);
          fieldId = sql(`select id from form_fields where form_id = ${lit(form.id)} and label_en = ${lit(p.question)} limit 1`)[0]?.id;
          if (!fieldId) continue;
          fieldByLabel.set(p.question, fieldId);
        }
        answers[fieldId] = asText(p.answer);
      }

      const lenusResponseId = extractId(body);
      if (!lenusResponseId) { unrecognised++; continue; }
      const submittedAt = extractSubmittedAt(body);

      sql(`
        insert into form_responses (id, company_id, form_id, profile_id, answers, form_version, submitted_at)
        values (${lit(uuidFor(lenusResponseId))}, ${lit(COMPANY)}, ${lit(form.id)}, ${lit(profileId)},
                ${jsonLit(answers)}, ${form.version ?? 1},
                ${submittedAt ? lit(submittedAt) : 'now()'})
        on conflict (id) do update set answers = excluded.answers, submitted_at = excluded.submitted_at
      `);
      written++;
    }
  }

  // --- report -------------------------------------------------------------------
  console.log(`\nclients processed   ${processed}`);
  console.log(`bodies seen         ${bodiesSeen}`);
  console.log(`unrecognised        ${unrecognised}${unrecognised ? '   <-- extractAnswers did not find a question/answer pair' : ''}`);
  console.log(`no local profile    ${noProfile}${noProfile ? '   <-- these clients have no profiles.lenus_profile_id yet' : ''}`);
  console.log(`distinct questions  ${fieldByLabel.size + newQuestions.size}${newQuestions.size ? ` (${newQuestions.size} new)` : ''}`);
  console.log(APPLY ? `responses written   ${written}` : 'responses written   0 (dry run)');

  if (samples.length) {
    console.log('\nwhat it recognised, first few:');
    for (const s of samples) {
      console.log(`  ${s.who}`);
      for (const p of s.pairs) console.log(`    ${p.question}  ->  ${asText(p.answer).slice(0, 60)}`);
    }
  }

  if (bodiesSeen && unrecognised === bodiesSeen) {
    console.log('\nEVERY body was unrecognised, so nothing was written. That means the payload does not use');
    console.log('any of the question/answer key names guessed in Q_KEYS / A_KEYS. Run --shape, read the');
    console.log('real key names off it, and add them to those two lists. This is the one part of this');
    console.log('script that was written before a single body had ever been fetched.');
    process.exit(1);
  }
  if (!APPLY && bodiesSeen) {
    console.log('\nNumbers look right? Re-run with --apply. Start with --apply --limit 5.');
  }

}

// Run only when invoked directly, so the test can import the extractors without touching the DB.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
