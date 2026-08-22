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
import { MEMBER } from './qa-accounts.mjs';

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith('http')) ?? 'https://www.teamthickandfit.com';
/**
 * Desktop mode. Every screen in this re-skin was designed against the handoff's 390px phone, and
 * the shell swaps the bottom bar for a left rail at lg, so 1280 is a genuinely different layout
 * rather than the same one wider. Shots land in a `desktop/` subfolder so a phone run does not
 * overwrite them.
 */
const DESKTOP = args.includes('--desktop');
/**
 * Spanish. The authed app has no /es URL: locale comes from the `ui_locale` COOKIE, set by the
 * language toggle. So this sets the cookie rather than mutating a test account's profile, which
 * means a Spanish run leaves no trace in the database.
 *
 * Worth running because Spanish is 15-25% longer against fixed-height rows and 10-12px labels, and
 * every screen in this re-skin was laid out against English copy.
 */
const ES = args.includes('--es');
// Credentials come from qa-accounts.mjs so a rotation is one edit, not four. This file used to
// hold its own copy, the accounts were rotated, and this tool spent three portal releases failing
// at the login form - see the note at the top of that file for what it was hiding.
const { email: EMAIL, password: PASSWORD } = MEMBER;
const OUT = path.join(process.cwd(), '.qa-visual', 'portal', `${DESKTOP ? 'desktop' : 'phone'}${ES ? '-es' : ''}`);

// 390x844 is the handoff's own phone frame, so a shot here is directly comparable to the mock.
// 1280x900 is past the lg breakpoint, where SubscriberRail replaces the bottom nav.
const VIEWPORT = DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 };

const SHOTS = [
  { name: '01-today', route: '/dashboard', expect: /transformation status|estado de/i },
  { name: '02-train', route: '/workouts', expect: /today's workout|entreno de hoy/i },
  { name: '03-fuel', route: '/nutrition', expect: /calories|calor/i },
  { name: '04-fuel-add', route: '/nutrition', click: ES ? 'text=/agregar comida/i' : 'text=/add meal/i', expect: /scan|escanear/i },
  { name: '05-community', route: '/community' },
  { name: '06-you', route: '/you' },
  { name: '08-progress', route: '/progress', expect: /weight trend|tendencia/i },
  { name: '10-coach', route: '/inbox', expect: /steph/i },
  { name: '11-coach-chat', route: '/coach-chat', expect: /steph/i },
  { name: '09-progress-body', route: '/progress?tab=body', expect: /./ },
  // Resolved at runtime from the Train screen, because the plan id is per-member.
  { name: '07-preview', route: null, fromRoute: '/workouts', from: 'a[href*="preview=1"]', expect: /start workout|empezar|entrenamiento/i },
];

/**
 * The error boundary's own copy. A route that throws renders THIS instead of the screen, with a
 * 200 and no console error, so a screenshot run that only checks for crashes reports it as clean.
 *
 * The workout preview shipped exactly this way: it called useTranslations, the client hook, from a
 * component rendered by an async server page. tsc, eslint and `next build` were all green and the
 * page was a 500 behind "Something went wrong" on every visit.
 */
const ERROR_MARKER = /something went wrong/i;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Timezone PINNED, and not to the server's. Vercel is UTC, so a checker that inherits the machine's
// zone agrees with a local `next start` and disagrees with production, which hides every hydration
// mismatch coming from an instant formatted without an explicit timeZone. That class already cost
// this portal once (/inbox, React #418 on every visit) and it cost the coach console again on
// 2026-08-22, where /coach/clients/[id] passed locally and threw on the first production run.
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DESKTOP ? 1 : 2, timezoneId: 'America/Los_Angeles' });
const page = await ctx.newPage();

// Console errors are worth having next to the pictures: a screen can look right and still be
// throwing, and this app fails open everywhere so a broken read renders as a calm empty state.
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));

console.log(`base: ${BASE}  viewport: ${VIEWPORT.width}x${VIEWPORT.height}  locale: ${ES ? 'es' : 'en'}`);
await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 60_000 }).catch(() => {}),
  page.click('button[type=submit]'),
]);
await page.waitForTimeout(2500);

if (page.url().includes('/auth/')) {
  console.error(
    `FAILED to sign in as ${EMAIL} (still at ${page.url()}).\n` +
      `That is a STALE CREDENTIAL, not a broken app. Fix it in .qa-visual/qa-accounts.mjs and\n` +
      `check both accounts with: node .qa-visual/qa-accounts.mjs`,
  );
  await browser.close();
  process.exit(1);
}
console.log(`signed in, landed on ${new URL(page.url()).pathname}`);

if (ES) {
  // AFTER sign-in, not before. The middleware only defaults ui_locale when it is absent, so a
  // pre-set cookie survives that, but the sign-in action then writes the locale from the member's
  // PROFILE (lib/auth/actions.ts), and the QA member's profile says en. Setting it first looked like
  // it worked and produced an entirely English run.
  await ctx.addCookies([{ name: 'ui_locale', value: 'es', url: BASE }]);
  console.log('ui_locale cookie set to es (post-login)');
}

let failures = 0;

for (const s of SHOTS) {
  const before = problems.length;

  let route = s.route;
  if (!route && s.from) {
    // A route whose URL depends on this member's own data, so it is read off the screen that links
    // to it. That screen has to be OPEN to read it: the first version resolved the selector against
    // whatever page the previous shot had left behind, found nothing, and skipped silently, which
    // is the same shape of miss this whole tool exists to stop.
    await page.goto(`${BASE}${s.fromRoute}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    route = await page.getAttribute(s.from, 'href').catch(() => null);
    if (!route) {
      console.log(`  ${s.name.padEnd(14)} FAILED (no ${s.from} on ${s.fromRoute})`);
      failures += 1;
      continue;
    }
  }

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1800);

  if (s.click) {
    // Best-effort: a shot of the closed state is still useful if the affordance moved.
    await page.click(s.click, { timeout: 5000 }).catch(() => console.log(`  (no match for ${s.click})`));
    await page.waitForTimeout(1200);
  }

  const file = path.join(OUT, `${s.name}.png`);
  // fullPage so the whole screen is visible rather than the first 844px of it.
  await page.screenshot({ path: file, fullPage: true });

  // The assertions, in the order they catch things.
  //
  // innerText, NOT textContent. textContent returns the text of every node in the tree including
  // <script>, and next-intl serialises the whole message catalogue into the flight payload, so the
  // error boundary's own copy is present on every page that renders correctly. The first version of
  // this check used textContent and reported all six screens broken while every one of them was
  // fine. innerText is the visible text, which is the thing being asserted about.
  const body = (await page.evaluate(() => document.body.innerText).catch(() => '')) ?? '';
  const notes = [];
  if (ERROR_MARKER.test(body)) {
    notes.push('RENDERED THE ERROR BOUNDARY');
    failures += 1;
  } else if (s.expect && !s.expect.test(body)) {
    // Not fatal on its own: an empty state is legitimate for a member with no data. It is still
    // worth saying out loud, because this app fails open and an empty screen is what a broken read
    // looks like.
    notes.push(`did not contain ${s.expect} (empty state, or a broken read)`);
  }
  const newProblems = problems.slice(before);
  if (newProblems.length) {
    notes.push(`${newProblems.length} console error(s)`);
    failures += 1;
  }

  console.log(`  ${s.name.padEnd(14)} ${String(route).slice(0, 34).padEnd(36)} ${notes.length ? notes.join(' | ') : 'ok'}`);
  newProblems.forEach((p) => console.log(`      ${p}`));
}

await browser.close();
console.log(`\nshots -> ${OUT}`);
console.log(failures ? `FAILED: ${failures} screen(s) broken` : 'OK: every screen rendered its own content');
process.exit(failures ? 1 : 0);
