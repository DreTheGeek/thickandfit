const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'landing');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 5000));
  const ys = [520, 1350, 2200, 3100, 4200];
  for (const y of ys) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise((r) => setTimeout(r, 600));
    await p.screenshot({ path: path.join(OUT, `sec-${y}.png`), fullPage: false });
    console.log('sec-' + y);
  }
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
