// en.json and es.json must carry the SAME key set. Run: node .qa-visual/i18n-parity-test.mjs
//
// Why a test and not a review: there are over 2,300 leaf keys across the two catalogs. A missing
// Spanish key does not throw, it renders the key path on the page, in front of the half of the
// audience the app exists for, and it is invisible to anyone reading the diff in English.
//
// It also catches the reverse (a Spanish-only key), which is dead weight rather than a bug but is
// the same mistake pointing the other way.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function leafPaths(node, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // Arrays are values, not namespaces: next-intl reads them whole.
    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...leafPaths(value, path));
    else out.push(path);
  }
  return out;
}

function load(locale) {
  return JSON.parse(readFileSync(join(root, 'src', 'messages', `${locale}.json`), 'utf8'));
}

const en = leafPaths(load('en'));
const es = leafPaths(load('es'));
const enSet = new Set(en);
const esSet = new Set(es);

const missingInEs = en.filter((k) => !esSet.has(k)).sort();
const missingInEn = es.filter((k) => !enSet.has(k)).sort();

// A duplicated key is silently collapsed by JSON.parse, so a count mismatch against the parsed set
// is the only signal that the file on disk says something the app never sees.
const dupesEn = en.length - enSet.size;
const dupesEs = es.length - esSet.size;

console.log(`en: ${en.length} keys   es: ${es.length} keys`);

let failed = false;
if (missingInEs.length) {
  failed = true;
  console.error(`\nMISSING FROM es.json (${missingInEs.length}):`);
  for (const k of missingInEs) console.error(`  ${k}`);
}
if (missingInEn.length) {
  failed = true;
  console.error(`\nMISSING FROM en.json (${missingInEn.length}):`);
  for (const k of missingInEn) console.error(`  ${k}`);
}
if (dupesEn || dupesEs) {
  failed = true;
  console.error(`\nDUPLICATE PATHS: en=${dupesEn} es=${dupesEs}`);
}

if (failed) process.exit(1);
console.log('PASS: both catalogs carry identical key sets.');
