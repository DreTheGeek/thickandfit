// Look at the rebuilt exercise library and the regrouped coach nav: render at 1920 and 390, report
// what a human would notice, and drive the filters through the URL rather than through clicks.
//
// WHY THE URL AND NOT CLICKS. React does not hydrate under this puppeteer-core build against
// `next dev` (see coach-portal-verify.cjs for the measurement), so a click assertion here would be
// a lie. Every filter on this screen is URL state, so navigating to ?mine=0 exercises exactly the
// server code path the chip fires, and the rendered result is real evidence. The star is the one
// control that is NOT URL state; it is verified separately against the table.
//
// Usage: node .qa-visual/exercise-library-verify.cjs
const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const EMAIL = 'sample.casey@thickandfit.test';
const PASSWORD = 'TFSample2026!';
const OUT = path.join(__dirname, 'exercise-library');
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ['/coach/exercises', 'library-default'],
  ['/coach/exercises?mine=0', 'library-all'],
  ['/coach/exercises?fav=1', 'library-favorites'],
  ['/coach/exercises?mine=0&q=squat', 'library-search'],
  ['/coach/programs', 'programs'],
  ['/coach/inbox', 'chat'],
];

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

async function inspect(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const txt = body.innerText || '';
    const rawKeys = (txt.match(/\b(?:app|home|funnel|auth|marketing)\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+/g) || []).slice(0, 10);
    const overflow = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > doc.clientWidth + 2 || r.left < -2)) {
        const tag = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''}`;
        overflow.push(`${tag} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
        if (overflow.length >= 6) break;
      }
    }
    // The nav is the other half of this change: read its section headers and items in order.
    const nav = document.querySelector('nav');
    const navTree = nav
      ? Array.from(nav.children).map((sec) => ({
          header: (sec.querySelector('button')?.innerText || '').trim(),
          items: Array.from(sec.querySelectorAll('a')).map((a) => a.innerText.trim()),
        }))
      : [];
    const pressed = Array.from(document.querySelectorAll('[aria-pressed]')).map((b) => ({
      label: (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 40),
      on: b.getAttribute('aria-pressed') === 'true',
    }));
    return {
      title: document.title,
      h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim()).slice(0, 3),
      count: (txt.match(/\d+ exercises?/) || [''])[0],
      ownedBadges: (txt.match(/OWNED BY ME|Owned by me|Míos|MÍOS/g) || []).length,
      cards: document.querySelectorAll('a[href^="/coach/exercises/"]').length,
      starsFilled: Array.from(document.querySelectorAll('[aria-pressed="true"]')).filter((b) =>
        (b.getAttribute('aria-label') || '').toLowerCase().includes('favorit'),
      ).length,
      pressed: pressed.slice(0, 6),
      navTree,
      rawKeys,
      bodyScrollW: body.scrollWidth,
      docClientW: doc.clientWidth,
      overflow,
      firstText: txt.replace(/\s+/g, ' ').trim().slice(0, 200),
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/webpack-hmr|WebSocket/.test(m.text())) errors.push(m.text().slice(0, 200));
    });
    const landed = await login(page);
    console.log(`\n===== ${label} ${w}x${h}  (login landed on ${landed}) =====`);

    for (const [route, name] of SCREENS) {
      errors.length = 0;
      let status = 0;
      try {
        const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90000 });
        status = resp ? resp.status() : 0;
      } catch (e) {
        console.log(`  ${name}: NAVIGATION FAILED ${e.message}`);
        continue;
      }
      await new Promise((r) => setTimeout(r, 1200));
      const info = await inspect(page);
      await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: false });
      report[`${label}/${name}`] = { route, status, ...info, errors: [...errors] };

      console.log(`\n  --- ${name}  ${route}  [HTTP ${status}]`);
      console.log(`      h1=${JSON.stringify(info.h1)}  count="${info.count}"  cards=${info.cards}  ownedBadges=${info.ownedBadges}  starsFilled=${info.starsFilled}`);
      if (info.pressed.length) console.log(`      toggles: ${info.pressed.map((p) => `${p.label}=${p.on}`).join(', ')}`);
      console.log(`      scrollW=${info.bodyScrollW} vs clientW=${info.docClientW}${info.bodyScrollW > info.docClientW + 1 ? '   <<< HORIZONTAL OVERFLOW' : ''}`);
      if (info.overflow.length) console.log(`      overflowing: ${info.overflow.join(' | ')}`);
      if (info.rawKeys.length) console.log(`      RAW I18N KEYS ON SCREEN: ${info.rawKeys.join(', ')}`);
      if (errors.length) console.log(`      ERRORS: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
      if (name === 'library-default' && info.navTree.length) {
        console.log('      NAV:');
        for (const s of info.navTree) console.log(`        ${s.header} :: ${s.items.join(' | ')}`);
      }
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
