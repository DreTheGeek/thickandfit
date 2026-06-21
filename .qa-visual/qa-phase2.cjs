const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'admin');
const RECIPE = '383d7947-50c2-4aca-9639-16889cab3cbc';
async function login(p, email) {
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', email);
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
}
async function shot(p, route, name) {
  const errs = [];
  const h = (e) => errs.push(e.message);
  p.on('pageerror', h);
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => errs.push('NAV ' + e.message));
  await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  p.off('pageerror', h);
  console.log(name, '@', p.url(), errs.length ? 'ERR:' + errs.slice(0, 1).join('') : 'ok');
}
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  await login(p, 'sample.casey@thickandfit.test');
  await shot(p, '/coach/exercises', 'p2-exercises');
  await shot(p, `/coach/tool/recipes/${RECIPE}`, 'p2-recipe');
  // subscriber surfaces
  await p.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });
  await login(p, 'sample.sam@thickandfit.test');
  await shot(p, '/nutrition', 'p2-nutrition');
  await shot(p, '/community', 'p2-community');
  await shot(p, '/account/billing', 'p2-billing');
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
