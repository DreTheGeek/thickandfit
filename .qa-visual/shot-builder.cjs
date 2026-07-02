// Verify the meal-plan BUILDER as coach sample.casey: render the new builder, drive a real save
// round-trip (fill name + a recipe + ingredient, Save -> redirect to detail), and load a template.
const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const PW = 'TFSample2026!';
const TEMPLATE_ID = '519cce7a-3101-496f-8bfe-08f20c347a57';
const OUT = path.join(__dirname, 'reskin');
fs.mkdirSync(OUT, { recursive: true });

async function fillByPlaceholder(page, ph, val) {
  const el = await page.$(`[placeholder="${ph}"]`);
  if (!el) throw new Error(`no input with placeholder: ${ph}`);
  await el.click({ clickCount: 3 });
  await el.type(val, { delay: 5 });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1180, height: 1400, deviceScaleFactor: 1 });

  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', PW);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await new Promise((r) => setTimeout(r, 1200));

  // 1. New builder render.
  await page.goto(`${BASE}/coach/tool/meal-plans/new`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, 'builder-new.png'), fullPage: true });
  console.log('new builder url:', page.url());

  // 2. Drive a real save round-trip.
  await fillByPlaceholder(page, 'e.g. Fat loss - 1700 kcal', 'QA Structured Test Plan');
  await fillByPlaceholder(page, 'e.g. Taco bowl with beef', 'QA Chicken bowl');
  await fillByPlaceholder(page, 'Ground beef, 93% lean', 'Chicken breast, cooked');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
    page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save plan');
      if (b) b.click();
    }),
  ]);
  await new Promise((r) => setTimeout(r, 1500));
  console.log('after-save url:', page.url());
  await page.screenshot({ path: path.join(OUT, 'builder-saved-detail.png'), fullPage: true });

  // 3. Load the seeded template into the editor.
  await page.goto(`${BASE}/coach/tool/meal-plans/${TEMPLATE_ID}/edit`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, 'builder-edit-loaded.png'), fullPage: true });
  console.log('edit url:', page.url());
  console.log('pageerrors:', errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
