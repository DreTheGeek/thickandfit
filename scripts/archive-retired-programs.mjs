// Archive the programs Stephanie retired on the 2026-08-13 call.
//
// Her words, going through the library: "we can delete them, I don't even train the same" about the
// 6-week programs, and "the membership, I'm not even going to have those anymore". Keep: the 12-week
// programs ("the most updated"), the Hurricane Challenge ("the challenge ones can stay"), and
// Shalisa's plan ("that's our, we make everything from her").
//
// ARCHIVE, NOT DELETE, and this is a deliberate deviation from what she said. plan_assignments
// references these rows and clients are mid-program on some of them; a hard delete either cascades
// their programming away or fails on the constraint, and the version that "works" is the one that
// silently strips a paying woman of the plan she is training this week. Archiving takes them out of
// her picker, which is the thing she actually asked for, and keeps every existing assignment intact.
// Un-archiving is one UPDATE if she disagrees. Un-deleting is nothing.
//
// SHE CONFIRMS THE LIST, not the pattern. The dry run prints every plan it would touch, by name,
// with how many clients are currently assigned to it. A verbal instruction in a 45-minute call is
// not a mandate to guess at 17 names, so nothing is written until a human reads that output.
//
// Run: node scripts/archive-retired-programs.mjs           (dry run, writes nothing)
//      node scripts/archive-retired-programs.mjs --apply
//      node scripts/archive-retired-programs.mjs --unarchive --apply    (undo)

import { makeSql } from './lib/mgmt-sql.mjs';

const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--unarchive');
const COMPANY = 'c0ffee00-0000-4000-8000-000000000001';

const sql = makeSql();

// Matched against name_en, case-insensitively. Deliberately NARROW: a pattern that is too greedy
// hides a program she still uses, and the failure is invisible until she goes looking for it.
const RETIRE = [
  { label: '6-week programs', test: (n) => /\b6\s*week/i.test(n) },
  { label: 'membership programs', test: (n) => /\bmembership\b/i.test(n) },
];

// Explicit survivors, checked AFTER the patterns above. Belt and braces: if a plan is somehow named
// "6 Week Hurricane Challenge", the keep list wins, because the cost of over-keeping is clutter and
// the cost of over-archiving is a plan she wanted.
const KEEP = [/hurricane/i, /shalisa/i, /shaleesa/i];

const plans = sql(
  `select p.id, p.name_en, p.weeks, p.archived_at,
          (select count(*) from plan_assignments a where a.plan_id = p.id) as assigned
   from plans p
   where p.company_id = '${COMPANY}'
   order by p.name_en`,
);

const matched = [];
for (const p of plans) {
  const name = p.name_en ?? '';
  if (KEEP.some((k) => k.test(name))) continue;
  const rule = RETIRE.find((r) => r.test(name));
  if (!rule) continue;
  matched.push({ ...p, rule: rule.label });
}

const target = UNDO
  ? matched.filter((p) => p.archived_at !== null)
  : matched.filter((p) => p.archived_at === null);

console.log(`${plans.length} programs in the library, ${matched.length} match the retire rules.\n`);

if (matched.length === 0) {
  console.log('Nothing matched. Check the rules against her real plan names before assuming this is right.');
  process.exit(0);
}

// Grouped by rule so she can sanity-check a whole category at a glance rather than 17 rows.
for (const rule of RETIRE) {
  const rows = matched.filter((p) => p.rule === rule.label);
  if (rows.length === 0) continue;
  console.log(`${rule.label} (${rows.length}):`);
  for (const p of rows) {
    const flags = [
      p.archived_at ? 'already archived' : null,
      // THE NUMBER THAT MATTERS. A plan with live assignments is one somebody is training right
      // now; archiving does not disturb her, but Stephanie should see it before saying yes.
      Number(p.assigned) > 0 ? `${p.assigned} client${Number(p.assigned) === 1 ? '' : 's'} assigned` : null,
    ].filter(Boolean);
    console.log(`   ${p.name_en}  (${p.weeks}w)${flags.length ? `  [${flags.join(', ')}]` : ''}`);
  }
  console.log('');
}

const kept = plans.filter((p) => KEEP.some((k) => k.test(p.name_en ?? '')));
if (kept.length) {
  console.log(`kept by name (${kept.length}): ${kept.map((p) => p.name_en).join(', ')}\n`);
}

const stillLive = plans.length - matched.length;
console.log(`Library after this: ${stillLive} programs.\n`);

if (!APPLY) {
  console.log(
    `DRY RUN. ${target.length} would be ${UNDO ? 'un-archived' : 'archived'}, nothing written.\n` +
      'Read the list above WITH Stephanie, then re-run with --apply.',
  );
  process.exit(0);
}

if (target.length === 0) {
  console.log('Nothing to change.');
  process.exit(0);
}

const ids = target.map((p) => `'${p.id}'`).join(', ');
sql(
  `update plans set archived_at = ${UNDO ? 'null' : 'now()'}
   where company_id = '${COMPANY}' and id in (${ids})`,
);
console.log(`${UNDO ? 'Un-archived' : 'Archived'} ${target.length} programs.`);
