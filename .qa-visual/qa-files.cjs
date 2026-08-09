const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://thicknfit.kaldrtech.com';
const OUT = path.join(__dirname, 'admin');
const CLIENT = '32aa5971-7f05-47ee-b879-f4a42e8e6109';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));

  await p.goto(`${BASE}/admin/health`, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(OUT, 'f-health.png') });
  console.log('f-health');

  await p.goto(`${BASE}/coach/clients/${CLIENT}`, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1800));
  // click the Files tab (button text starts with "Files")
  const clicked = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button'));
    const tab = els.find((e) => (e.textContent || '').trim().startsWith('Files'));
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: path.join(OUT, 'f-files.png') });
  console.log('f-files clicked=', clicked);

  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
