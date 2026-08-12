// Every internal link in src/ must point at a route that exists.
// Run: node .qa-visual/dead-link-test.mjs
//
// Why: pages moved between the coach portal and the operator portal. A moved page leaves behind an
// <a href> or a redirect() that still compiles, still typechecks, and still renders a perfectly
// styled link, and the only symptom is a 404 the day someone clicks it. Nothing in the build catches
// this, because in Next.js a route is a directory on disk, not a symbol.
//
// It reads the App Router tree for the real route set (route groups stripped, [param] and
// [...catch] turned into matchers), then every path-shaped string literal in src/. Scanning every
// literal rather than only `href="..."` is deliberate: half the links in this codebase live in nav
// tables as `{ href: '/coach/clients' }`, inside redirect() calls, or inside template literals, and
// an href-only scan reports a confident PASS while never looking at them.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const appDir = join(root, 'src', 'app');

function collectRoutes(dir, segments = [], pages = [], handlers = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith('_') || entry.startsWith('@')) continue;
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      collectRoutes(full, isGroup ? segments : [...segments, entry], pages, handlers);
    } else if (/^page\.(tsx?|jsx?|mdx)$/.test(entry)) {
      pages.push('/' + segments.join('/'));
    } else if (/^route\.(tsx?|jsx?)$/.test(entry)) {
      handlers.push('/' + segments.join('/'));
    }
  }
  return { pages, handlers };
}

const { pages, handlers } = collectRoutes(appDir);
const allRoutes = [...pages, ...handlers].map((r) => (r === '/' ? '/' : r.replace(/\/$/, '')));

function toMatcher(route) {
  const parts = route.split('/').filter(Boolean);
  return (given, prefixOnly) => {
    let i = 0;
    for (const p of parts) {
      if (/^\[?\[?\.\.\..+\]\]?$/.test(p)) return true;
      if (i >= given.length) return prefixOnly; // template tail may supply the rest
      if (!/^\[.+\]$/.test(p) && p !== given[i]) return false;
      i += 1;
    }
    return prefixOnly ? true : i === given.length;
  };
}
const matchers = allRoutes.map((r) => ({ route: r, match: toMatcher(r) }));

function routeExists(path, prefixOnly = false) {
  const clean = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  return matchers.some((m) => m.match(parts, prefixOnly));
}

function publicFileExists(path) {
  const clean = path.split('?')[0].split('#')[0];
  return clean.length > 1 && existsSync(join(root, 'public', clean));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

// Every quoted string that starts with a single slash. Backticks included so template-literal links
// are checked on their static prefix.
const STRING = /(['"`])(\/(?!\/)[^'"`\n]*)\1/g;

// Paths that are not app routes. Each entry is here because it is a real non-route string, not
// because a link was inconvenient to fix.
const NOT_A_ROUTE = [
  /\.(png|jpg|jpeg|svg|webp|ico|json|txt|xml|mp4|webmanifest|css|js|woff2?)$/i,
  /^\/(functions|storage|rest)\//, // Supabase edge / PostgREST paths, not Next routes
  /^\/(customers|checkout\/sessions|subscriptions|prices|products|billing_portal|payment_intents|setup_intents|invoices)\b/, // Stripe REST paths
  /^\/community-media\//, // Supabase Storage bucket prefix
  /:[a-z]/i, // route-shape placeholders like /:id used for telemetry bucketing
  /\s/, // prose in a comment or a label, not a URL
  /\/$/, // a trailing slash means it is a startsWith() prefix, not a destination
];

const files = walk(join(root, 'src'));
const dead = [];
const templatePrefix = [];
let checked = 0;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  // robots.ts and sitemap.ts express crawl PREFIXES, not destinations: "/workout" there covers
  // /workout/[planId] and is correct with no page of its own.
  if (/\/(robots|sitemap)\.ts$/.test(rel)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (const m of text.matchAll(STRING)) {
    const quote = m[1];
    const raw = m[2];
    const line = text.slice(0, m.index).split('\n').length;
    // A path named in a comment is documentation, not navigation.
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? '')) continue;

    // A path-shaped string with no route-ish body (a lone "/", a regex fragment) is noise.
    if (raw === '/' && quote !== '`') continue;
    if (NOT_A_ROUTE.some((re) => re.test(raw))) continue;
    if (/[\\^$*+?()[\]|]/.test(raw)) continue; // regex source, not a URL

    const isTemplate = quote === '`' && raw.includes('${');
    if (isTemplate) {
      const prefix = raw.slice(0, raw.indexOf('${')).replace(/\/+$/, '');
      if (!prefix || prefix === '') continue;
      checked += 1;
      if (routeExists(prefix, true)) continue;
      templatePrefix.push(`${rel}:${line}  ${raw}`);
      continue;
    }
    if (raw.includes('${')) continue;

    checked += 1;
    const probe = raw.replace(/^\/es(?=\/|$)/, '') || '/';
    if (routeExists(probe) || routeExists(raw) || publicFileExists(raw)) continue;
    dead.push(`${rel}:${line}  ${raw}`);
  }
}

console.log(`routes on disk: ${pages.length} pages + ${handlers.length} route handlers`);
console.log(`checked ${checked} path-shaped literals across ${files.length} files`);

let failed = false;
if (dead.length) {
  failed = true;
  console.error(`\nNO SUCH ROUTE (${dead.length}):`);
  for (const l of [...new Set(dead)].sort()) console.error(`  ${l}`);
}
if (templatePrefix.length) {
  failed = true;
  console.error(`\nTEMPLATE PREFIX MATCHES NO ROUTE (${templatePrefix.length}):`);
  for (const l of [...new Set(templatePrefix)].sort()) console.error(`  ${l}`);
}

if (failed) process.exit(1);
console.log('\nPASS: every path-shaped literal in src/ resolves to a route on disk.');
