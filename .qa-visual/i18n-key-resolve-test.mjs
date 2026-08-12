// Every t('key') referenced in src/ must resolve in BOTH en.json and es.json.
// Run: node .qa-visual/i18n-key-resolve-test.mjs
//
// Why this exists alongside i18n-parity-test.mjs: parity proves the two CATALOGS agree with each
// other. It cannot prove the catalogs agree with the CODE. A page that calls t('saveLabel') against
// a namespace that never got the key renders the literal path "app.coach.settings.saveLabel" in the
// UI, and next-intl does not throw for it on the server. Parity stays green the whole time, because
// the key is equally absent from both files.
//
// It resolves the namespace per translator variable, so `const tApp = useTranslations('app')` and
// `const t = useTranslations('app.coach')` in the same file are checked against different roots.
//
// Dynamic keys (template literals, variables) cannot be resolved statically. They are counted and
// listed under UNVERIFIABLE rather than silently passed, so the number is visible and does not drift.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'src');

function load(locale) {
  return JSON.parse(readFileSync(join(root, 'src', 'messages', `${locale}.json`), 'utf8'));
}

function has(catalog, path) {
  let node = catalog;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, part)) return false;
    node = node[part];
  }
  // A namespace object is not a usable message. t() on it renders nothing useful.
  return typeof node === 'string' || Array.isArray(node) || typeof node === 'number';
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

const en = load('en');
const es = load('es');
const files = walk(srcDir);

// `const t = useTranslations('ns')`, `const t = await getTranslations('ns')`,
// `const t = await getTranslations({ locale, namespace: 'ns' })`
const DECL =
  /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:'([^']*)'|"([^"]*)"|\{[^}]*namespace\s*:\s*'([^']*)'[^}]*\})?\s*\)/g;

const missingEn = [];
const missingEs = [];
const unverifiable = [];
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file).replace(/\\/g, '/');

  const namespaces = new Map();
  for (const m of text.matchAll(DECL)) {
    namespaces.set(m[1], m[2] ?? m[3] ?? m[4] ?? '');
  }
  if (namespaces.size === 0) continue;

  const names = [...namespaces.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/\$/g, '\\$'));
  const call = new RegExp(`\\b(${names.join('|')})(?:\\.(?:rich|raw|markup|has))?\\(\\s*([^)]*?)\\s*[,)]`, 'g');

  for (const m of text.matchAll(call)) {
    const variable = m[1];
    const arg = m[2].trim();
    const ns = namespaces.get(variable);
    const line = text.slice(0, m.index).split('\n').length;

    const literal = /^'([^'\\]*)'$/.exec(arg) ?? /^"([^"\\]*)"$/.exec(arg);
    if (!literal) {
      // A backtick with no interpolation is still a literal.
      const plainTemplate = /^`([^`$\\]*)`$/.exec(arg);
      if (plainTemplate) {
        const path = ns ? `${ns}.${plainTemplate[1]}` : plainTemplate[1];
        checked += 1;
        if (!has(en, path)) missingEn.push(`${rel}:${line}  ${path}`);
        if (!has(es, path)) missingEs.push(`${rel}:${line}  ${path}`);
        continue;
      }
      if (arg === '' || /^[{[]/.test(arg)) continue; // t() with no key, or an options object
      unverifiable.push(`${rel}:${line}  ${variable}(${arg})  [ns: ${ns || '(root)'}]`);
      continue;
    }

    const path = ns ? `${ns}.${literal[1]}` : literal[1];
    checked += 1;
    if (!has(en, path)) missingEn.push(`${rel}:${line}  ${path}`);
    if (!has(es, path)) missingEs.push(`${rel}:${line}  ${path}`);
  }
}

console.log(`checked ${checked} static t() keys across ${files.length} files`);

let failed = false;
if (missingEn.length) {
  failed = true;
  console.error(`\nUNRESOLVED IN en.json (${missingEn.length}):`);
  for (const l of [...new Set(missingEn)].sort()) console.error(`  ${l}`);
}
if (missingEs.length) {
  failed = true;
  console.error(`\nUNRESOLVED IN es.json (${missingEs.length}):`);
  for (const l of [...new Set(missingEs)].sort()) console.error(`  ${l}`);
}
if (unverifiable.length) {
  console.log(`\nUNVERIFIABLE (dynamic key, ${unverifiable.length}) - read these by hand:`);
  for (const l of [...new Set(unverifiable)].sort()) console.log(`  ${l}`);
}

if (failed) process.exit(1);
console.log('\nPASS: every static t() key resolves in both locales.');
