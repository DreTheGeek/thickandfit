// Open every page a stranger can reach and fail if any of them is broken. No sign-in needed.
//
// WHY THIS EXISTS. The member portal and the coach console each have a production sweep now. The
// third surface had none, and it is the one that is ALREADY LIVE: the site went public on
// 2026-07-30, ahead of both scheduled dates, so `/`, the three /vs comparison pages, the waitlist
// funnel and the legal pages are being read by strangers today.
//
// A 200 proves nothing here. This app fails open by convention, and a page whose data read throws
// renders the error boundary behind a 200 with no console error at all - the workout preview
// shipped exactly that way, green on tsc, eslint and next build. So the check is: did the page
// render ITS OWN content.
//
// THE /es TWINS ARE HALF THE POINT. Every marketing page has a Spanish twin at /es, and the twins
// are separate route files: one can rot while the other is fine, and nobody visits /es by accident.
// A missing translation surfaces here as a raw next-intl key on screen.
//
//   node .qa-visual/public-shots.mjs                 phone 390x844
//   node .qa-visual/public-shots.mjs --desktop       1280x900
//   node .qa-visual/public-shots.mjs --no-shots      assertions only, no PNGs
//   node .qa-visual/public-shots.mjs http://127.0.0.1:3000
//
// GATE-AWARE. `PRELAUNCH_HIDE_SITE` / `PRELAUNCH_WAITLIST_CLOSED` legitimately redirect these pages
// to /soon or /join. A redirect to one of those is reported as "gated", not as a failure, so this
// stays runnable while the site is dark. `prelaunch-gate-test.mjs` is what proves the gate itself.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BASE_URL } from './qa-accounts.mjs';

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith('http')) ?? BASE_URL;
const DESKTOP = args.includes('--desktop');
const SHOOT = !args.includes('--no-shots');
const VIEWPORT = DESKTOP ? { width: 1280, height: 900 } : { width: 390, height: 844 };
const OUT = path.join(process.cwd(), '.qa-visual', 'public', DESKTOP ? 'desktop' : 'phone');

/**
 * Each page and a marker of its own content.
 *
 * The Spanish markers are Spanish words on purpose: an /es page that renders the ENGLISH copy is a
 * broken /es page, and a bilingual marker would pass it. This is the opposite call from
 * coach-shots.mjs, where the same route serves both languages and the marker must accept either.
 */
const PAGES = [
  ['/', 'home', /thick|fit|steph/i],
  ['/about', 'about', /steph|about|story|coach/i],
  ['/faq', 'faq', /question|faq|answer/i],
  ['/pricing', 'pricing', /\$|month|plan|price/i],
  ['/vs/cal-ai', 'vs-cal-ai', /cal ai|compare|instead/i],
  ['/vs/fitia', 'vs-fitia', /fitia|compare|instead/i],
  ['/vs/myfitnesspal', 'vs-mfp', /myfitnesspal|compare|instead/i],
  ['/join', 'join', /waitlist|join|email|list/i],
  ['/join/quiz', 'join-quiz', /quiz|question|goal|next/i],
  ['/support', 'support', /support|help|contact|message/i],
  ['/terms', 'terms', /terms|agreement|service/i],
  ['/privacy', 'privacy', /privacy|data|information/i],
  ['/disclaimer', 'disclaimer', /disclaimer|medical|advice/i],
  ['/soon', 'soon', /soon|coming|list|steph/i],
  ['/auth/sign-in', 'sign-in', /sign in|password|email/i],
  ['/auth/sign-up', 'sign-up', /sign up|create|account|email/i],
  ['/auth/forgot-password', 'forgot', /reset|forgot|email/i],
  // The Spanish twins. Separate route files, so each one can rot on its own.
  ['/es', 'es-home', /thick|fit|steph|entrena|cuerpo/i],
  ['/es/about', 'es-about', /steph|historia|sobre|entrenad/i],
  ['/es/faq', 'es-faq', /pregunt|respuesta/i],
  ['/es/pricing', 'es-pricing', /\$|mes|plan|precio/i],
  ['/es/vs/cal-ai', 'es-vs-cal-ai', /cal ai|compar|en lugar/i],
  ['/es/vs/fitia', 'es-vs-fitia', /fitia|compar|en lugar/i],
  ['/es/vs/myfitnesspal', 'es-vs-mfp', /myfitnesspal|compar|en lugar/i],
  ['/es/join', 'es-join', /lista|[uú]nete|correo|espera/i],
  ['/es/join/quiz', 'es-join-quiz', /pregunt|meta|siguiente/i],
  ['/es/support', 'es-support', /soporte|ayuda|contact|mensaje/i],
  ['/es/terms', 'es-terms', /t[eé]rminos|servicio|acuerdo/i],
  ['/es/privacy', 'es-privacy', /privacidad|datos|informaci/i],
  ['/es/disclaimer', 'es-disclaimer', /aviso|m[eé]dic|descargo/i],
  ['/es/soon', 'es-soon', /pronto|lista|steph/i],
];

const ERROR_MARKER = /something went wrong|algo sali[oó] mal/i;
const RAW_KEY = /\b(?:coach|app|common|nav|marketing|funnel|auth|home|about|faq|pricing|waitlist)\.[a-z][A-Za-z0-9]{3,}\b/;
/** A next-intl key that failed to resolve is logged as this before it is ever rendered. */
const I18N_ERROR = /MISSING_MESSAGE|INSUFFICIENT_PATH|IntlError/;
/** Where a closed gate is allowed to send a page. */
const GATE_DESTINATIONS = [/\/soon$/, /\/join$/];

if (SHOOT) fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Timezone pinned away from the server's (Vercel is UTC) for the reason coach-shots.mjs records:
// inheriting the machine's zone makes a local run agree with a local server and disagree with
// production, which is exactly where hydration mismatches hide.
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, timezoneId: 'America/Los_Angeles' });
const page = await ctx.newPage();

let problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 180)}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 180)}`));

console.log(`base: ${BASE}  viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`);

const results = [];
for (const [route, name, expect] of PAGES) {
  problems = [];
  let status = 0;
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
    status = res?.status() ?? 0;
  } catch {
    // Assertions still run against whatever rendered.
  }
  await page.waitForTimeout(700);
  const landed = new URL(page.url()).pathname;
  const text = await page.locator('body').innerText().catch(() => '');

  // A prelaunch gate sending this page to /soon or /join is the switch working, not a break.
  if (landed !== route && GATE_DESTINATIONS.some((d) => d.test(landed))) {
    console.log(`  ${name.padEnd(16)} ${route.padEnd(26)} gated -> ${landed}`);
    continue;
  }

  const failures = [];
  if (status >= 400) failures.push(`HTTP ${status}`);
  if (ERROR_MARKER.test(text)) failures.push('renders the error boundary');
  // 40, not 80. /auth/forgot-password is a legitimately terse page - "RESET YOUR PASSWORD / SEND
  // RESET LINK / Sign in / English·Español" is 61 characters and a working form - and an 80-char
  // floor called it broken. The content marker is the real check; this is only a backstop against a
  // render that produced nothing at all.
  if (text.replace(/\s+/g, ' ').trim().length < 40) failures.push('page is essentially blank');
  if (expect && !expect.test(text)) failures.push(`no content marker (${expect})`);
  const rawKey = text.match(RAW_KEY);
  if (rawKey) failures.push(`raw i18n key on screen: ${rawKey[0]}`);
  const ours = problems.filter((p) => p.startsWith('pageerror') || I18N_ERROR.test(p) || /NaN|#418|#423|#425/.test(p));
  if (ours.length) failures.push(`${ours.length} app-level console error(s)`);

  if (SHOOT) await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});

  if (failures.length) {
    console.log(`  ${name.padEnd(16)} ${route.padEnd(26)} FAIL`);
    for (const f of failures) console.log(`      ${f}`);
    for (const p of ours.slice(0, 4)) console.log(`      ${p}`);
  } else {
    console.log(`  ${name.padEnd(16)} ${route.padEnd(26)} ok`);
  }
  results.push({ name, route, failures });
}

await browser.close();

const broken = results.filter((r) => r.failures.length);
console.log(`\n${SHOOT ? `shots -> ${OUT}\n` : ''}${results.length - broken.length}/${results.length} public pages clean`);
if (broken.length) {
  console.error(`\nFAILED: ${broken.length} page(s) broken`);
  for (const b of broken) console.error(`  ${b.name} (${b.route}): ${b.failures.join('; ')}`);
}
process.exit(broken.length ? 1 : 0);
