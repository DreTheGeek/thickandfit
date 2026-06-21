const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'responsive');
fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.sam@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1500));
}
async function shot(page, route, name) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(name);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

  // Desktop
  const d = await (b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext()).then((c) => c.newPage());
  await d.setViewport({ width: 1366, height: 850, deviceScaleFactor: 1 });
  await login(d);
  await shot(d, '/dashboard', 'desktop-today');
  await shot(d, '/workouts', 'desktop-activities');
  await shot(d, '/you', 'desktop-you');

  // Tablet
  const tb = await (b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext()).then((c) => c.newPage());
  await tb.setViewport({ width: 834, height: 1112, deviceScaleFactor: 2 });
  await login(tb);
  await shot(tb, '/dashboard', 'tablet-today');

  await b.close();
  console.log('done -> ' + OUT);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
