// Regenerate .planning/FILMING-SHOT-LIST.md from the database.
//
// THE SOURCE SET IS HERS, and getting that wrong is the whole history of this file.
//
// It used to select `where e.is_core`, the 76 movements the 2026-08-03 curation promoted out of an
// imported open-source library. Then her own 371 landed (migration 0116) and the two sets barely
// touch: 76 core, 367 hers, and EXACTLY ONE row in both. So the list we handed her was 75 movements
// she does not own and one she does, while 366 of hers were missing.
//
// She told us, twice, on the 2026-08-06 call: "I noticed that a lot of exercises and the checklist
// were things that I didn't do ... I was hoping to add in the checklist of already what I had in
// Lenus." She was filming against it three times a week.
//
// Blocks come from the NAME, not muscle_group: only 7 of her 367 rows carry one, because her export
// had no taxonomy and 0116 refused to invent it. Her naming is unusually literal ("Banded fire
// hydrants", "Cable Pull Through-hamstrings"), so keyword rules are honest here in a way that
// guessing a muscle group per row would not be. Anything the rules cannot place lands in "Unsorted"
// rather than being quietly filed somewhere plausible.
//
// Usage: node .qa-visual/shot-list.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SQL = `
select
  e.name_en, e.name_es, e.equipment, e.muscle_group,
  (e.lenus_video_key is not null) as has_old_footage,
  (e.filmed_at is not null) as filmed
from exercises e
where e.is_coach_authored and e.archived_at is null
order by e.name_en;
`;

// Ordered by each block's share of her 4,182 real Lenus sessions. First match wins, so the more
// specific patterns are listed first: "hip thrust" must beat the bare "thrust" in "thrusters".
// `S` = an optional space or hyphen. Her naming is inconsistent about both ("Warm-up" vs "warm up",
// "Wallsit" vs "wall sit"), and a first pass using a plain optional space left 42 movements
// unsorted, most of them only because of a hyphen. Spelling is hers too: "Hallow hold" is matched
// deliberately, not corrected, because the row name has to keep matching the database.
const S = '[ -]?';
const rx = (src) => new RegExp(src.split('~').join(S), 'i');

const RULES = [
  ['Glutes and hinge', rx('glute|hip~thrust|bridge|donkey|fire~hydrant|kick~back|rdl|romanian|deadlift|good~morning|hyperextension|pull~through|abduct|clamshell|frog|curtsy|sumo|hip~rotation|lateral~step|step~out|hip~circle')],
  ['Shoulders, chest, triceps', rx('shoulder|delt|press|push~up|chest|fly|flys|flies|tricep|dip|skull|overhead|lateral~raise|front~raise|arnold|upright~row|around~the~world|snatch')],
  ['Back and biceps', rx('row|pull~down|pull~up|pull~apart|chin~up|lat~pull|lats|bicep|curl|face~pull|shrug|superman|reverse~fly|dead~hang')],
  ['Legs', rx('squat|lunge|step~up|leg~press|leg~extension|leg~curl|calf|hack|wall~sit|wallsit|adduct|quad|hamstring|thruster|step~board')],
  ['Core', rx('crunch|plank|abs|core|oblique|russian|sit~up|v~up|heel~tap|toe~touch|leg~raise|leg~lift|dead~bug|bird~dog|mountain~climber|windshield|hollow|hallow|woodchop|pallof|scissor|knee~tuck|march')],
  ['Conditioning', rx('jump|hop|slam|burpee|sprint|run|bike|treadmill|stair|erg|battle|sled|carry|farmer|skater|jack|high~knee|quick~feet|ski|walk|incline')],
  ['Mobility and stretch', rx('stretch|mobility|warm~up|circle|dislocate|cat~cow|thoracic|opener|foam|roll|activation|swing')],
];

function blockFor(name, muscleGroup) {
  // A real muscle_group beats the name rules on the 7 rows that have one.
  if (muscleGroup) {
    const mg = muscleGroup.toLowerCase();
    if (mg === 'glutes') return 'Glutes and hinge';
    if (['quadriceps', 'hamstrings', 'calves', 'abductors', 'adductors'].includes(mg)) return 'Legs';
    if (['lats', 'middle back', 'biceps', 'lower back', 'traps'].includes(mg)) return 'Back and biceps';
    if (['shoulders', 'chest', 'triceps'].includes(mg)) return 'Shoulders, chest, triceps';
    if (mg === 'abdominals') return 'Core';
  }
  for (const [block, re] of RULES) if (re.test(name)) return block;
  return 'Unsorted';
}

const qf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotlist-')), 'q.sql');
fs.writeFileSync(qf, SQL);
const out = execFileSync('node', ['.qa-visual/sql.cjs', `--file=${qf}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
const rows = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));

for (const r of rows) r.block = blockFor(r.name_en, r.muscle_group);
const by = {};
for (const r of rows) (by[r.block] ||= []).push(r);
for (const list of Object.values(by)) {
  list.sort((a, b) => (a.equipment ?? 'zz').localeCompare(b.equipment ?? 'zz') || a.name_en.localeCompare(b.name_en));
}

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
  // Last on purpose, and visible rather than hidden: these are rows the name rules could not place.
  // A movement filed under a wrong block is worse than one she has to eyeball.
  'Unsorted',
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

const filmed = rows.filter((r) => r.filmed).length;
const withOld = rows.filter((r) => r.has_old_footage).length;
const unsorted = (by['Unsorted'] ?? []).length;
const easy = rows.filter((r) => !r.equipment || ['body only', 'bands'].includes(r.equipment)).length;
const today = new Date().toISOString().slice(0, 10);

const L = [
  '# Filming shot list',
  '',
  `Generated from your own library on ${today}. **Do not hand-edit.** Regenerate with:`,
  '',
  '```bash',
  'node .qa-visual/shot-list.mjs',
  '```',
  '',
  `**${rows.length} movements. ${filmed} filmed so far.**`,
  '',
  '## This is your list now, not ours',
  '',
  'The previous version of this document was built from a generic library somebody imported, which is',
  'why you said the checklist had things you do not do. You were right: of the 76 movements on it,',
  '**one** was yours.',
  '',
  `Every movement below is one **you** created and named. Nothing has been added, and the ${rows.length} here are`,
  'exactly what your library holds.',
  '',
  `${withOld} of them already have your old footage, which we have saved off before that account closes. That`,
  'does not mean skip them: it means if you run out of shoot days, those are the ones with something to',
  'fall back on.',
  '',
  '## Order',
  '',
  'Blocks are ordered by their share of the **4,182 real sessions** your clients completed, so stopping',
  'early still covers the work they actually do. Grouping comes from the movement name, because your',
  'export did not carry muscle groups and we would rather show you a name we could not sort than file it',
  'somewhere wrong.',
  '',
  unsorted > 0
    ? `**${unsorted} could not be sorted automatically** and sit in an Unsorted block at the end. Shoot them wherever they fit.`
    : '',
  '',
  '## Ticking things off',
  '',
  'Do it in the app, under Exercises, not on this page. This document cannot remember anything, which is',
  'exactly the problem you hit last time when it reset to 0 percent. The app saves it.',
  '',
  '---',
  '',
];

let n = 0;
for (const b of ORDER) {
  const list = by[b] ?? [];
  if (!list.length) continue;
  L.push(
    `## ${b} (${list.length})`,
    '',
    NOTE[b] ?? '',
    '',
    '| # | done | movement | Spanish | equipment | old footage |',
    '|---|---|---|---|---|---|',
  );
  for (const r of list) {
    n++;
    // Blank rather than "null": an empty cell reads as "we do not know", which is true. Her export
    // carried no equipment for 165 of 367 and no Spanish name for the rows 0116 inserted new.
    const es = r.name_es && r.name_es !== r.name_en ? r.name_es : '';
    const kit = r.equipment ?? '';
    L.push(`| ${n} | ${r.filmed ? '[x]' : '[ ]'} | ${r.name_en} | ${es} | ${kit} | ${r.has_old_footage ? 'yes' : ''} |`);
  }
  L.push('');
}

L.push(
  '---',
  '',
  '## Before booking the shoot',
  '',
  `**${easy} of the ${rows.length} need nothing but a mat and a band.** Most of this shoots in one place.`,
  '',
  'Nothing in your library was deleted to build this list, and nothing will be. Member workout history',
  'points at these rows, so removing one would take her logged sessions with it.',
  '',
  '## Two things only you can answer',
  '',
  '1. **Is anything here retired?** If you have stopped programming a movement, say so and it comes off',
  '   the list instead of sitting unfilmed forever.',
  '2. **Order inside each block is yours.** The blocks come from what your clients actually did. What you',
  '   shoot first inside a block is a call about your setup, not our data.',
  '',
);

fs.writeFileSync('.planning/FILMING-SHOT-LIST.md', L.join('\n'));
console.log(`wrote .planning/FILMING-SHOT-LIST.md: ${n} movements, ${filmed} filmed, ${easy} low-equipment`);
