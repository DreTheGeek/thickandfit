const path = require('path');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'landing');

async function shotAt(p, selOrText, name) {
  await p.evaluate((q) => {
    let el = document.querySelector('.coaching_image-wrapper');
    if (q === 'rep') {
      el = Array.from(document.querySelectorAll('h1,h2,h3,div,p'))
        .find((e) => /one rep at a time/i.test(e.textContent || '') && e.children.length <= 2) || el;
    }
    if (el) el.scrollIntoView({ block: 'center' });
    window.scrollBy(0, -60);
  }, selOrText);
  await new Promise((r) => setTimeout(r, 700));
  await p.screenshot({ path: path.join(OUT, name) });
  console.log(name);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

  const d = await b.newPage();
  await d.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
  await d.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  await shotAt(d, 'rep', 'fix-desk-empower.png');
  await shotAt(d, 'wrap', 'fix-desk-cluster.png');
  await d.close();

  const m = await b.newPage();
  await m.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 });
  await m.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  await shotAt(m, 'wrap', 'fix-mobile-cluster.png');
  await m.close();

  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
