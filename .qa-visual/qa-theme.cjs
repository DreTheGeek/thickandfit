const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'admin');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2000));

  await p.goto(`${BASE}/coach/clients`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: path.join(OUT, 'theme-light.png') });
  console.log('theme-light');

  await p.evaluate(() => localStorage.setItem('theme', 'dark'));
  await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(OUT, 'theme-dark-overview.png') });
  console.log('theme-dark-overview');

  await p.goto(`${BASE}/coach/clients`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: path.join(OUT, 'theme-dark-clients.png') });
  console.log('theme-dark-clients');

  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
