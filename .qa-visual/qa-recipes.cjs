const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'admin');
const RID = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
async function login(p) {
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2000));
}
async function shot(p, route, name, full = false) {
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2200));
  await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(name);
}
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const d = await b.newPage();
  await d.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await login(d);
  await shot(d, '/coach/tool/recipes', 'rec-browser');
  await shot(d, `/coach/tool/recipes/${RID}`, 'rec-detail');
  await shot(d, '/coach/tool/recipe-books', 'rec-books');
  await shot(d, '/coach/tool/meal-plans', 'rec-mealplans');
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
