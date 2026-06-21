// One-off visual QA: log in as subscriber + coach, screenshot the re-skinned screens.
const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const PW = 'TFSample2026!';
const OUT = path.join(__dirname, 'reskin');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];

async function newCtx(browser) {
  if (browser.createBrowserContext) return browser.createBrowserContext();
  return browser.createIncognitoBrowserContext();
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
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`shot ${name} <- ${route} (final url: ${page.url()})`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  // Unauthenticated auth screens
  const ctxAuth = await newCtx(browser);
  const pAuth = await ctxAuth.newPage();
  await pAuth.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });
  pAuth.on('console', (m) => m.type() === 'error' && errors.push(`[auth] ${m.text()}`));
  await shot(pAuth, '/auth/sign-in', '00-signin');
  await shot(pAuth, '/auth/sign-up', '01-signup');

  // Subscriber
  const ctxSub = await newCtx(browser);
  const pSub = await ctxSub.newPage();
  await pSub.setViewport({ width: 460, height: 900, deviceScaleFactor: 2 });
  pSub.on('console', (m) => m.type() === 'error' && errors.push(`[sub] ${m.text()}`));
  await login(pSub, 'sample.sam@thickandfit.test');
  console.log('subscriber landed: ' + pSub.url());
  await shot(pSub, '/onboarding', '02-onboarding');
  await shot(pSub, '/dashboard', '03-today');
  await shot(pSub, '/workouts', '04-activities');
  await shot(pSub, '/you', '05-you');
  await shot(pSub, '/account', '06-account');
  await shot(pSub, '/nutrition', '07-nutrition-stub');

  // Coach
  const ctxCoach = await newCtx(browser);
  const pCoach = await ctxCoach.newPage();
  await pCoach.setViewport({ width: 1280, height: 850, deviceScaleFactor: 1 });
  pCoach.on('console', (m) => m.type() === 'error' && errors.push(`[coach] ${m.text()}`));
  await login(pCoach, 'sample.casey@thickandfit.test');
  console.log('coach landed: ' + pCoach.url());
  await shot(pCoach, '/coach', '08-coach-overview', false);
  await shot(pCoach, '/coach/subscribers', '09-coach-subscribers', false);
  await shot(pCoach, '/coach/programs', '10-coach-programs', false);

  await browser.close();
  console.log('\n=== console errors (' + errors.length + ') ===');
  errors.slice(0, 20).forEach((e) => console.log(e));
  console.log('done -> ' + OUT);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
