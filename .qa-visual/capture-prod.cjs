const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://thicknfit.kaldrtech.com/';
const OUT = path.join(__dirname, 'prod');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));
  const info = await p.evaluate(() => ({
    jQuery: typeof window.jQuery !== 'undefined' || typeof window.$ !== 'undefined',
    Webflow: typeof window.Webflow !== 'undefined',
    Swiper: typeof window.Swiper !== 'undefined',
    swiperInit: document.querySelectorAll('.swiper-initialized').length,
    bodyH: document.body.scrollHeight,
  }));
  console.log('PROD:', JSON.stringify(info));
  await p.screenshot({ path: path.join(OUT, 'prod-top.png'), fullPage: false });
  for (const y of [1350, 2200]) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise((r) => setTimeout(r, 700));
    await p.screenshot({ path: path.join(OUT, `prod-${y}.png`), fullPage: false });
  }
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
