const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'admin');
const CID = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2000));
}
async function shot(page, route, name, full = false) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(name);
}
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const d = await b.newPage();
  await d.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await login(d);
  await shot(d, '/coach/clients', 'cl-list');
  await shot(d, '/coach/clients?standing=at_risk', 'cl-filtered');
  await shot(d, `/coach/clients/${CID}`, 'cl-detail', true);
  await d.close();

  const m = await b.newPage();
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await login(m);
  await shot(m, '/coach/clients', 'cl-list-mobile', true);
  await shot(m, `/coach/clients/${CID}`, 'cl-detail-mobile', true);
  await m.close();
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
