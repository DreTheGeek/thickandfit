const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://thicknfit.kaldrtech.com';
const OUT = path.join(__dirname, 'admin');
const CLIENT = '8a428c79-e383-4b02-8233-35a3732d4eb5';
const shots = [
  [`/coach/clients/${CLIENT}`, 'v-client'],
  ['/admin/health', 'v-health'],
  ['/coach/settings', 'v-settings'],
];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
  for (const [route, name] of shots) {
    await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1800));
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(name, '@', p.url());
  }
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
