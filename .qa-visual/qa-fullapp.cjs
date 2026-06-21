// Capture the FULL app, populated: subscriber (sam) + coach (casey).
const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const PW = 'TFSample2026!';
const OUT = path.join(__dirname, 'fullapp');
fs.mkdirSync(OUT, { recursive: true });
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));

async function newCtx(b) {
  return b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext();
}
async function login(page, email) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', email);
  await page.type('input[name=password]', PW);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await new Promise((r) => setTimeout(r, 1500));
}
async function shot(page, route, name, full = true) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`${name} <- ${route} (${page.url()})`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const a = await (await newCtx(browser)).newPage();
  await a.setViewport({ width: 440, height: 920, deviceScaleFactor: 2 });
  await shot(a, '/auth/sign-in', '00-signin');

  const s = await (await newCtx(browser)).newPage();
  await s.setViewport({ width: 460, height: 920, deviceScaleFactor: 2 });
  await login(s, 'sample.sam@thickandfit.test');
  await shot(s, '/dashboard', '01-today');
  await shot(s, '/workouts', '02-activities');
  await shot(s, `/workout/${seed.planId}`, '03-workout-player', true);
  await shot(s, '/you', '04-you');
  await shot(s, '/onboarding', '05-onboarding');
  await shot(s, '/account', '06-account');
  await shot(s, '/nutrition', '07-nutrition');
  await shot(s, '/messages', '08-messages');

  const c = await (await newCtx(browser)).newPage();
  await c.setViewport({ width: 1280, height: 850, deviceScaleFactor: 1 });
  await login(c, 'sample.casey@thickandfit.test');
  await shot(c, '/coach', '09-coach-overview', false);
  await shot(c, '/coach/subscribers', '10-coach-subscribers', false);
  await shot(c, '/coach/programs', '11-coach-programs', false);
  await shot(c, '/coach/forms', '12-coach-forms', false);

  await browser.close();
  console.log('done -> ' + OUT);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
