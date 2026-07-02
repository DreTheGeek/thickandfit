// Screenshot the coach client-profile tabs (pass tab labels as args to click each before shooting).
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const SAM = 'aaee8065-5489-4acf-a548-e7c2b5b0de0d';
const OUT = path.join(__dirname, 'reskin');
fs.mkdirSync(OUT, { recursive: true });
const TABS = process.argv.slice(2); // e.g. Info Progress Nutrition

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 1400 });
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle2' });
  await page.type('input[name=email]', 'sample.casey@thickandfit.test');
  await page.type('input[name=password]', 'TFSample2026!');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('button[type=submit]')]);
  await new Promise((r) => setTimeout(r, 1000));
  await page.goto(`${BASE}/coach/subscribers/${SAM}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));

  for (const label of TABS) {
    // Scope to the profile tab bar (avoids the sidebar "Nutrition" section toggle name collision).
    const h = await page.evaluateHandle((lbl) => {
      const bar = [...document.querySelectorAll('div')].find(
        (d) => d.className.includes('overflow-x-auto') && d.className.includes('border-b'),
      );
      const scope = bar || document;
      return [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === lbl);
    }, label);
    const el = h.asElement();
    if (!el) { console.log(`tab "${label}" NOT FOUND`); continue; }
    await el.click();
    await new Promise((r) => setTimeout(r, 700));
    const err = await page.evaluate(() => {
      const b = document.body.innerText;
      return /something went wrong|error|undefined/i.test(b) ? 'possible-error' : 'ok';
    });
    await page.screenshot({ path: path.join(OUT, `coachtab-${label.toLowerCase().replace(/\s+/g, '-')}.png`), fullPage: true });
    console.log(`tab "${label}": ${err}`);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
