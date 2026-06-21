const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OUT = path.join(__dirname, 'landing');
fs.mkdirSync(OUT, { recursive: true });

const errs = [];
const failed = [];

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 160)));
  p.on('requestfailed', (r) => failed.push(r.url().slice(0, 100) + ' :: ' + (r.failure()?.errorText || '')));
  p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(0, 100)); });

  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 5500));

  const info = await p.evaluate(() => {
    const sheets = Array.from(document.styleSheets).map((s) => s.href).filter(Boolean);
    const webflowCss = sheets.some((h) => /webflow\.css/.test(h));
    const hiddenByIx = Array.from(document.querySelectorAll('[data-w-id]')).filter((el) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.opacity) < 0.05 || cs.transform !== 'none';
    }).length;
    const dataWid = document.querySelectorAll('[data-w-id]').length;
    return {
      jQuery: typeof window.jQuery !== 'undefined' || typeof window.$ !== 'undefined',
      Webflow: typeof window.Webflow !== 'undefined',
      Swiper: typeof window.Swiper !== 'undefined',
      loaderRan: document.querySelectorAll('script[data-wf]').length,
      swiperInit: document.querySelectorAll('.swiper-initialized, .swiper.swiper-initialized').length,
      webflowCss,
      sheetCount: sheets.length,
      dataWid,
      hiddenByIx,
      bodyW: document.body.scrollWidth,
      bodyH: document.body.scrollHeight,
      htmlClass: document.documentElement.className.slice(0, 40),
    };
  });

  await p.screenshot({ path: path.join(OUT, 'desktop-top.png'), fullPage: false });
  await p.screenshot({ path: path.join(OUT, 'desktop.png'), fullPage: true });
  console.log(JSON.stringify(info, null, 2));
  console.log('CONSOLE ERRORS (' + errs.length + '):'); [...new Set(errs)].slice(0, 12).forEach((e) => console.log(' - ' + e));
  console.log('FAILED REQUESTS (' + failed.length + '):'); [...new Set(failed)].slice(0, 12).forEach((e) => console.log(' - ' + e));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
