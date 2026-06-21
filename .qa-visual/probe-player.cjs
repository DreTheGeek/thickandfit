const path = require('path');
const fs = require('fs');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
const errs = [];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 460, height: 920, deviceScaleFactor: 2 });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2' });
  await p.type('input[name=email]', 'sample.sam@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1500));
  await p.goto(`${BASE}/workout/${seed.planId}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  const info = await p.evaluate(() => {
    const main = document.querySelector('main');
    const root = document.querySelector('main > div');
    return {
      bodyText: (document.body.innerText || '').slice(0, 200),
      bodyTextLen: (document.body.innerText || '').length,
      scrollH: document.body.scrollHeight,
      mainH: main ? main.getBoundingClientRect().height : null,
      rootH: root ? root.getBoundingClientRect().height : null,
      hasPlayerText: document.body.innerHTML.includes('Log Set') || document.body.innerHTML.includes('Sit-Up'),
    };
  });
  await p.screenshot({ path: path.join(__dirname, 'fullapp', '03-workout-player-full.png'), fullPage: true });
  console.log(JSON.stringify(info, null, 2));
  console.log('ERRORS(' + errs.length + '):'); errs.slice(0, 10).forEach((e) => console.log(' - ' + e));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
