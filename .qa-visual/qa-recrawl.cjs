// Re-crawl the previously-broken surfaces (localhost prod build) to confirm fixes.
const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const OPP = '000f7347-1fa9-4766-b420-93bb0ed48d15';
async function check(p, route, tag) {
  const perr = [];
  const ph = (e) => perr.push(e.message.slice(0, 90));
  p.on('pageerror', ph);
  let status = 0;
  try { const r = await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 }); status = r ? r.status() : 0; } catch (e) { perr.push('NAV ' + e.message.slice(0, 60)); }
  await new Promise((r) => setTimeout(r, 1500));
  p.off('pageerror', ph);
  const fp = new URL(p.url()).pathname;
  console.log(`[${tag}] ${perr.length ? 'STILL-ERR' : 'CLEAN'} ${status} ${route}${fp !== route ? ' ->' + fp : ''}${perr.length ? ' :: ' + perr[0] : ''}`);
}
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
  // password reset page (was 404) — logged out
  await check(p, '/auth/reset-password', 'reset');
  // coach #418 surfaces
  await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.type('input[name=email]', 'sample.casey@thickandfit.test');
  await p.type('input[name=password]', 'TFSample2026!');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), p.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 2500));
  await check(p, '/admin/health', 'health');
  await check(p, '/coach/leads', 'leads');
  await check(p, `/coach/leads/${OPP}`, 'lead-detail');
  await b.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
