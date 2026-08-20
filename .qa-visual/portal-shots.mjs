// Screenshot the member portal at phone width, signed in as a real member.
//
// The 8.0 re-skin is verified by tsc, eslint, i18n parity and a production build, and none of those
// can see a screen. Two regressions during this work were caught only by reading generated class
// strings: a stat row that would have lightened three figures from bold to semibold, and a
// leaderboard bar painted in its own card's ground colour so a member's row vanished. Both compile.
//
// Defaults to PRODUCTION, because that is where the code actually is and a dev build can differ.
//
// Run: node .qa-visual/portal-shots.mjs [baseUrl]
//   node .qa-visual/portal-shots.mjs                      -> https://www.teamthickandfit.com
//   node .qa-visual/portal-shots.mjs http://127.0.0.1:3000
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'https://www.teamthickandfit.com';
const EMAIL = process.env.E2E_MEMBER_EMAIL ?? 'sample.sam@thickandfit.test';
const PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? 'TFSample2026!';
const OUT = path.join(process.cwd(), '.qa-visual', 'portal');

// 390x844 is the handoff's own phone frame, so a shot here is directly comparable to the mock.
const PHONE = { width: 390, height: 844 };

const SHOTS = [
  { name: '01-today', route: '/dashboard' },
  { name: '02-train', route: '/workouts' },
  { name: '03-fuel', route: '/nutrition' },
  { name: '04-fuel-add', route: '/nutrition', click: 'text=/add meal/i' },
  { name: '05-community', route: '/community' },
  { name: '06-you', route: '/you' },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Console errors are worth having next to the pictures: a screen can look right and still be
// throwing, and this app fails open everywhere so a broken read renders as a calm empty state.
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));

console.log(`base: ${BASE}`);
await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 60_000 }).catch(() => {}),
  page.click('button[type=submit]'),
]);
await page.waitForTimeout(2500);

if (page.url().includes('/auth/')) {
  console.error(`FAILED to sign in as ${EMAIL} (still at ${page.url()})`);
  await browser.close();
  process.exit(1);
}
console.log(`signed in, landed on ${new URL(page.url()).pathname}`);

for (const s of SHOTS) {
  const before = problems.length;
  await page.goto(`${BASE}${s.route}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1800);

  if (s.click) {
    // Best-effort: a shot of the closed state is still useful if the affordance moved.
    await page.click(s.click, { timeout: 5000 }).catch(() => console.log(`  (no match for ${s.click})`));
    await page.waitForTimeout(1200);
  }

  const file = path.join(OUT, `${s.name}.png`);
  // fullPage so the whole screen is visible rather than the first 844px of it.
  await page.screenshot({ path: file, fullPage: true });
  const newProblems = problems.slice(before);
  console.log(
    `  ${s.name.padEnd(14)} ${s.route.padEnd(12)} ${newProblems.length ? `${newProblems.length} console error(s)` : 'clean'}`,
  );
  newProblems.forEach((p) => console.log(`      ${p}`));
}

await browser.close();
console.log(`\n${SHOTS.length} shots -> ${OUT}`);
if (problems.length) console.log(`${problems.length} console problem(s) total, listed above.`);
