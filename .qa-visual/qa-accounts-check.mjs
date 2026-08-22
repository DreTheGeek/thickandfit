// Prove the two QA sign-ins in `qa-accounts.mjs` still work, before blaming the app.
//
//   node .qa-visual/qa-accounts-check.mjs
//
// Run this FIRST whenever a browser-driving checker goes red at the login form. A stale credential
// and a broken sign-in flow look identical from a Playwright timeout, and the repo has already paid
// for that confusion once: `portal-shots.mjs` sat red for three portal releases while /progress was
// quietly rendering a chart with NaN coordinates behind it.
import { chromium } from '@playwright/test';
import { MEMBER, COACH, BASE_URL, signIn } from './qa-accounts.mjs';

const base = process.argv.find((a) => a.startsWith('http')) ?? BASE_URL;
const browser = await chromium.launch();
let bad = 0;

console.log(`base: ${base}`);
for (const [label, account] of [
  ['member', MEMBER],
  ['coach', COACH],
]) {
  const page = await browser.newPage();
  try {
    const landed = await signIn(page, account, base);
    console.log(`  OK    ${label.padEnd(6)} ${account.email} -> ${landed}`);
  } catch (e) {
    console.error(`  STALE ${label.padEnd(6)} ${account.email}\n        ${e.message}`);
    bad += 1;
  }
  await page.close();
}

await browser.close();
if (bad) console.error(`\n${bad} account(s) can no longer sign in. Fix .qa-visual/qa-accounts.mjs.`);
process.exit(bad ? 1 : 0);
