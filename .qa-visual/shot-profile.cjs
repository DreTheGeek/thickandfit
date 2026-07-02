// Quick render check of the coach client profile: confirm the renamed "Generate plan" button and no
// "AI" text anywhere on the page.
const path = require('path');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const SAM = 'aaee8065-5489-4acf-a548-e7c2b5b0de0d';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2' });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1000));
  await page.goto(`${BASE}/coach/subscribers/${SAM}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  const label = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /generat/i.test(x.textContent));
    return b ? b.textContent.trim() : '(no gen button)';
  });
  const anyAI = await page.evaluate(() => /\bAI\b/.test(document.body.innerText));
  console.log('gen button label:', JSON.stringify(label), '| page body has "AI":', anyAI);
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
