const path = require('path');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2' });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3500));
  const info = await p.evaluate(() => {
    const wrap = document.querySelector('.recharts-responsive-container');
    const svg = document.querySelector('.recharts-wrapper svg');
    const surfacePaths = document.querySelectorAll('.recharts-area-area, .recharts-area-curve').length;
    return {
      hasResponsive: !!wrap,
      wrapBox: wrap ? { w: wrap.clientWidth, h: wrap.clientHeight } : null,
      hasSvg: !!svg,
      svgBox: svg ? { w: svg.getAttribute('width'), h: svg.getAttribute('height') } : null,
      areaPaths: surfacePaths,
    };
  });
  console.log('CONSOLE ERRORS:', errs.length ? JSON.stringify(errs, null, 2) : 'none');
  console.log('CHART DOM:', JSON.stringify(info, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
