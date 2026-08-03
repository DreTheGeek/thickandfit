// Render the welcome email to disk so the copy and layout can be reviewed before anything is sent.
//
// Loads the REAL modules rather than restating the copy. An earlier test in this repo mirrored a
// message builder field for field and was stale within the hour, so this strips the two things that
// stop `src/lib/email/welcome.ts` loading under plain node (the `server-only` marker and the
// Supabase import used only by the send path) and imports what is left. If the shipped copy changes,
// this output changes with it.
//
// Usage: node .qa-visual/welcome-email-preview.mjs [outDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'welcome-preview-'));

function stage(srcPath, outName, transform) {
  let src = fs.readFileSync(srcPath, 'utf8');
  src = src.replace(/^\s*import\s+'server-only';\s*$/m, '');
  if (transform) src = transform(src);
  const out = path.join(tmp, outName);
  fs.writeFileSync(out, src);
  return out;
}

// Staged as .ts, not .mjs: node strips TypeScript types from .ts files but treats .mjs as plain JS,
// so a .mjs copy dies on the first `export type`.
stage('src/lib/email/shell.ts', 'shell.ts');

const welcomePath = stage('src/lib/email/welcome.ts', 'welcome.ts', (src) =>
  src
    // The send path pulls in Supabase; the copy builder does not. Cut everything from the sender on.
    .slice(0, src.indexOf('export async function sendWelcomeEmail'))
    .replace(/^\s*import\s+\{\s*createServiceClient\s*\}.*$/m, '')
    .replace(/from '@\/lib\/email\/shell'/, "from './shell.ts'"),
);

const { welcomeEmail } = await import(`file://${welcomePath.replace(/\\/g, '/')}`);

// Rodney's real computed targets. He is the member whose silent first day is why this email exists.
const TARGETS = { calories: 2701, proteinG: 176, carbsG: 322, fatG: 79 };

const outDir = process.argv[2] || '.qa-visual/out';
fs.mkdirSync(outDir, { recursive: true });

const rendered = [];
for (const [locale, first] of [
  ['en', 'Rodney'],
  ['es', 'Maria'],
]) {
  const { subject, html } = welcomeEmail(first, TARGETS, locale);
  const file = path.join(outDir, `welcome-${locale}.html`);
  fs.writeFileSync(file, html);
  rendered.push({ locale, subject, html, file });
  console.log(`${locale}: "${subject}"  -> ${file}  (${html.length} bytes)`);
}

// --- the properties worth asserting rather than eyeballing --------------------------------------
const fails = [];
for (const r of rendered) {
  if (/—/.test(r.html)) fails.push(`${r.locale}: em dash present (brand rule)`);
  // The numbers are the payoff of onboarding. If they are missing the email has no reason to exist.
  for (const n of [TARGETS.calories, TARGETS.proteinG, TARGETS.carbsG, TARGETS.fatG]) {
    if (!r.html.includes(String(n))) fails.push(`${r.locale}: target ${n} missing from the body`);
  }
  // Nothing may claim a coach is doing something on a timeline we cannot keep.
  if (/\b(24 hours|24hrs|tomorrow|mañana|dentro de 24)\b/i.test(r.html)) {
    fails.push(`${r.locale}: promises a delivery time we do not enforce`);
  }
  if (!/logo-email\.png/.test(r.html)) fails.push(`${r.locale}: brand logo missing`);
}
// Both languages must exist, or half the audience gets nothing.
if (rendered.length !== 2) fails.push('not both locales rendered');

console.log('');
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
console.log(`PASS: ${rendered.length} locales rendered, targets present, no em dashes, no unkeepable promise.`);
