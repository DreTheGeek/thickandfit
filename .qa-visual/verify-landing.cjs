const path = require('path');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'landing');

async function cap(b, w, h, name) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 3500));
  await p.evaluate(() => {
    const el = document.querySelector('.coaching_image-wrapper');
    if (el) el.scrollIntoView({ block: 'center' });
    window.scrollBy(0, -120);
  });
  await new Promise((r) => setTimeout(r, 700));
  await p.screenshot({ path: path.join(OUT, name) });
  console.log(name);
  await p.close();
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  await cap(b, 1440, 860, 'empower-desktop.png');
  await cap(b, 390, 800, 'empower-mobile.png');
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
