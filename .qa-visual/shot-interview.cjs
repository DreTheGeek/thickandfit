// Verify the Coach Interview as sample.casey: render it, fill an answer + a choice, click Save & train,
// and confirm the section trained the knowledge base.
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'reskin');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 1500 });
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2' });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1000));

  await page.goto(`${BASE}/coach/settings/knowledge/interview`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, 'interview-page.png'), fullPage: true });

  // Fill the first open textarea (philosophy-core-belief) via the native setter (React controlled).
  await page.evaluate((val) => {
    const el = document.querySelector('textarea');
    if (el) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 'Women get results when it feels doable, not perfect. Simple meals, high protein, and someone in their corner who never makes them feel ashamed.');

  // Click a choice pill (voice-tone).
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /big-sister energy/i.test(x.textContent));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Click Save & train for the open (first) section.
  const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /save & train/i.test(b.textContent)));
  const btn = handle.asElement();
  console.log('found save btn:', !!btn);
  await btn.click();
  await new Promise((r) => setTimeout(r, 4000));
  const saved = await page.evaluate(() => /learned this/i.test(document.body.innerText));
  console.log('saved status shown:', saved);
  await page.screenshot({ path: path.join(OUT, 'interview-saved.png'), fullPage: true });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
