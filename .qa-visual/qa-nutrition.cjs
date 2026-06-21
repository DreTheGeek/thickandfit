const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'admin');
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR:', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
  await p.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.sam@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
  await p.goto(`${BASE}/nutrition`, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: path.join(OUT, 'nutri-empty.png') });
  console.log('nutri-empty @', p.url());
  // type a search
  const input = await p.$('input[placeholder]');
  if (input) {
    await p.evaluate(() => {
      const el = document.querySelector('input[placeholder]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, 'chicken');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 4000));
    const n = await p.evaluate(() => document.querySelectorAll('button').length);
    const hits = await p.evaluate(() => Array.from(document.querySelectorAll('button')).filter((e) => /kcal\/100g/.test(e.textContent || '')).length);
    console.log('buttons=', n, 'foodResults=', hits);
    await p.screenshot({ path: path.join(OUT, 'nutri-search.png') });
    console.log('nutri-search captured');
    // click first result
    const clicked = await p.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((e) => /kcal\/100g/.test(e.textContent || ''));
      if (btn) { btn.click(); return true; }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1400));
    await p.screenshot({ path: path.join(OUT, 'nutri-detail.png') });
    console.log('nutri-detail captured');
    if (clicked) {
      const addBtn = await p.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((e) => (e.textContent || '').trim() === 'Add');
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise((r) => setTimeout(r, 2000));
      await p.screenshot({ path: path.join(OUT, 'nutri-logged.png') });
      console.log('nutri-logged add=', addBtn);
    }
  }
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
