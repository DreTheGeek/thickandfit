// Import Stephanie's Lenus training templates into plans / sessions / session_exercises.
//
// Source: .capture/programs/lenus-programs.json, captured 2026-08-12 by driving her logged-in
// browser (see the lenus-programs-recovered memory for how to repeat the capture). 40 programs,
// 229 sessions, 1,484 sets, 2,497 exercise instances. The July extract had none of this.
//
// IDEMPOTENT on lenus_id (0127). Re-running updates in place rather than duplicating, which matters
// because this will run again after any further sweep before the 31 August cutoff.
//
// Run: node scripts/import-lenus-programs.mjs [--apply]
// Without --apply it reports what it WOULD do and writes nothing.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const SRC = '.capture/programs/lenus-programs.json';
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = (q) => {
  const out = execFileSync('node', ['.qa-visual/sql.cjs', q], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed && parsed.message) throw new Error(parsed.message);
  return parsed;
};
const lit = (v) =>
  v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

// --- exercise resolution ----------------------------------------------------
// Her programs name 365 distinct exercises; our library holds 367 coach-authored rows that came
// from the same Lenus library, so this should be close to total. Match on a normalised name:
// case, punctuation and whitespace differ between the two exports for the same movement.
// Plural-insensitive per word: her library says "Leg Extension" and ours says "Leg Extensions",
// and the same singular/plural split hits Curl(s), Squat(s) and Raise(s). Stripping a trailing s
// per word is crude and safe here because both vocabularies are gym English, where the plural never
// changes which movement is meant.
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');

// HER OWN MOVEMENTS FIRST, then the shared library. The first version matched only
// is_coach_authored and missed 168 rows across 59 names: Leg Extension, Push Up, Plank, Band Pull
// Apart. Those are stock movements she uses inside her own programming, and they live in the wider
// catalogue, so restricting the join to her authored rows threw away real prescriptions. Priority
// still matters: where a name exists in both, hers wins, because hers carries her cues and demo.
const mine = sql(`select id, name_en from exercises where is_coach_authored`);
const all = sql(`select id, name_en from exercises where not is_coach_authored`);
const byName = new Map();
for (const r of all) if (!byName.has(norm(r.name_en))) byName.set(norm(r.name_en), r.id);
for (const r of mine) byName.set(norm(r.name_en), r.id);

// --- prescription mapping ---------------------------------------------------
// Lenus states every prescription as { type, range:{lower,upper} }. She programs entirely in
// ranges: 2,355 of her 2,497 exercise rows have lower != upper and NONE are fixed. That is why
// 0126 added reps_min/reps_max, and why `reps` here carries the lower bound as the single target
// the player prefills, which is what "add a rep toward the top of your range" is measured from.
function prescribe(ex) {
  const t = ex.reps?.type ?? null;
  const lo = ex.reps?.range?.lower ?? null;
  const hi = ex.reps?.range?.upper ?? null;
  const out = { reps: null, reps_min: null, reps_max: null, time_sec: null, is_amrap: false, extra: null };

  if (t === 'repetition') {
    out.reps = lo;
    out.reps_min = lo;
    out.reps_max = hi;
  } else if (t === 'minute') {
    // Duration, not reps. Stored in seconds because that is the column's unit, and the lower bound
    // is the prescription; the upper is carried in the note so the range is not silently lost.
    out.time_sec = lo != null ? Math.round(lo * 60) : null;
    if (hi != null && hi !== lo) out.extra = `${lo}-${hi} min`;
  } else if (t === 'second') {
    out.time_sec = lo;
    if (hi != null && hi !== lo) out.extra = `${lo}-${hi} sec`;
  } else if (t === 'max') {
    // A real prescription, not a missing value, which is exactly why is_amrap is its own column.
    out.is_amrap = true;
  } else if (t === 'kilometer' || t === 'kcal') {
    // No column for distance or calories, and inventing one for 18 rows across the whole library
    // would be the wrong trade. Carried as text so the instruction still reaches the member.
    out.extra = hi != null && hi !== lo ? `${lo}-${hi} ${t}` : `${lo} ${t}`;
  }
  return out;
}

// --- walk -------------------------------------------------------------------
// CREATE WHAT IS MISSING rather than drop it. 46 movements she programs are absent from our
// catalogue entirely (plain Push Up, Close Grip Bench Press, Running). Skipping them would silently
// remove 111 real prescriptions from her programs, which is a worse outcome than a catalogue row
// with no cues yet: the prescription is hers, the demo can follow. Marked NOT coach-authored, since
// these are stock movements, so her filming list and the Spanish desk are unaffected.
const doc0 = JSON.parse(readFileSync(SRC, 'utf8'));
if (APPLY) {
  const need = new Map();
  for (const P of doc0.programs) for (const I of (P.latestVersion?.items || [])) for (const W of (I.workoutSessionSets || [])) for (const E of (W.exercises || [])) {
    const n = E.exercise?.name;
    if (n && !byName.has(norm(n))) need.set(norm(n), String(n).trim());
  }
  for (const [k, nm] of need) {
    sql(`insert into exercises (name_en, is_coach_authored) values (${lit(nm)}, false) returning id`);
    const back = sql(`select id from exercises where name_en = ${lit(nm)} limit 1`);
    if (back[0]) byName.set(k, back[0].id);
  }
  console.log(`created ${need.size} missing exercises`);
}
const doc = doc0;
let planN = 0, sessionN = 0, exN = 0, unmatched = new Map(), amrap = 0, supersets = 0;
const statements = [];

for (const p of doc.programs) {
  const v = p.latestVersion;
  if (!v) continue;
  const name = (v.name || p.name || 'Untitled').trim();
  planN += 1;

  statements.push(
    `insert into plans (company_id, lenus_id, name_en, weeks, is_template) values (${lit(COMPANY)}, ${lit(p.id)}, ${lit(name)}, 12, true)
     on conflict (company_id, lenus_id) where lenus_id is not null
     do update set name_en = excluded.name_en;`,
  );

  (v.items || []).forEach((s, si) => {
    sessionN += 1;
    statements.push(
      `insert into sessions (company_id, lenus_id, plan_id, day_label, sort_order)
       select ${lit(COMPANY)}, ${lit(s.id)}, p.id, ${lit((s.name || `Day ${si + 1}`).trim())}, ${si}
       from plans p where p.company_id = ${lit(COMPANY)} and p.lenus_id = ${lit(p.id)}
       on conflict (company_id, lenus_id) where lenus_id is not null
       do update set day_label = excluded.day_label, sort_order = excluded.sort_order;`,
    );

    let order = 0;
    for (const ws of s.workoutSessionSets || []) {
      const isGroup = ws.type === 'superset' && (ws.exercises || []).length > 1;
      if (isGroup) supersets += 1;
      for (const ex of ws.exercises || []) {
        const exName = ex.exercise?.name;
        const id = byName.get(norm(exName));
        if (!id) {
          unmatched.set(exName, (unmatched.get(exName) || 0) + 1);
          continue;
        }
        const pr = prescribe(ex);
        if (pr.is_amrap) amrap += 1;
        const noteParts = [ex.note, ws.note, pr.extra].filter(Boolean);
        const note = noteParts.length ? [...new Set(noteParts)].join(' · ').slice(0, 2000) : null;
        const weight = ex.weight?.range?.lower ?? null;
        exN += 1;
        statements.push(
          `insert into session_exercises
             (company_id, session_id, exercise_id, sets, reps, reps_min, reps_max, time_sec, weight,
              rest_sec, rounds, notes, group_key, group_kind, is_amrap, sort_order)
           select ${lit(COMPANY)}, se.id, ${lit(id)}, ${lit(ws.rounds ?? 1)}, ${lit(pr.reps)}, ${lit(pr.reps_min)},
                  ${lit(pr.reps_max)}, ${lit(pr.time_sec)}, ${lit(weight)},
                  ${lit(ex.restTime ?? ws.restTime ?? null)}, ${lit(ws.rounds ?? null)}, ${lit(note)},
                  ${isGroup ? lit(ws.id) : 'null'}, ${isGroup ? lit('superset') : 'null'}, ${pr.is_amrap},
                  ${order}
           from sessions se where se.company_id = ${lit(COMPANY)} and se.lenus_id = ${lit(s.id)};`,
        );
        order += 1;
      }
    }
  });
}

const missTotal = [...unmatched.values()].reduce((a, b) => a + b, 0);
console.log(`plans ${planN} | sessions ${sessionN} | exercises ${exN} | supersets ${supersets} | amrap ${amrap}`);
console.log(`unmatched exercise names: ${unmatched.size} distinct, ${missTotal} rows`);
if (unmatched.size) {
  console.log([...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, c]) => `   ${c}x  ${n}`).join('\n'));
}

if (!APPLY) {
  console.log('\nDRY RUN. Nothing written. Re-run with --apply.');
  process.exit(0);
}

// Clear only what this import owns, so a re-run cannot leave orphaned exercises behind from a
// previous mapping. Scoped to sessions that carry a lenus_id: anything she builds natively is
// untouched.
sql(`delete from session_exercises where session_id in (select id from sessions where company_id = ${lit(COMPANY)} and lenus_id is not null)`);

// BATCHED. One HTTP call per statement rate-limited the Management API at about 800 of 2,766
// (ThrottlerException). Statements are independent inserts, so they batch cleanly, and 2,766 calls
// was always the wrong shape for a bulk import.
// Batched by CHARACTER budget, not statement count. One call per statement rate-limited the
// Management API at ~800 of 2,766; a 120-statement batch then blew the OS argument limit
// (ENAMETOOLONG), since the query travels as an argv entry. ~6 KB per call clears both, and the
// small pause keeps the throttler happy for the whole run.
const MAX_CHARS = 6000;
let done = 0;
let buf = [];
let bufLen = 0;
const flush = () => {
  if (!buf.length) return;
  sql(buf.join('\n'));
  done += buf.length;
  console.log(`  ${done}/${statements.length}`);
  buf = [];
  bufLen = 0;
};
for (const st of statements) {
  if (bufLen + st.length > MAX_CHARS) {
    flush();
    // A beat between calls. The throttler is per-window, and the whole run is ~500 calls.
    execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 200)']);
  }
  buf.push(st);
  bufLen += st.length;
}
flush();
console.log(`applied ${done} statements`);
