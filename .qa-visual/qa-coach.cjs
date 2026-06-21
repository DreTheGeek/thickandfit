const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
const OUT = path.join(__dirname, 'coach');
fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1500));
}
async function shot(page, route, name, full = false) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1300));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`${name} <- ${route}`);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

  // Desktop
  const d = await (b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext()).then((c) => c.newPage());
  await d.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
  await login(d);
  await shot(d, '/coach', 'd1-overview');
  await shot(d, '/coach/subscribers', 'd2-subscribers');
  await shot(d, `/coach/subscribers/${seed.samId}`, 'd3-profile');
  await shot(d, `/coach/programs/${seed.planId}`, 'd4-builder', true);
  await shot(d, '/coach/broadcasts', 'd5-broadcast', true);
  await shot(d, '/coach/health', 'd6-health');

  // Mobile
  const m = await (b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext()).then((c) => c.newPage());
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await login(m);
  await shot(m, '/coach', 'm1-overview');
  await shot(m, '/coach/subscribers', 'm2-subscribers');
  // drawer
  await m.goto(`${BASE}/coach`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await m.click('[aria-label=Menu]').catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  await m.screenshot({ path: path.join(OUT, 'm3-drawer.png') });
  console.log('m3-drawer');
  await shot(m, `/coach/programs/${seed.planId}`, 'm4-builder', true);

  await b.close();
  console.log('done -> ' + OUT);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
