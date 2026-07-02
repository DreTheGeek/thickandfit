// Drive a REAL AI meal-plan generation via /api/coach-ai/plan as coach sample.casey. Generates from
// sam's intake but with contactId:null (orphan row) so it does not clobber sam's seeded demo plan.
const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const PW = 'TFSample2026!';
const SAM = 'aaee8065-5489-4acf-a548-e7c2b5b0de0d';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', PW);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1200));

  const res = await page.evaluate(async (sam) => {
    const r = await fetch('/api/coach-ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientProfileId: sam, contactId: null, locale: 'en' }),
    });
    return { status: r.status, body: await r.json() };
  }, SAM);
  console.log(JSON.stringify(res));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
