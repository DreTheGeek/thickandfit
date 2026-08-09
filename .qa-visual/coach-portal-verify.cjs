// Look at the reworked coach portal: render every screen at 1920 and at 390, and report layout,
// console errors, failed requests, raw i18n keys on screen, and horizontal overflow.
//
// LAYOUT ONLY. React does NOT hydrate under this puppeteer-core build against `next dev`: measured
// 2026-08-09, a page that shows 293 of 446 nodes carrying a React fiber in a real Chrome shows 1
// here, the theme toggle is inert and app-router links do a full page load. So every number below is
// server-rendered markup, which is exactly right for measuring widths and catching missing keys, and
// useless for anything that needs a click. Do NOT add an interaction assertion to this file: it will
// report a product bug that is not there. Drive interactions from a real browser instead, and see
// coach-magiclink.cjs for signing one in without typing a password.
//
// Signs in as the sample COACH account rather than a real person's account. Same role and the same
// company_id (c0ffee00-...-0001), so the settings row, the client list and the nav are identical;
// the difference is that this password is already the repo's committed test credential.
//
// Usage: node .qa-visual/coach-portal-verify.cjs
const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const EMAIL = 'sample.casey@thickandfit.test';
const PASSWORD = 'TFSample2026!';
const CLIENT_ID = 'c332298b-003e-4dab-86b1-639610b0f348';
const OUT = path.join(__dirname, 'coach-portal');
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ['/coach', 'overview'],
  ['/coach/clients', 'clients'],
  [`/coach/clients/${CLIENT_ID}`, 'client-detail'],
  ['/coach/settings', 'settings'],
  ['/coach/settings/client-app', 'settings-client-app'],
  ['/coach/settings/coaching', 'settings-coaching'],
];

// One set of listeners for the life of the page, writing into whichever bucket is current.
// Do NOT reach for page.removeAllListeners() between screens: it strips puppeteer's OWN internal
// frame-lifecycle handlers, and the next navigation dies with "Navigating frame was detached".
function newBucket() {
  return { console: [], pageErrors: [], failed: [], http: [] };
}
function attach(page, ref) {
  page.on('console', (m) => {
    // The dev server's HMR socket cannot upgrade through puppeteer; it is noise, not a defect.
    if (m.type() === 'error' && !/webpack-hmr|WebSocket/.test(m.text())) ref.b.console.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => ref.b.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    if (/webpack-hmr/.test(r.url())) return;
    ref.b.failed.push(`${r.method()} ${r.url().slice(0, 140)} :: ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) ref.b.http.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });
}

async function login(page) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.type('input[name=email]', EMAIL);
  await page.type('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  return page.url();
}

/** Everything a human would notice by looking, reduced to numbers a script can assert on. */
async function inspect(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const txt = body.innerText || '';
    // A raw i18n path rendered as visible text is the classic missing-key symptom.
    const rawKeys = (txt.match(/\b(?:app|home|funnel|auth|marketing)\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+/g) || []).slice(0, 10);
    // Anything wider than the viewport means a horizontal scrollbar on the page body.
    const overflow = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > doc.clientWidth + 2 || r.left < -2)) {
        const tag = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''}`;
        overflow.push(`${tag} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
        if (overflow.length >= 6) break;
      }
    }
    const main = document.querySelector('main') || body;
    const mainRect = main.getBoundingClientRect();
    return {
      title: document.title,
      h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim()).slice(0, 3),
      chars: txt.replace(/\s+/g, ' ').trim().length,
      firstText: txt.replace(/\s+/g, ' ').trim().slice(0, 260),
      rawKeys,
      bodyScrollW: body.scrollWidth,
      docClientW: doc.clientWidth,
      overflow,
      mainW: Math.round(mainRect.width),
      mainLeft: Math.round(mainRect.left),
      switches: document.querySelectorAll('[role=switch]').length,
      selects: document.querySelectorAll('select').length,
      inputs: document.querySelectorAll('input').length,
      sections: document.querySelectorAll('section').length,
      navLinks: document.querySelectorAll('nav a').length,
      buttons: Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const report = {};

  for (const [label, w, h] of [['desktop', 1920, 1080], ['mobile', 390, 844]]) {
    const ctx = await (browser.createBrowserContext
      ? browser.createBrowserContext()
      : browser.createIncognitoBrowserContext());
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const ref = { b: newBucket() };
    attach(page, ref);
    const landed = await login(page);
    console.log(`\n===== ${label} ${w}x${h}  (login landed on ${landed}) =====`);

    for (const [route, name] of SCREENS) {
      const bucket = newBucket();
      ref.b = bucket;
      let status = 0;
      try {
        const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90000 });
        status = resp ? resp.status() : 0;
      } catch (e) {
        console.log(`  ${name}: NAVIGATION FAILED ${e.message}`);
        continue;
      }
      await new Promise((r) => setTimeout(r, 1400));
      const info = await inspect(page);
      await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: true });
      report[`${label}/${name}`] = { route, status, url: page.url(), ...info, ...bucket };

      console.log(`\n  --- ${name}  ${route}  [HTTP ${status}] -> ${page.url()}`);
      console.log(`      h1=${JSON.stringify(info.h1)}  chars=${info.chars}  main=${info.mainW}px @left ${info.mainLeft}`);
      console.log(`      controls: ${info.switches} switch, ${info.selects} select, ${info.inputs} input, ${info.sections} section, ${info.navLinks} navlink`);
      console.log(`      scrollW=${info.bodyScrollW} vs clientW=${info.docClientW}${info.bodyScrollW > info.docClientW + 1 ? '   <<< HORIZONTAL OVERFLOW' : ''}`);
      if (info.overflow.length) console.log(`      overflowing: ${info.overflow.join(' | ')}`);
      if (info.rawKeys.length) console.log(`      RAW I18N KEYS ON SCREEN: ${info.rawKeys.join(', ')}`);
      if (bucket.pageErrors.length) console.log(`      PAGE ERRORS: ${bucket.pageErrors.join(' | ')}`);
      if (bucket.console.length) console.log(`      CONSOLE ERRORS: ${bucket.console.slice(0, 4).join(' | ')}`);
      if (bucket.http.length) console.log(`      HTTP >=400: ${[...new Set(bucket.http)].slice(0, 5).join(' | ')}`);
      console.log(`      text: ${info.firstText}`);
    }
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`\ndone -> ${OUT}`);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
