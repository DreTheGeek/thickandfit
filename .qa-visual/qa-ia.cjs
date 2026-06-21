const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://thicknfit.kaldrtech.com';
const OUT = path.join(__dirname, 'admin');
const CLIENT = '51bbaec6-8669-416f-a889-29af543cc4ac';
const SUB = '4df435f9-dc5f-4e11-b07e-ff1672ce408d';
const shots = [
  ['/coach/clients', 'ia-clients'],
  [`/coach/clients/${CLIENT}`, 'ia-client-detail'],
  ['/coach/subscribers', 'ia-subscribers'],
  [`/coach/subscribers/${SUB}`, 'ia-sub-detail'],
  ['/coach/leads', 'ia-leads'],
  ['/coach/tool/meal-plans', 'ia-mealplans'],
  ['/coach/programs', 'ia-programs'],
  ['/coach/settings', 'ia-settings'],
  ['/coach/health', 'ia-health'],
];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
  for (const [route, name] of shots) {
    try {
      await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1800));
      await p.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log(name, '@', p.url());
    } catch (e) {
      console.log(name, 'FAIL', e.message);
    }
  }
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
