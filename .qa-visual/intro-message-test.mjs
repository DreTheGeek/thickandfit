// Steph's seeded intro message: check the copy that lands in a member's inbox before she ever
// writes one. Loads the REAL builder (stripping the two imports that stop it loading under plain
// node) rather than restating it, so the copy cannot drift away from what ships.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let src = fs.readFileSync('src/lib/coach/intro-message.ts', 'utf8');
src = src
  .slice(0, src.indexOf('export async function seedIntroMessage'))
  .replace(/^\s*import\s+'server-only';\s*$/m, '')
  .replace(/^\s*import\s+\{\s*createServiceClient\s*\}.*$/m, '')
  // Strip EVERY @/ import, not a named list. The list version broke silently the day
  // getCompanyCoach was added: the test could no longer load the module at all, so the copy it
  // guards went unchecked while the suite looked like it was merely one red line among many.
  .replace(/^\s*import\s+.*from\s+'@\/.*$/gm, '')
  // The body builder is module-private in the real file; expose it for the test only.
  .replace('function body(', 'export function body(');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-'));
const file = path.join(dir, 'intro.ts');
fs.writeFileSync(file, src);
const { body } = await import(`file://${file.replace(/\\/g, '/')}`);

// BOTH TIERS, in both languages. The fourth argument is the tier boundary: false is training-only,
// true is the nutrition tiers. Testing one of them would have left the other variant unchecked while
// the suite still printed PASS, which is how the reply assertion above went stale in the first place.
const CASES = [
  { label: 'training en, named, with goal', locale: 'en', nutrition: false, args: ['Rodney', 'en', { from: 194, to: 174 }, false] },
  { label: 'training es, named, with goal', locale: 'es', nutrition: false, args: ['Maria', 'es', { from: 150, to: 134 }, false] },
  { label: 'training en, NO name, NO goal', locale: 'en', nutrition: false, args: [null, 'en', null, false] },
  { label: 'training es, NO name, NO goal', locale: 'es', nutrition: false, args: [null, 'es', null, false] },
  { label: 'nutrition en, named, with goal', locale: 'en', nutrition: true, args: ['Rodney', 'en', { from: 194, to: 174 }, true] },
  { label: 'nutrition es, named, with goal', locale: 'es', nutrition: true, args: ['Maria', 'es', { from: 150, to: 134 }, true] },
  { label: 'nutrition en, NO name, NO goal', locale: 'en', nutrition: true, args: [null, 'en', null, true] },
  { label: 'nutrition es, NO name, NO goal', locale: 'es', nutrition: true, args: [null, 'es', null, true] },
];

const fails = [];
for (const c of CASES) {
  const text = body(...c.args);
  console.log(`--- ${c.label} ---\n${text}\n`);

  if (/—/.test(text)) fails.push(`${c.label}: em dash (brand rule)`);
  // Brand rule: never name the technology to a member. It is her method, in her voice.
  if (/\bAI\b|\bI\.A\.|\bIA\b/.test(text)) fails.push(`${c.label}: says AI`);
  // A greeting with a dangling comma or double space is the tell that a name slot went empty.
  if (/\s,|,\s*$|\s{2,}/m.test(text.replace(/\n/g, ''))) fails.push(`${c.label}: spacing artifact from an empty slot`);
  if (/undefined|null|NaN/.test(text)) fails.push(`${c.label}: unrendered value leaked into the copy`);
  // It has to invite a reply. That is the entire point of seeding a thread rather than sending mail.
  //
  // Matched on the INTENT, not on one phrasing. The pattern was /message me|escríbeme/ and the
  // training-only variant says "use this chat and tell me", which invites a reply just as plainly
  // and failed anyway. A copy assertion that only accepts the exact words it was written against
  // does not test the requirement, it tests one draft of it.
  if (!/(message me|send it here|use this chat|escríbeme|mándamelo aquí)/i.test(text)) {
    fails.push(`${c.label}: does not invite a reply`);
  }

  // THE TIER BOUNDARY, and the reason this file matters more than a copy check.
  //
  // A training-only member pays for workouts. Telling her to log her food promises a coach reading
  // it, which nobody sold her, and the app cannot un-promise it once it has landed in her inbox.
  const asksForFood = /(logging your food|registrar tu comida|log your food)/i.test(text);
  if (c.nutrition && !asksForFood) fails.push(`${c.label}: nutrition tier is not asked to log food`);
  if (!c.nutrition && asksForFood) {
    fails.push(`${c.label}: TRAINING-ONLY member told to log food (promises a service she did not buy)`);
  }

  // BOTH of these caught real bugs on the first run, and neither was visible from a pass/fail line.
  // The first build joined sentence fragments with '' so the whole message collapsed into one wall
  // of text, and the goal was passed in pre-rendered so "150 to 134 lb" appeared mid-Spanish.
  if (!text.includes('\n\n')) fails.push(`${c.label}: no paragraph breaks, renders as one block`);
  if (c.locale === 'es' && /\bto\b|\bwelcome\b|\byour\b/i.test(text)) {
    fails.push(`${c.label}: English leaked into the Spanish copy`);
  }
}

console.log(fails.length ? 'FAILED:' : `PASS: ${CASES.length} variants clean.`);
for (const f of fails) console.log('  -', f);
process.exit(fails.length ? 1 : 0);
