const path = require('path');
const puppeteer = require(
  path.join(process.env.HOME || process.env.USERPROFILE, '.launchproof/runtime/node_modules/puppeteer-core'),
);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 3500));

  const out = await p.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const heading = els.find((e) => {
      const own = Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      return /one rep at a time/i.test(own);
    }) || els.find((e) => /one rep at a time/i.test(e.textContent || '') && e.children.length <= 2);
    if (!heading) return { found: false };
    let sec = heading;
    for (let i = 0; i < 8 && sec.parentElement; i++) {
      sec = sec.parentElement;
      if (/section/.test(sec.className || '')) break;
    }
    function d(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { cls: el.className, tag: el.tagName, disp: cs.display, pos: cs.position, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
    }
    const imgs = Array.from(sec.querySelectorAll('img')).slice(0, 6).map((im) => ({
      file: im.src.split('/').pop(), cls: im.className,
      parent: (im.parentElement || {}).className,
      gp: (im.parentElement && im.parentElement.parentElement ? im.parentElement.parentElement.className : ''),
      w: Math.round(im.getBoundingClientRect().width), h: Math.round(im.getBoundingClientRect().height),
    }));
    // climb to find the wrapper that holds all the imgs
    return { found: true, sectionClass: sec.className, sectionRect: d(sec), imgCount: sec.querySelectorAll('img').length, imgs };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
