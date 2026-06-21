// Single-shot capture: node cap.cjs <route> <name> <width>
const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const [route, name, width] = [process.argv[2], process.argv[3], Number(process.argv[4] || 1680)];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2000));
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(__dirname, 'admin', `${name}.png`) });
  console.log('captured', name);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
