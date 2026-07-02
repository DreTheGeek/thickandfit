// Verify the coach profile Meal plan card + the Generate-with-AI flow end to end (sample.casey).
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const PW = 'TFSample2026!';
const SAM = 'aaee8065-5489-4acf-a548-e7c2b5b0de0d';
const OUT = path.join(__dirname, 'reskin');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 1500 });
  page.on('response', async (r) => {
    if (r.url().includes('/api/coach-ai/plan')) {
      let b = ''; try { b = await r.text(); } catch {}
      console.log('PLAN RESP', r.status(), b.slice(0, 200));
    }
  });
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', PW);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1200));

  await page.goto(`${BASE}/coach/subscribers/${SAM}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, 'coach-profile-mealcard.png'), fullPage: true });

  const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /generate with ai/i.test(b.textContent)));
  const btn = handle.asElement();
  console.log('found generate btn:', !!btn);
  await btn.click();

  // Wait up to ~80s for the generation to finish + router to push to the new plan detail.
  let url = page.url();
  for (let i = 0; i < 80; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    url = page.url();
    if (/\/coach\/tool\/meal-plans\/[0-9a-f-]{36}/.test(url)) break;
  }
  console.log('after-generate url:', url);
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT, 'coach-generated-plan.png'), fullPage: true });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
