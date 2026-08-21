#!/usr/bin/env node
/**
 * The sidebar collapsed 26 rows into 16 by turning ten screens into TABS on the row of the group
 * they belong to. Two things can go wrong and neither throws:
 *
 *   1. A screen falls off the map entirely. It has no sidebar row any more, so if it is also not a
 *      tab in any group it is reachable only by typing the URL. That is how a working feature
 *      becomes invisible.
 *   2. The sidebar highlights nothing (or the wrong row) while you are standing on a tab, which
 *      reads as having navigated off the console.
 *
 *   node .qa-visual/coach-nav-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const nav = readFileSync('src/components/nav/coach-nav.tsx', 'utf8');
const tabs = readFileSync('src/lib/coach/section-tabs.ts', 'utf8');

const fails = [];

const navHrefs = [...nav.matchAll(/href: '(\/coach[^']*)'/g)].map((m) => m[1]);
const groupHrefs = [...nav.matchAll(/'(\/coach[^']*)'(?=[,\]])/g)].map((m) => m[1]);
const tabHrefs = [...tabs.matchAll(/href: '(\/coach[^']*)'/g)].map((m) => m[1]);

// 1. Every screen a tab points at must exist on disk.
for (const href of new Set(tabHrefs)) {
  const file = `src/app/(app)${href}/page.tsx`;
  if (!existsSync(file)) fails.push(`tab points at a screen that does not exist: ${href}`);
}

// 2. Every screen a sidebar row points at must exist.
for (const href of new Set(navHrefs)) {
  const file = `src/app/(app)${href}/page.tsx`;
  if (!existsSync(file)) fails.push(`sidebar row points at a screen that does not exist: ${href}`);
}

// 3. Every tab href must be covered by a GROUPS entry, or standing on it highlights nothing.
const covered = new Set(groupHrefs);
for (const href of new Set(tabHrefs)) {
  if (!covered.has(href)) fails.push(`tab '${href}' is in no GROUPS entry: the sidebar goes blank on it`);
}

// 4. Every GROUPS member must actually be a tab somewhere, or the map lies about where you are.
const asTab = new Set(tabHrefs);
const groupsBlock = nav.slice(nav.indexOf('const GROUPS'), nav.indexOf('function matches'));
for (const m of groupsBlock.matchAll(/'(\/coach[^']*)'/g)) {
  const href = m[1];
  if (!asTab.has(href)) fails.push(`GROUPS lists '${href}' but no tab row offers it`);
}

if (fails.length) {
  console.error(`FAIL (${fails.length})`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`OK: ${new Set(navHrefs).size} sidebar rows, ${new Set(tabHrefs).size} tabbed screens, all reachable and all mapped`);
