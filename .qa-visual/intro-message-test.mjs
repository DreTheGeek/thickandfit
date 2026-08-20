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

const CASES = [
  { label: 'en, named, with goal', locale: 'en', args: ['Rodney', 'en', { from: 194, to: 174 }] },
  { label: 'es, named, with goal', locale: 'es', args: ['Maria', 'es', { from: 150, to: 134 }] },
  { label: 'en, NO name, NO goal', locale: 'en', args: [null, 'en', null] },
  { label: 'es, NO name, NO goal', locale: 'es', args: [null, 'es', null] },
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
  if (!/(message me|escríbeme)/i.test(text)) fails.push(`${c.label}: does not invite a reply`);

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
