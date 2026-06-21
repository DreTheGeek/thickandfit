const path = require('path');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));

  const info = await p.evaluate(() => {
    // find heading with "Empowering women"
    const all = Array.from(document.querySelectorAll('h1,h2,h3,div,span'));
    const h = all.find((e) => /empowering women through fitness/i.test(e.textContent || '') && e.children.length <= 3);
    if (!h) return { found: false };
    // walk up to the section
    let sec = h;
    for (let i = 0; i < 6 && sec.parentElement; i++) {
      sec = sec.parentElement;
      if ((sec.className || '').includes('section')) break;
    }
    const imgs = Array.from(sec.querySelectorAll('img'));
    const phoneImgs = imgs.filter((im) => /app|phone|mock|screen/i.test(im.src) || im.naturalHeight > im.naturalWidth);
    const sample = (phoneImgs[0] || imgs[0]);
    function desc(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: (el.className || '').slice(0, 80), display: cs.display, position: cs.position, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
    }
    return {
      found: true,
      sectionClass: (sec.className || '').slice(0, 100),
      imgCount: imgs.length,
      phoneImgCount: phoneImgs.length,
      sampleSrc: sample ? sample.src.split('/').pop() : null,
      phoneParent: desc(sample ? sample.parentElement : null),
      phoneGrandparent: desc(sample && sample.parentElement ? sample.parentElement.parentElement : null),
      phoneImg: desc(sample),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
