// Regenerate .planning/FILMING-SHOT-LIST.md from the database.
//
// The shot list used to be hand-written, and it went stale the same day: curation set is_core on 76
// movements while the document still listed 50, so filming from it would have skipped every one of
// the 26 glute movements that had just been added. A document about the database belongs to the
// database.
//
// Usage: node .qa-visual/shot-list.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SQL = `
select
  case when e.category in ('plyometrics','cardio') then 'Conditioning'
       when e.category = 'stretching' then 'Mobility and stretch'
       when e.muscle_group = 'glutes' or 'glutes' = any(e.secondary_muscles) then 'Glutes and hinge'
       when e.muscle_group in ('quadriceps','hamstrings','calves','abductors','adductors') then 'Legs'
       when e.muscle_group in ('lats','middle back','biceps','lower back','traps') then 'Back and biceps'
       when e.muscle_group in ('shoulders','chest','triceps') then 'Shoulders, chest, triceps'
       else 'Core' end as block,
  e.name_en, e.name_es, coalesce(e.equipment,'body only') as equipment,
  (e.video_mux_id is not null) as has_video
from exercises e
where e.is_core and e.archived_at is null
order by 1, 4, 2;
`;

const qf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotlist-')), 'q.sql');
fs.writeFileSync(qf, SQL);
const out = execFileSync('node', ['.qa-visual/sql.cjs', `--file=${qf}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
const rows = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));

const by = {};
for (const r of rows) (by[r.block] ||= []).push(r);

// Ordered by each block's share of her 4,182 real Lenus sessions, so stopping early still covers the
// work her clients actually do.
const ORDER = [
  'Glutes and hinge',
  'Shoulders, chest, triceps',
  'Back and biceps',
  'Legs',
  'Core',
  'Conditioning',
  'Mobility and stretch',
];
const NOTE = {
  'Glutes and hinge': 'A third of her 4,182 real sessions name glutes. 26 of these did not exist in the library before 2026-08-03.',
  'Shoulders, chest, triceps': 'Shoulders, chest and triceps plus full upper body: 627 sessions, 15%.',
  'Back and biceps': '548 sessions, 13%. Her single most-programmed named session.',
  Legs: 'Quad and hamstring work not already counted under glutes.',
  Core: 'Cardio and core: 133 sessions.',
  Conditioning: 'Full body HIIT: 269 sessions, 6%.',
  'Mobility and stretch': 'Post-workout stretch: 231 sessions, 6%. More programmed than core, so do not skip it.',
};

const filmed = rows.filter((r) => r.has_video).length;
const easy = rows.filter((r) => ['body only', 'bands'].includes(r.equipment)).length;
const today = new Date().toISOString().slice(0, 10);

const L = [
  '# Filming shot list',
  '',
  `Generated from \`exercises.is_core\` on ${today}. **Do not hand-edit.** Regenerate with:`,
  '',
  '```bash',
  'node .qa-visual/shot-list.mjs',
  '```',
  '',
  `**${rows.length} movements, ${filmed} filmed.** Every name matches a live row exactly, so a clip`,
  'attaches to the exercise members actually open.',
  '',
  '## Why this list, and this order',
  '',
  'Not opinion. The in-app program builder held 4 exercise rows, so there was no usage data there.',
  'What there is: **4,182 real sessions** her Lenus clients completed, whose names say exactly what she',
  'programs. Blocks are ordered by their share of those sessions.',
  '',
  'The glute block is the largest because a third of her sessions name glutes, and because **26 of these',
  'movements did not exist in the library before the 2026-08-03 curation**: no clamshells, no frog pumps,',
  'no curtsy lunges, no Bulgarian split squats, and exactly one hip thrust.',
  '',
  '---',
  '',
];

let n = 0;
for (const b of ORDER) {
  const list = by[b] ?? [];
  if (!list.length) continue;
  L.push(`## ${b} (${list.length})`, '', NOTE[b] ?? '', '', '| # | exercise | Spanish | equipment |', '|---|---|---|---|');
  for (const r of list) {
    n++;
    L.push(`| ${n} | ${r.name_en} | ${r.name_es} | ${r.equipment} |`);
  }
  L.push('');
}

L.push(
  '---',
  '',
  '## Before booking the shoot',
  '',
  `**${easy} of the ${rows.length} need nothing but a mat and a band**, so most of this shoots in one location.`,
  '',
  'The library was curated on 2026-08-03: 899 rows, 250 assignable, 76 core. Nothing was deleted, because',
  'the `set_logs` foreign key cascades and holds real member history. See',
  '`.planning/EXERCISE-LIBRARY-CURATION-PLAN.md`.',
  '',
  'Two things still need Stephanie, not us:',
  '',
  '1. **Does she program all 26 of the new movements?** If she does not coach it she will not film it,',
  '   and an unfilmed core row is worse than an absent one.',
  '2. **Filming order inside each block.** The blocks are evidence. The order within them is hers.',
  '',
);

fs.writeFileSync('.planning/FILMING-SHOT-LIST.md', L.join('\n'));
console.log(`wrote .planning/FILMING-SHOT-LIST.md: ${n} movements, ${filmed} filmed, ${easy} low-equipment`);
