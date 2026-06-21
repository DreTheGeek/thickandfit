const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'showcase');
fs.mkdirSync(OUT, { recursive: true });

const scrollToEmpower = () => {
  const els = Array.from(document.querySelectorAll('h1,h2,h3,div,span'))
    .filter((e) => /one rep at a time/i.test(e.textContent || '') && e.offsetParent !== null && e.children.length <= 2);
  if (els[0]) els[0].scrollIntoView({ block: 'start' });
  window.scrollBy(0, -30);
  return els.length;
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

  const d = await b.newPage();
  await d.setViewport({ width: 1440, height: 880, deviceScaleFactor: 1 });
  await d.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  const n = await d.evaluate(scrollToEmpower);
  console.log('desktop visible "one rep" headings:', n);
  await new Promise((r) => setTimeout(r, 500));
  await d.screenshot({ path: path.join(OUT, 'desk-1-intro.png') });
  for (let i = 2; i <= 5; i++) {
    await d.evaluate(() => window.scrollBy(0, 820));
    await new Promise((r) => setTimeout(r, 450));
    await d.screenshot({ path: path.join(OUT, `desk-${i}.png`) });
  }
  await d.close();

  const m = await b.newPage();
  await m.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 });
  await m.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  await m.evaluate(scrollToEmpower);
  await new Promise((r) => setTimeout(r, 500));
  await m.screenshot({ path: path.join(OUT, 'mobile-coaching.png') });
  await m.close();

  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
